// rank.worker.js
import { env, AutoTokenizer, XLMRobertaModel } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';

env.allowRemoteModels = true;

let model, tokenizer;

const model_id = 'jinaai/jina-reranker-v1-turbo-en';

async function init() {
  model = await XLMRobertaModel.from_pretrained(model_id, { quantized: true });
  tokenizer = await AutoTokenizer.from_pretrained(model_id);
  console.log("[Worker] Model and tokenizer loaded");
}

await init();

self.onmessage = async (e) => {
  try {
    const { query, documents, top_k = 3 } = e.data;

    console.log("[Worker] Received rerank task");

    const inputs = tokenizer(
      new Array(documents.length).fill(query),
      { text_pair: documents, padding: true, truncation: true }
    );

    const { logits } = await model(inputs);

    const results = logits.sigmoid().tolist().map(([score], i) => ({
      corpus_id: i,
      score
    })).sort((a, b) => b.score - a.score);

    self.postMessage(results.slice(0, top_k));
  } catch (err) {
    console.error("[Worker] Rerank error:", err);
    self.postMessage([]);
  }
};
