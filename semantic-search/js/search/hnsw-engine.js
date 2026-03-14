/**
 * hnsw-engine.js
 * Browser-native HNSW approximate nearest neighbor search over sharded JSON files.
 *
 * Algorithm (standard HNSW, Malkov & Yashunin 2016):
 *   Phase 1 — Greedy descent through upper layers (layers max → 1):
 *     All upper-layer nodes are loaded at init (upper_layers.json, tiny).
 *     Traverse greedily (ef=1): always move to the neighbor with highest similarity.
 *
 *   Phase 2 — Beam search at layer 0:
 *     Lazy-load layer0 shards on demand via ShardLoader.
 *     Maintain two sorted arrays: W (result set, top-ef) and C (frontier).
 *     Batch-prefetch all unvisited neighbor shards before iterating each candidate.
 *     Early termination: stop when best candidate score < worst in W.
 *
 * Shard assignment is K-Means cluster-based (from Python pipeline), so neighbors
 * tend to be in the same shard → 2–4 shard fetches per query instead of 10–15.
 *
 * All stored vectors are L2-normalized + SQ8 int8 quantized.
 * Query vector must be L2-normalized Float32Array before calling search().
 */

import { dotProductMixed, toInt8Array } from './int8-codec.js';
import { ShardLoader } from './shard-loader.js';

export class HNSWEngine {
  constructor() {
    /** @type {object} config.json contents */
    this.config = null;
    /** @type {{max_layer: number, entry_node_id: number, nodes: object}} */
    this.upperLayers = null;
    /** @type {object} {node_id_str: shard_id} */
    this.nodeToShard = null;
    /** @type {ShardLoader} */
    this.loader = null;
    /**
     * node-level cache: avoids re-reading shard when same node visited again.
     * Key: node_id (number), Value: {id, scale, qv (Int8Array), neighbors, ...}
     */
    this.nodeCache = new Map();
    this.ready = false;
    /** Diagnostics for the last search() call */
    this.lastStats = null;
  }

