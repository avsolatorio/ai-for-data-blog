/**
 * int8-codec.js
 * Hot-path codec for SQ8 (per-vector symmetric int8) quantization.
 * No dependencies. Works in both Worker and main thread contexts.
 *
 * Quantization scheme (from Python pipeline):
 *   scale = max(|vec|) / 127
 *   qv[i] = round(vec[i] / scale), clipped to [-127, 127]
 *
 * Recovery:
 *   vec[i] ≈ qv[i] * scale
 *
 * Cosine similarity via dot product (vectors are L2-normalized before quantization):
 *   cosineSim(a, b) ≈ dotProductMixed(queryF32, storedQV, storedScale)
 */

/**
 * Compute dot product between a float32 query vector and a stored int8 vector.
 * This is the hot path during HNSW beam search — avoids allocating a new Float32Array.
 *
 * @param {Float32Array} queryF32 - L2-normalized query vector
 * @param {Array<number>|Int8Array} storedQV - int8 quantized stored vector
 * @param {number} storedScale - per-vector scale factor
 * @returns {number} approximate cosine similarity in [-1, 1]
 */
export function dotProductMixed(queryF32, storedQV, storedScale) {
  let dot = 0.0;
  const len = queryF32.length;
  for (let i = 0; i < len; i++) {
    dot += queryF32[i] * (storedQV[i] * storedScale);
  }
  return dot;
}

/**
 * Dequantize an int8 vector back to float32.
 * Use this when you need the full vector (e.g. for reranking), not for search hot path.
 *
 * @param {Array<number>|Int8Array} qv - int8 quantized vector
 * @param {number} scale - per-vector scale factor
 * @returns {Float32Array}
 */
export function dequantize(qv, scale) {
  const out = new Float32Array(qv.length);
  for (let i = 0; i < qv.length; i++) {
    out[i] = qv[i] * scale;
  }
  return out;
}

/**
 * L2-normalize a Float32Array in-place. Required before passing a query
 * embedding to the search engine (cosine similarity via dot product).
 *
 * @param {Float32Array} vec - vector to normalize (modified in place)
 * @returns {Float32Array} the same vector, normalized
 */
export function l2NormalizeInPlace(vec) {
  let norm = 0.0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm < 1e-9) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

/**
 * Convert a plain JS Array of int8 values to Int8Array for faster typed access.
 * Call once when loading a shard to speed up subsequent dotProductMixed calls.
 *
 * @param {Array<number>} arr
 * @returns {Int8Array}
 */
export function toInt8Array(arr) {
  return new Int8Array(arr);
}
