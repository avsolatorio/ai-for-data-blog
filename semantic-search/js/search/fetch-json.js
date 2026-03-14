/**
 * fetch-json.js
 * Fetches JSON from a URL, with gzip decompression when URL ends in .gz.
 * The pipeline writes .json.gz files when --compress=gzip; this utility
 * fetches and decompresses them for consumption by the app.
 *
 * Uses DecompressionStream (supported in Chrome 80+, Firefox 113+, Safari 16.4+).
 */

/**
 * Fetch JSON from a URL. If URL ends with .gz, decompresses before parsing.
 *
 * @param {string} url - Full URL (e.g. "https://example.com/data/flat/embeddings.int8.json.gz")
 * @param {object} [opts]
 * @param {string} [opts.cacheName] - If set, try Cache API first (for service worker caching)
 * @returns {Promise<object>} Parsed JSON
 */
export async function fetchJson(url, { cacheName = null } = {}) {
  const isGz = url.endsWith(".gz");

  // Try Cache API first if cacheName provided
  if (cacheName && typeof caches !== "undefined") {
    try {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(url);
      if (cached) {
        return cached.json();
      }
    } catch (_) {
      // Fall through to network
    }
  }

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`fetchJson: HTTP ${resp.status}: ${url}`);
  }

  let data;
  if (isGz) {
    // Server may or may not set Content-Encoding; decompress ourselves for .gz URLs
    const encoding = resp.headers.get("Content-Encoding");
    if (encoding === "gzip" || encoding === "x-gzip") {
      data = await resp.json();
    } else {
      const stream = resp.body.pipeThrough(new DecompressionStream("gzip"));
      data = await new Response(stream).json();
    }
  } else {
    data = await resp.json();
  }

  // Populate Cache API for future visits (decompress before caching)
  if (cacheName && typeof caches !== "undefined") {
    try {
      const cache = await caches.open(cacheName);
      cache.put(url, new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      }));
    } catch (_) {
      // Non-fatal
    }
  }

  return data;
}
