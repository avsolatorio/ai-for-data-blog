/**
 * search.worker.js — Unified Search Worker
 *
 * Handles embedding generation + search routing in a single Web Worker,
 * keeping the main thread fully responsive.
 *
 * Message protocol (structured, type-based):
 *
 *   → { type: 'init', manifestUrl, modelId? }
 *   ← { type: 'progress', phase: 'model'|'index', message }
 *   ← { type: 'bm25_init', items }   (flat mode only: items for BM25 construction)
 *   ← { type: 'ready', mode: 'flat'|'hnsw', config }
 *
 *   → { type: 'search', text, topK?, ef?, mode? }
 *   ← { type: 'results', data: [{id,score,title,text,...}], stats? }
 *
 *   → { type: 'embed', text }
 *   ← { type: 'embedding', data: Float32Array }
 *
 *   → { type: 'ping' }
 *   ← { type: 'pong' }  or  { type: 'loading' }
 *
 * Legacy compatibility: bare { text, ping } messages still handled.
 */

import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';
import { l2NormalizeInPlace } from './int8-codec.js';
import { FlatEngine } from './flat-engine.js';
import { HNSWEngine } from './hnsw-engine.js';

env.allowRemoteModels = true;

const DEFAULT_MODEL = 'avsolatorio/GIST-small-Embedding-v0';

let extractor = null;
let manifest = null;
let searchEngine = null;   // FlatEngine | HNSWEngine
let flatItems = null;      // raw items array for BM25 (flat mode)
let titlesMap = null;      // HNSW mode: {node_id_str: {title, idno, type, ...}}
let isReady = false;

// ── Embedding ──────────────────────────────────────────────────────────────

async function loadModel(modelId) {
  self.postMessage({ type: 'progress', phase: 'model', message: 'Loading embedding model…' });
  // Try WebGPU first, fall back to WASM if unavailable
  try {
    extractor = await pipeline(
      'feature-extraction',
      modelId || DEFAULT_MODEL,
      { dtype: 'q8', device: 'webgpu' }
    );
  } catch (_) {
    extractor = await pipeline(
      'feature-extraction',
      modelId || DEFAULT_MODEL,
      { dtype: 'q8', device: 'wasm' }
    );
  }
  self.postMessage({ type: 'progress', phase: 'model', message: 'Embedding model ready' });
}

async function getEmbedding(text) {
  if (!extractor) throw new Error('Embedding model not loaded');
  // Transformers.js v3: call pipeline directly with pooling option
  const output = await extractor(text, { pooling: 'mean', normalize: false });
  const raw = new Float32Array(output.data);
  l2NormalizeInPlace(raw);
  return raw;
}

// ── Index initialization ───────────────────────────────────────────────────

async function initIndex(manifestUrl) {
  self.postMessage({ type: 'progress', phase: 'index', message: 'Fetching index manifest…' });

  const resp = await fetch(manifestUrl);
  if (!resp.ok) throw new Error(`Failed to fetch manifest: ${manifestUrl} (HTTP ${resp.status})`);
  manifest = await resp.json();

  const baseUrl = manifestUrl.replace(/manifest\.json$/, '');

  if (manifest.search_mode === 'flat') {
    self.postMessage({ type: 'progress', phase: 'index', message: 'Loading flat index…' });
    const engine = new FlatEngine();
    flatItems = await engine.load(baseUrl + manifest.flat.path);
    searchEngine = engine;
    // Send items to main thread for BM25 index construction (lexical.js)
    self.postMessage({ type: 'bm25_init', items: flatItems, manifest });
  } else {
    // HNSW mode: load index + lightweight titles in parallel
    self.postMessage({ type: 'progress', phase: 'index', message: 'Loading HNSW index…' });
    const engine = new HNSWEngine();
    const titlesUrl = manifest.index?.titles ? baseUrl + manifest.index.titles : null;
    const [, titlesData] = await Promise.all([
      engine.init(baseUrl, { cacheName: 'hnsw-shards-v1' }),
      titlesUrl ? fetch(titlesUrl).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
    ]);
    searchEngine = engine;
    titlesMap = titlesData;  // {node_id_str: {title, idno, type, ...}} or null
    self.postMessage({ type: 'bm25_init', items: [], manifest });
  }

  self.postMessage({ type: 'progress', phase: 'index', message: 'Index ready' });
}

// ── Initialization orchestration ───────────────────────────────────────────

async function init(manifestUrl, modelId) {
  try {
    // Load model and index in parallel (independent operations)
    await Promise.all([
      loadModel(modelId),
      initIndex(manifestUrl),
    ]);

    isReady = true;
    self.postMessage({
      type: 'ready',
      mode: manifest?.search_mode ?? 'flat',
      config: manifest,
    });
  } catch (err) {
    console.error('[search.worker] Init error:', err);
    self.postMessage({ type: 'error', message: err.message });
  }
}

// ── Message handler ─────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const data = e.data;

  // ── Legacy bare-message compatibility (old search.worker.js API) ──────
  if (data && typeof data === 'object' && !data.type) {
    if (data.ping) {
      self.postMessage(isReady ? 'pong' : 'error');
      return;
    }
    if (data.text) {
      // Legacy: return raw embedding array (not normalized — matches old behavior)
      try {
        const output = await extractor(data.text, { pooling: 'mean', normalize: false });
        self.postMessage(Array.from(output.data));
      } catch (err) {
        self.postMessage([]);
      }
      return;
    }
  }

  // ── Structured messages ───────────────────────────────────────────────
  const { type, ...params } = data ?? {};

  try {
    switch (type) {
      case 'init': {
        const { manifestUrl, modelId } = params;
        if (!manifestUrl) throw new Error("'init' message requires manifestUrl");
        await init(manifestUrl, modelId);
        break;
      }

      case 'search': {
        const { text, topK = 20, ef = 50, threshold = 0.0 } = params;
        if (!text) { self.postMessage({ type: 'results', data: [] }); break; }

        if (!isReady) {
          self.postMessage({ type: 'error', message: 'Search engine not ready yet' });
          break;
        }

        const queryVec = await getEmbedding(text);
        let results;

        if (searchEngine instanceof FlatEngine) {
          results = searchEngine.search(queryVec, { topK, threshold });
        } else {
          // HNSW mode — enrich bare {id, score} results with display metadata
          const raw = await searchEngine.search(queryVec, { topK, ef });
          results = titlesMap
            ? raw.map(r => ({ ...(titlesMap[String(r.id)] ?? {}), ...r }))
            : raw;
        }

        self.postMessage({
          type: 'results',
          data: results,
          stats: searchEngine.lastStats ?? null,
        });
        break;
      }

      case 'embed': {
        const { text } = params;
        if (!extractor) { self.postMessage({ type: 'error', message: 'Model not ready' }); break; }
        const emb = await getEmbedding(text);
        self.postMessage({ type: 'embedding', data: emb }, [emb.buffer]);
        break;
      }

      case 'ping': {
        self.postMessage({ type: isReady ? 'pong' : 'loading' });
        break;
      }

      default:
        console.warn('[search.worker] Unknown message type:', type, data);
    }
  } catch (err) {
    console.error('[search.worker] Error handling message:', type, err);
    self.postMessage({ type: 'error', message: err.message, originalType: type });
  }
};
