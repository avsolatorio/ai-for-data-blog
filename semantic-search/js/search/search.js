import bm25 from 'wink-bm25-text-search';
import similarity from 'compute-cosine-similarity';

console.log("Hello similarity...")
console.log(similarity)

console.log("Hello bm25...")
console.log(bm25)

export { bm25, similarity }