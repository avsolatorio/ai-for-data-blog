/**
 * Cache-first service worker for the HNSW search index.
 *
 * CACHE VERSIONING
 * ----------------
 * Bump CACHE_NAME whenever the index format changes incompatibly (e.g. after
 * rebuilding the index with a different model, shard count, or schema version).
 * The activate handler deletes all caches whose name differs from CACHE_NAME,
 * so old shards are evicted automatically on the next page load after a deploy.
 *
 * The CACHE_NAME here must match the `cacheName` constant used in
 * useSearchWorker.ts (or wherever the worker registers this service worker).
 * If those names diverge the worker will not find cached shards and will
 * re-fetch them on every query.
 *
 * WHAT IS CACHED
 * --------------
 * All files matching CACHE_PATTERNS are cached on first fetch and served from
 * cache on subsequent requests. This covers:
 *
 *   - HNSW upper layers   (fetched once at worker init, ~250 KB gzip)
 *   - Layer0 shards       (fetched on demand during search, ~35 KB each)
 *   - Lookup tables       (node_to_shard, cluster_centroids, ~50 KB total)
 *   - titles.json         (fetched once at init, ~450 KB gzip)
 *   - bm25_corpus.json    (fetched when BM25 mode is activated, ~2 MB gzip)
 *   - manifest.json       (tiny, fetched once per collection)
 *   - flat index          (fetched once for small collections, ~14 MB gzip)
 *
 * All patterns match both plain .json and .json.gz variants so the same
 * service worker works whether the pipeline was built with --compress=gzip
 * or --compress=none.
 *
 * OFFLINE BEHAVIOUR
 * -----------------
 * If a fetch fails and the resource is not cached, the service worker returns
 * a 503 JSON error response so the worker can surface a useful message rather
 * than a generic network failure.
 */

// Bump this version string whenever the index format changes incompatibly.
// Format: 'hnsw-shards-v{N}' where N is a monotonically increasing integer.
const CACHE_NAME = 'hnsw-shards-v1'

// ── Lifecycle: install ────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Skip the waiting phase so the new service worker activates immediately
  // without requiring all tabs to be closed first.
  self.skipWaiting()
})

// ── Lifecycle: activate ───────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  // Delete any cache whose name is not the current CACHE_NAME. This evicts
  // stale shards from previous index builds automatically.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── URL patterns to cache ─────────────────────────────────────────────────────
//
// Each entry is a RegExp tested against the pathname of the request URL.
// Both plain .json and gzip-compressed .json.gz variants are matched so the
// same service worker works regardless of the --compress flag used at build
// time.

const CACHE_PATTERNS = [
  // Layer0 shards — fetched on demand during HNSW beam search
  /\/index\/layer0\/shard_\d+\.json(\.gz)?$/,

  // Upper-layer graph — fetched once at search worker init
  /\/index\/upper_layers\.json(\.gz)?$/,

  // Node-to-shard lookup table — fetched once at init
  /\/index\/node_to_shard\.json(\.gz)?$/,

  // Cluster centroids — fetched once at init for shard pre-selection
  /\/index\/cluster_centroids\.json(\.gz)?$/,

  // Index configuration — fetched once at init
  /\/index\/config\.json(\.gz)?$/,

  // Lightweight display metadata (title, idno, doi, etc.) — fetched at init
  /\/index\/titles\.json(\.gz)?$/,

  // BM25 text corpus — fetched when the user activates keyword search mode.
  // ~2 MB gzip. Caching avoids re-downloading between sessions.
  /\/index\/bm25_corpus\.json(\.gz)?$/,

  // Top-level manifest — tiny, fetched once per collection
  /\/manifest\.json$/,

  // Flat embedding index — used for small collections instead of HNSW
  /\/flat\/embeddings\.int8\.json(\.gz)?$/,
]

// ── Fetch handler: cache-first strategy ──────────────────────────────────────

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const shouldCache = CACHE_PATTERNS.some(p => p.test(url.pathname))

  // Only intercept requests for index files; pass everything else through.
  if (!shouldCache) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Return cached response immediately if available (cache-first).
      const cached = await cache.match(event.request)
      if (cached) return cached

      // 2. Not in cache — fetch from network and store for next time.
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          // Clone before consuming: one copy for the cache, one for the caller.
          cache.put(event.request, response.clone())
        }
        return response
      } catch (_err) {
        // Network failure and no cached copy — return a structured error so
        // the search worker can surface a meaningful offline message.
        return new Response(
          JSON.stringify({ error: 'offline', url: event.request.url }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    })
  )
})