  /**
   * Initialize the engine by loading the three tiny index files.
   * Total cold bandwidth: ~220–350 KB for PRWP (10k docs, 384-dim).
   *
   * @param {string} baseUrl - base URL for the collection (e.g. 'data/prwp/')
   * @param {object} [opts]
   * @param {string} [opts.cacheName] - Cache API bucket name
   * @returns {Promise<void>}
   */
  async init(baseUrl, { cacheName = 'hnsw-shards-v1' } = {}) {
    const indexUrl = baseUrl.endsWith('/') ? baseUrl + 'index/' : baseUrl + '/index/';

    const [config, upperLayers, nodeToShard] = await Promise.all([
      fetch(indexUrl + 'config.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(indexUrl + 'upper_layers.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(indexUrl + 'node_to_shard.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]);

    this.config = config;
    this.upperLayers = upperLayers;
    this.nodeToShard = nodeToShard;
    this.loader = new ShardLoader(indexUrl + 'layer0/', cacheName);

    // Pre-populate node cache with all upper-layer nodes (already in memory)
    for (const [idStr, node] of Object.entries(upperLayers.nodes)) {
      this.nodeCache.set(parseInt(idStr), {
        id: parseInt(idStr),
        scale: node.scale,
        qv: toInt8Array(node.qv),
        neighbors: [], // populated per-layer during descent (not stored here)
        layers: node.layers,
        max_layer: node.max_layer,
      });
    }

    this.ready = true;
  }

  /**
   * Search for the top-k most similar items.
   *
   * @param {Float32Array} queryVec - L2-normalized query embedding (dim must match config.dim)
   * @param {object} [opts]
   * @param {number} [opts.ef=50] - beam width at layer 0 (higher = better recall, slower)
   * @param {number} [opts.topK=10] - number of results to return
   * @returns {Promise<Array<{id: number, score: number}>>}
   */
  async search(queryVec, { ef = 50, topK = 10 } = {}) {
    if (!this.ready) throw new Error('HNSWEngine: not initialized. Call init() first.');

    const t0 = Date.now();
    let shardsLoaded = 0;
    const prevCacheSize = this.loader.memoryCache.size;

    // ── Phase 1: Greedy descent through upper layers ─────────────────────
    let entryId = this.upperLayers.entry_node_id;

    for (let layer = this.config.n_layers - 1; layer >= 1; layer--) {
      entryId = this._greedyDescentLayer(queryVec, entryId, layer);
    }

    // ── Phase 2: Beam search at layer 0 ──────────────────────────────────
    const results = await this._beamSearchLayer0(queryVec, entryId, ef);

    // Count shards loaded during this search
    shardsLoaded = this.loader.memoryCache.size - prevCacheSize +
                   (this.loader.inflight.size > 0 ? 1 : 0);

    this.lastStats = {
      latencyMs: Date.now() - t0,
      shardsLoaded: Math.max(0, shardsLoaded),
      totalCachedShards: this.loader.memoryCache.size,
    };

    // Evict memory cache if it's grown large (> 300 shards)
    this.loader.evict(300);

    return results.slice(0, topK);
  }

  // ── Private: Greedy descent (upper layers, ef=1) ─────────────────────────

  _greedyDescentLayer(queryVec, startId, layer) {
    const layerStr = String(layer);
    let bestId = startId;
    let bestScore = this._scoreUpperNode(queryVec, startId);
    let changed = true;

    while (changed) {
      changed = false;
      const node = this.nodeCache.get(bestId);
      if (!node) break;
      const neighbors = node.layers?.[layerStr] ?? [];

      for (const nid of neighbors) {
        const score = this._scoreUpperNode(queryVec, nid);
        if (score > bestScore) {
          bestScore = score;
          bestId = nid;
          changed = true;
        }
      }
    }

    return bestId;
  }

  _scoreUpperNode(queryVec, nodeId) {
    const node = this.nodeCache.get(nodeId);
    if (!node) return -Infinity;
    return dotProductMixed(queryVec, node.qv, node.scale);
  }

  // ── Private: Beam search at layer 0 ──────────────────────────────────────

  async _beamSearchLayer0(queryVec, entryId, ef) {
    // Load entry node's shard to get its layer0 neighbors
    const entryNode = await this._getLayer0Node(entryId);
    const entryScore = dotProductMixed(queryVec, entryNode.qv, entryNode.scale);

    const visited = new Set([entryId]);

    // W: result set (top-ef by score, descending). We'll pop from the end for eviction.
    // C: candidate frontier (ascending by score so we pop the best from the end).
    let W = [[entryScore, entryId]];
    let C = [[entryScore, entryId]];

    while (C.length > 0) {
      // Pop best candidate (highest score = last element in ascending-sorted C)
      const [cScore, cId] = C.pop();

      // Early termination: if best candidate is worse than worst in W, stop
      const worstInW = W.length >= ef ? W[0][0] : -Infinity;
      if (cScore < worstInW) break;

      const cNode = await this._getLayer0Node(cId);
      if (!cNode) continue;

      // Identify unvisited neighbors and their shards
      const unvisited = cNode.neighbors.filter(n => !visited.has(n));

      // Batch-prefetch all needed shards before iterating (parallel I/O)
      const neededShards = new Set();
      for (const nid of unvisited) {
        const sId = this.nodeToShard[String(nid)];
        if (sId != null && !this.loader.memoryCache.has(sId)) {
          neededShards.add(sId);
        }
      }
      if (neededShards.size > 0) {
        await Promise.all([...neededShards].map(s => this.loader.load(s)));
      }

      // Process each unvisited neighbor
      for (const nid of unvisited) {
        visited.add(nid);
        const nNode = await this._getLayer0Node(nid);
        if (!nNode) continue;

        const score = dotProductMixed(queryVec, nNode.qv, nNode.scale);
        const currentWorst = W.length >= ef ? W[0][0] : -Infinity;

        if (score > currentWorst || W.length < ef) {
          // Insert into C (ascending sorted, binary insert)
          _sortedInsert(C, [score, nid]);
          // Insert into W (ascending sorted, pruned to ef)
          _sortedInsert(W, [score, nid]);
          if (W.length > ef) W.shift(); // remove worst (first element)
        }
      }
    }

    // Return descending by score
    return W.sort((a, b) => b[0] - a[0]).map(([score, id]) => ({ id, score }));
  }

  // ── Private: Node cache management ───────────────────────────────────────

  async _getLayer0Node(nodeId) {
    // Check node cache first (upper-layer nodes are pre-cached)
    if (this.nodeCache.has(nodeId)) {
      const cached = this.nodeCache.get(nodeId);
      // Upper-layer node: may not have layer0 neighbors yet
      if (cached._l0loaded) return cached;
      // Fall through to load the shard for layer0 neighbors
    }

    const shardId = this.nodeToShard[String(nodeId)];
    if (shardId == null) {
      // Node not in node_to_shard — shouldn't happen but be defensive
      return this.nodeCache.get(nodeId) ?? null;
    }

    const shard = await this.loader.load(shardId);

    // Cache all nodes in this shard at once
    for (const n of shard.nodes) {
      const existing = this.nodeCache.get(n.id);
      const entry = {
        ...(existing ?? {}),
        id: n.id,
        scale: n.scale,
        qv: existing?.qv ?? toInt8Array(n.qv),
        neighbors: n.neighbors,
        _l0loaded: true,
      };
      this.nodeCache.set(n.id, entry);
    }

    return this.nodeCache.get(nodeId) ?? null;
  }
}

// ── Utility: sorted insert into ascending array ───────────────────────────────
// For ef=50 the array is small; a simple sorted insert is fast enough and
// avoids a heap library dependency.
function _sortedInsert(arr, item) {
  const score = item[0];
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] < score) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, item);
}
