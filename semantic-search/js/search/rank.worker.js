// https://huggingface.co/jinaai/jina-reranker-v1-turbo-en
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
    if (e.data?.ping) {
      self.postMessage("pong"); // Responds to ping so Promise resolves
      return;
    }

    const { query, documents, top_k, return_documents } = e.data;

    const inputs = await tokenizer(
      new Array(documents.length).fill(query),
      { text_pair: documents, padding: true, truncation: true }
    );

    const { logits } = await model(inputs);

    const scores = logits.sigmoid().tolist().map(([score], i) => ({
      corpus_id: i,
      score,
      ...(return_documents ? { text: documents[i] } : {})
    })).sort((a, b) => b.score - a.score);

    self.postMessage(top_k ? scores.slice(0, top_k) : scores);
  } catch (err) {
    console.error("[Worker] Error during reranking:", err);
    self.postMessage([]);
  }
};
