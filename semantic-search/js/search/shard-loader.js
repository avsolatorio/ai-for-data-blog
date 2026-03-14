/**
 * shard-loader.js
 * Lazy shard loader with three-tier caching:
 *   1. In-memory Map (fastest — survives within a session)
 *   2. Cache API via Service Worker (survives page reloads / offline)
 *   3. Network fetch (cold load)
 *
 * Key feature: inflight deduplication. If two beam-search paths need the
 * same shard simultaneously, only one fetch is issued. Both await the same Promise.
 */

export class ShardLoader {
  /**
   * @param {string} baseUrl - base URL for shard files (must end with '/')
   * @param {string} [cacheName] - Cache API bucket name (versioned for cache busting)
   */
  constructor(baseUrl, cacheName = 'hnsw-shards-v1') {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.cacheName = cacheName;
    /** @type {Map<number, object>} shard_id → parsed shard JSON */
    this.memoryCache = new Map();
    /** @type {Map<number, Promise<object>>} shard_id → in-flight fetch promise */
    this.inflight = new Map();
    /** FIFO insertion order for LRU eviction */
    this._insertOrder = [];
    /** Whether the Cache API is available (Service Worker context or main thread) */
    this._hasCacheApi = typeof caches !== 'undefined';
  }

  /**
   * Load a layer0 shard by cluster ID.
   * Returns the parsed shard object (with nodes array).
   *
   * @param {number} shardId
   * @returns {Promise<{shard_id: number, nodes: Array}>}
   */
  async load(shardId) {
    // 1. Memory cache
    if (this.memoryCache.has(shardId)) {
      return this.memoryCache.get(shardId);
    }

    // 2. Deduplication: if already fetching, await same promise
    if (this.inflight.has(shardId)) {
      return this.inflight.get(shardId);
    }

    // 3. Fetch (Cache API → network)
    const promise = this._fetchShard(shardId);
    this.inflight.set(shardId, promise);

    try {
      const data = await promise;
      // Store in memory cache
      this.memoryCache.set(shardId, data);
      this._insertOrder.push(shardId);
      return data;
    } finally {
      this.inflight.delete(shardId);
    }
  }

  /**
   * Fire-and-forget prefetch for shards likely to be needed soon.
   * Call after upper-layer traversal identifies probable layer0 entry cluster.
   *
   * @param {number[]} shardIds
   */
  prefetch(shardIds) {
    for (const sid of shardIds) {
      if (!this.memoryCache.has(sid) && !this.inflight.has(sid)) {
        this.load(sid); // intentionally not awaited
      }
    }
  }

  /**
   * Evict oldest entries from memory cache when it exceeds maxEntries.
   * Call periodically if serving many sequential queries on memory-constrained devices.
   *
   * @param {number} [maxEntries=200]
   */
  evict(maxEntries = 200) {
    while (this._insertOrder.length > maxEntries) {
      const oldest = this._insertOrder.shift();
      this.memoryCache.delete(oldest);
    }
  }

  _shardUrl(shardId) {
    return this.baseUrl + `shard_${String(shardId).padStart(3, '0')}.json`;
  }

  async _fetchShard(shardId) {
    const url = this._shardUrl(shardId);

    // Try Cache API first (populated by service-worker.js on prior visits)
    if (this._hasCacheApi) {
      try {
        const cache = await caches.open(this.cacheName);
        const cached = await cache.match(url);
        if (cached) {
          return cached.json();
        }
      } catch (_) {
        // Cache API unavailable or quota exceeded — fall through to network
      }
    }

    // Network fetch
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`ShardLoader: failed to fetch shard ${shardId} (HTTP ${resp.status}): ${url}`);
    }

    const data = await resp.json();

    // Populate Cache API for future visits (non-blocking, best-effort)
    if (this._hasCacheApi) {
      try {
        const cache = await caches.open(this.cacheName);
        // Re-create response since body is consumed above
        cache.put(url, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        }));
      } catch (_) {
        // Non-fatal: cache storage full or unavailable
      }
    }

    return data;
  }
}
