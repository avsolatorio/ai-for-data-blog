/**
 * flat-engine.js
 * Brute-force cosine similarity search over an int8 flat index.
 * Used for small collections (≤ flat_threshold items, e.g. WDI ~1.5k indicators).
 *
 * Index format: flat/embeddings.int8.json (or .json.gz when compressed)
 * {
 *   format: "int8_flat",
 *   n_items: number,
 *   dim: number,
 *   items: [{ id, scale, qv: number[], title, text, ...preview_fields }]
 * }
 *
 * All vectors are pre-normalized (L2) so dot product = cosine similarity.
 */

import { dotProductMixed, toInt8Array } from './int8-codec.js';
import { fetchJson } from './fetch-json.js';

export class FlatEngine {
  constructor() {
    /** @type {Array<{id: string, scale: number, qv: Int8Array, title: string, text: string}>} */
    this.items = [];
    this.dim = 0;
    this.ready = false;
  }

  /**
   * Load the flat index from a URL.
   * Returns the items array (also stored on this.items) for BM25 index construction.
   * Supports .json.gz (decompresses automatically).
   *
   * @param {string} url - URL to flat/embeddings.int8.json or .json.gz
   * @returns {Promise<Array>} loaded items (without the typed qv, use this.items for search)
   */
  async load(url) {
    const data = await fetchJson(url);
    this.dim = data.dim;

    // Convert qv arrays to Int8Array for faster typed access during search
    this.items = data.items.map(item => ({
      ...item,
      qv: toInt8Array(item.qv),
    }));

    this.ready = true;
    // Return items with plain array qv (for BM25 / display — don't expose typed arrays)
    return data.items;
  }

  /**
   * Search the flat index for the top-k most similar items.
   *
   * @param {Float32Array} queryVec - L2-normalized query embedding
   * @param {object} [opts]
   * @param {number} [opts.topK=20]
   * @param {number} [opts.threshold=0.0] - minimum cosine similarity
   * @returns {Array<{id: string, score: number, title: string, text: string}>}
   */
  search(queryVec, { topK = 20, threshold = 0.0 } = {}) {
    if (!this.ready) throw new Error('FlatEngine: not loaded yet');

    const scores = new Float32Array(this.items.length);
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      scores[i] = dotProductMixed(queryVec, item.qv, item.scale);
    }

    // Partial sort: collect indices with score >= threshold, sort descending, take topK
    const candidates = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= threshold) candidates.push(i);
    }
    candidates.sort((a, b) => scores[b] - scores[a]);

    return candidates.slice(0, topK).map(i => {
      const item = this.items[i];
      return {
        id: item.id,
        score: scores[i],
        title: item.title,
        text: item.text,
        // spread remaining preview fields (excluding typed qv)
        ...Object.fromEntries(
          Object.entries(item).filter(([k]) => !['id', 'scale', 'qv', 'title', 'text'].includes(k))
        ),
      };
    });
  }
}
