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
 *   → { type: 'search', text, topK?, ef?, ef_upper?, mode? }
 *   ← { type: 'results', data: [{id,score,title,text,...}], stats? }
 *
 *   → { type: 'embed', text }
 *   ← { type: 'embedding', data: Float32Array }
 *
 *   → { type: 'ping' }
 *   ← { type: 'pong' }  or  { type: 'loading' }
 *
 *   → { type: 'getRecent', limit? }
 *   ← { type: 'recent', data: [{id,idno,title,type,...}] }
 *
 *   → { type: 'searchCompare', text, topK?, ef? }
 *   ← { type: 'compare', hnsw: [...], flat: [...], recall: number, overlap: number }
 *   Runs both HNSW and flat (brute-force) search, returns both + recall@k overlap.
 *
 * Legacy compatibility: bare { text, ping } messages still handled.
 */

import {
  env,
  pipeline,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers";
import { l2NormalizeInPlace } from "./int8-codec.js";
import { fetchJson } from "./fetch-json.js";
import { FlatEngine } from "./flat-engine.js";
import { HNSWEngine } from "./hnsw-engine.js";

env.allowRemoteModels = true;

const DEFAULT_MODEL = "avsolatorio/GIST-small-Embedding-v0";

let extractor = null;
let manifest = null;
let baseUrl = "";
let searchEngine = null; // FlatEngine | HNSWEngine
let flatItems = null; // raw items array for BM25 (flat mode)
let titlesMap = null; // HNSW mode: {node_id_str: {title, idno, type, ...}}
let flatCompareEngine = null; // lazy-loaded FlatEngine for HNSW vs flat comparison
let isReady = false;

// ── Embedding ──────────────────────────────────────────────────────────────

async function loadModel(modelId) {
  self.postMessage({
    type: "progress",
    phase: "model",
    message: "Loading embedding model…",
  });
  try {
    extractor = await pipeline("feature-extraction", modelId || DEFAULT_MODEL, {
      dtype: "q8",
      device: "webgpu",
    });
  } catch (_) {
    extractor = await pipeline("feature-extraction", modelId || DEFAULT_MODEL, {
      dtype: "q8",
      device: "wasm",
    });
  }
  self.postMessage({
    type: "progress",
    phase: "model",
    message: "Embedding model ready",
  });
}

async function getEmbedding(text) {
  if (!extractor) throw new Error("Embedding model not loaded");
  // Match docs.html: model(tokenizer(text)) → sentence_embedding.data (closer to expected)
  const result = await extractor.model(extractor.tokenizer(text));
  const raw = new Float32Array(result.sentence_embedding.data);
  l2NormalizeInPlace(raw); // index stores L2-normalized vectors; cosine = dot product
  return raw;
}

// ── Index initialization ───────────────────────────────────────────────────

async function initIndex(manifestUrl) {
  self.postMessage({
    type: "progress",
    phase: "index",
    message: "Fetching index manifest…",
  });

  const resp = await fetch(manifestUrl);
  if (!resp.ok)
    throw new Error(
      `Failed to fetch manifest: ${manifestUrl} (HTTP ${resp.status})`,
    );
  manifest = await resp.json();

  baseUrl = manifestUrl.replace(/manifest\.json$/, "");
  if (!baseUrl.endsWith("/")) baseUrl += "/";

  if (manifest.search_mode === "flat") {
    self.postMessage({
      type: "progress",
      phase: "index",
      message: "Loading flat index…",
    });
    const engine = new FlatEngine();
    flatItems = await engine.load(baseUrl + manifest.flat.path);
    searchEngine = engine;
    // Send items to main thread for BM25 index construction (lexical.js)
    self.postMessage({ type: "bm25_init", items: flatItems, manifest });
  } else {
    // HNSW mode: load index + lightweight titles in parallel
    self.postMessage({
      type: "progress",
      phase: "index",
      message: "Loading HNSW index…",
    });
    const engine = new HNSWEngine();
    const titlesUrl = manifest.index?.titles
      ? baseUrl + manifest.index.titles
      : null;
    const [, titlesData] = await Promise.all([
      engine.init(baseUrl, { cacheName: "hnsw-shards-v1", manifest }),
      titlesUrl
        ? fetchJson(titlesUrl).catch(() => null)
        : Promise.resolve(null),
    ]);
    searchEngine = engine;
    titlesMap = titlesData; // {node_id_str: {title, idno, type, ...}} or null
    self.postMessage({ type: "bm25_init", items: [], manifest });
  }

  self.postMessage({
    type: "progress",
    phase: "index",
    message: "Index ready",
  });
}

// ── Initialization orchestration ───────────────────────────────────────────

async function init(manifestUrl, modelId) {
  try {
    // Load model and index in parallel (independent operations)
    await Promise.all([loadModel(modelId), initIndex(manifestUrl)]);

    isReady = true;
    self.postMessage({
      type: "ready",
      mode: manifest?.search_mode ?? "flat",
      config: manifest,
    });
  } catch (err) {
    console.error("[search.worker] Init error:", err);
    self.postMessage({ type: "error", message: err.message });
  }
}

// ── Message handler ─────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const data = e.data;

  // ── Legacy bare-message compatibility (old search.worker.js API) ──────
  if (data && typeof data === "object" && !data.type) {
    if (data.ping) {
      self.postMessage(isReady ? "pong" : "error");
      return;
    }
    if (data.text) {
      // Legacy: return embedding array (same as getEmbedding, L2-normalized)
      try {
        const emb = await getEmbedding(data.text);
        self.postMessage(Array.from(emb));
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
      case "init": {
        const { manifestUrl, modelId } = params;
        if (!manifestUrl)
          throw new Error("'init' message requires manifestUrl");
        await init(manifestUrl, modelId);
        break;
      }

      case "search": {
        const {
          text,
          topK = 20,
          ef = 50,
          ef_upper = 2,
          threshold = 0.0,
        } = params;
        if (!text) {
          self.postMessage({ type: "results", data: [] });
          break;
        }

        if (!isReady) {
          self.postMessage({
            type: "error",
            message: "Search engine not ready yet",
          });
          break;
        }

        const queryVec = await getEmbedding(text);
        let results;

        if (searchEngine instanceof FlatEngine) {
          results = searchEngine.search(queryVec, { topK, threshold });
        } else {
          // HNSW mode — enrich bare {id, score} results with display metadata
          const raw = await searchEngine.search(queryVec, {
            topK,
            ef,
            ef_upper,
          });
          results = titlesMap
            ? raw.map((r) => ({ ...(titlesMap[String(r.id)] ?? {}), ...r }))
            : raw;
        }

        self.postMessage({
          type: "results",
          data: results,
          stats: searchEngine.lastStats ?? null,
        });
        break;
      }

      case "embed": {
        const { text } = params;
        if (!extractor) {
          self.postMessage({ type: "error", message: "Model not ready" });
          break;
        }
        const emb = await getEmbedding(text);
        self.postMessage({ type: "embedding", data: emb }, [emb.buffer]);
        break;
      }

      case "ping": {
        self.postMessage({ type: isReady ? "pong" : "loading" });
        break;
      }

      case "getRecent": {
        const { limit = 10 } = params;
        if (!isReady) {
          self.postMessage({ type: "recent", data: [] });
          break;
        }
        let items = [];
        if (titlesMap && typeof titlesMap === "object") {
          items = Object.entries(titlesMap)
            .slice(0, limit)
            .map(([id, meta]) => ({ id: parseInt(id, 10), ...meta }));
        } else if (flatItems && Array.isArray(flatItems)) {
          items = flatItems.slice(0, limit).map((item, i) => ({
            id: item.id ?? i,
            idno: item.idno ?? item.id,
            title: item.title ?? "",
            type: item.type ?? "document",
            ...item,
          }));
        }
        self.postMessage({ type: "recent", data: items });
        break;
      }

      case "searchCompare": {
        const { text, topK = 20, ef = 50, ef_upper = 2 } = params;
        if (!text) {
          self.postMessage({
            type: "error",
            message: "searchCompare requires text",
          });
          break;
        }
        if (!isReady) {
          self.postMessage({
            type: "error",
            message: "Search engine not ready yet",
          });
          break;
        }
        if (!(searchEngine instanceof HNSWEngine)) {
          self.postMessage({
            type: "error",
            message: "searchCompare only supported in HNSW mode",
          });
          break;
        }

        const queryVec = await getEmbedding(text);

        // HNSW search
        const hnswRaw = await searchEngine.search(queryVec, {
          topK,
          ef,
          ef_upper,
        });
        const hnsw = titlesMap
          ? hnswRaw.map((r) => ({ ...(titlesMap[String(r.id)] ?? {}), ...r }))
          : hnswRaw;

        // Lazy-load flat index for comparison
        if (!flatCompareEngine) {
          const flatPath = manifest?.flat?.path;
          if (!flatPath) {
            self.postMessage({
              type: "error",
              message: "Manifest has no flat path for comparison",
            });
            break;
          }
          flatCompareEngine = new FlatEngine();
          await flatCompareEngine.load(baseUrl + flatPath);
        }

        const flat = flatCompareEngine.search(queryVec, { topK });

        // Compare by document id: flat uses id (string), HNSW uses idno (number) from titlesMap.
        // Normalize both to string for consistent comparison.
        const toDocId = (r) => {
          const v = r.idno ?? r.id;
          return v != null && v !== "" ? String(v) : "";
        };
        const flatIds = flat.map(toDocId).filter(Boolean);
        const hnswIds = hnsw.map(toDocId).filter(Boolean);
        const flatSet = new Set(flatIds);
        const hnswSet = new Set(hnswIds);
        const overlap = flatIds.filter((id) => hnswSet.has(id)).length;
        const recall = flat.length > 0 ? overlap / flat.length : 1;

        self.postMessage({
          type: "compare",
          hnsw,
          flat,
          recall,
          overlap,
          k: flat.length,
          debug: { query: text, flatIds, hnswIds },
        });
        break;
      }

      default:
        console.warn("[search.worker] Unknown message type:", type, data);
    }
  } catch (err) {
    console.error("[search.worker] Error handling message:", type, err);
    self.postMessage({
      type: "error",
      message: err.message,
      originalType: type,
    });
  }
};
