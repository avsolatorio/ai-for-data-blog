/**
 * hybrid-search.js
 * Merges semantic (HNSW or flat) and lexical (BM25) search results.
 *
 * Scoring:
 *   combined = semanticWeight * normalizedSemanticScore
 *            + lexicalWeight  * normalizedLexicalScore
 *
 * Both score ranges are normalized independently to [0, 1] before combining,
 * so neither system dominates due to scale differences.
 *
 * Usage (inside search.worker.js):
 *   const hybrid = new HybridSearch(hnswEngine, bm25Engine, idToMetaFn);
 *   const results = await hybrid.search(queryVec, queryText, { topK: 20 });
 */

export class HybridSearch {
  /**
   * @param {object} semanticEngine - FlatEngine or HNSWEngine instance
   * @param {object|null} bm25Engine - wink-bm25 engine instance (or null if not ready)
   * @param {Function} [idToMeta] - optional: (id) => {title, text, ...} for metadata lookup
   */
  constructor(semanticEngine, bm25Engine = null, idToMeta = null) {
    this.semantic = semanticEngine;
    this.bm25 = bm25Engine;
    this.idToMeta = idToMeta;
  }

  /**
   * Run hybrid search (semantic + lexical in parallel).
   *
   * @param {Float32Array} queryVec - L2-normalized query embedding (null → semantic-only skipped)
   * @param {string} queryText - raw query string for BM25
   * @param {object} [opts]
   * @param {number} [opts.topK=20]
   * @param {number} [opts.semanticWeight=0.7]
   * @param {number} [opts.lexicalWeight=0.3]
   * @param {number} [opts.ef=50] - HNSW beam width
   * @param {string} [opts.mode='hybrid'] - 'semantic' | 'lexical' | 'hybrid'
   * @returns {Promise<Array<{id, score, semanticScore, lexicalScore, title, text, ...}>>}
   */
  async search(queryVec, queryText, {
    topK = 20,
    semanticWeight = 0.7,
    lexicalWeight = 0.3,
    ef = 50,
    mode = 'hybrid',
  } = {}) {
    const candidateK = topK * 3; // fetch more candidates before merging

    // Run chosen engines in parallel
    const [semanticResults, lexicalResults] = await Promise.all([
      (mode !== 'lexical' && queryVec && this.semantic)
        ? this.semantic.search(queryVec, { topK: candidateK, ef })
        : Promise.resolve([]),
      (mode !== 'semantic' && this.bm25 && queryText)
        ? Promise.resolve(this._runBM25(queryText, candidateK))
        : Promise.resolve([]),
    ]);

    if (mode === 'semantic') {
      return this._formatResults(semanticResults, topK, 'semantic');
    }
    if (mode === 'lexical') {
      return this._formatResults(lexicalResults, topK, 'lexical');
    }

    // ── Hybrid: normalize and merge ─────────────────────────────────────
    const scoreMap = new Map();

    // Normalize semantic scores (cosine sim, roughly in [0.5, 1] for good matches)
    if (semanticResults.length > 0) {
      const maxSem = semanticResults[0].score || 1;
      const minSem = semanticResults[semanticResults.length - 1].score || 0;
      const rangeSem = maxSem - minSem || 1;

      for (const r of semanticResults) {
        const normScore = (r.score - minSem) / rangeSem;
        scoreMap.set(String(r.id), {
          id: r.id,
          semanticScore: normScore,
          lexicalScore: 0,
          rawSemanticScore: r.score,
          // carry through any preview fields from the engine result
          title: r.title,
          text: r.text,
          ...r,
        });
      }
    }

    // Normalize BM25 scores (arbitrary positive scale, TF-IDF-weighted)
    if (lexicalResults.length > 0) {
      const maxBm25 = lexicalResults[0].score || 1;
      const minBm25 = lexicalResults[lexicalResults.length - 1].score || 0;
      const rangeBm25 = maxBm25 - minBm25 || 1;

      for (const r of lexicalResults) {
        const normScore = (r.score - minBm25) / rangeBm25;
        const idStr = String(r.id);
        if (scoreMap.has(idStr)) {
          scoreMap.get(idStr).lexicalScore = normScore;
        } else {
          const meta = this.idToMeta ? this.idToMeta(r.id) : {};
          scoreMap.set(idStr, {
            id: r.id,
            semanticScore: 0,
            lexicalScore: normScore,
            rawSemanticScore: 0,
            title: meta.title || r.title || '',
            text: meta.text || r.text || '',
            ...meta,
          });
        }
      }
    }

    // Compute combined scores
    const merged = [...scoreMap.values()].map(r => ({
      ...r,
      score: semanticWeight * r.semanticScore + lexicalWeight * r.lexicalScore,
    }));

    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, topK);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _runBM25(queryText, topK) {
    if (!this.bm25) return [];
    try {
      const raw = this.bm25.search(queryText, topK);
      // wink-bm25 returns [[docIdx, score], ...]
      return raw.map(([docIdx, score]) => {
        const meta = this.idToMeta ? this.idToMeta(docIdx) : {};
        return {
          id: docIdx,
          score,
          title: meta.title || '',
          text: meta.text || '',
          ...meta,
        };
      });
    } catch (e) {
      console.warn('BM25 search error:', e);
      return [];
    }
  }

  _formatResults(results, topK, source) {
    return results.slice(0, topK).map(r => ({
      ...r,
      semanticScore: source === 'semantic' ? (r.score ?? 0) : 0,
      lexicalScore: source === 'lexical' ? (r.score ?? 0) : 0,
    }));
  }
}
