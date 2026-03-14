/**
 * service-worker.js
 * Cache API interceptor for HNSW layer0 shards and index files.
 *
 * Strategy: Cache-first for shard files (immutable once built).
 * On first visit, shards are fetched from the network and stored.
 * On subsequent visits (even offline), shards are served from cache instantly.
 *
 * Cache versioning: bump CACHE_NAME when index is rebuilt to purge stale shards.
 * The search.worker.js passes cacheName = 'hnsw-shards-v1' to ShardLoader —
 * keep the name in sync here and there.
 *
 * Registration (in your HTML):
 *   if ('serviceWorker' in navigator) {
 *     navigator.serviceWorker.register('/service-worker.js');
 *   }
 */

const CACHE_NAME = 'hnsw-shards-v1';

/**
 * URL patterns that should be cached by this service worker.
 * Matches shard files, lookup tables, and upper-layer files.
 * Supports both .json and .json.gz (compressed pipeline output).
 */
const CACHEABLE_PATTERNS = [
  /\/index\/layer0\/shard_\d+\.json(\.gz)?$/,
  /\/index\/upper_layers\.json(\.gz)?$/,
  /\/index\/node_to_shard\.json(\.gz)?$/,
  /\/index\/cluster_centroids\.json(\.gz)?$/,
  /\/index\/config\.json(\.gz)?$/,
  /\/index\/titles\.json(\.gz)?$/,
  /\/manifest\.json$/,
  /\/flat\/embeddings\.int8\.json(\.gz)?$/,
];

function isCacheable(url) {
  return CACHEABLE_PATTERNS.some(pattern => pattern.test(url));
}

// ── Install: skip waiting so new SW activates immediately ──────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate: purge old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shard/index files, passthrough for everything else
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (!isCacheable(url)) return; // let browser handle non-shard requests normally

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Check cache
      const cached = await cache.match(event.request);
      if (cached) return cached;

      // 2. Network fetch
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          // Store a clone (response body can only be consumed once)
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and not cached — return a meaningful error response
        console.warn(`[SW] Fetch failed (offline?): ${url}`);
        return new Response(
          JSON.stringify({ error: 'offline', url }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
    })
  );
});
