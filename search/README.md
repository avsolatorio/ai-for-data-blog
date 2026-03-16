# Browser-Native Semantic Search — Developer Guide

A fully client-side semantic search engine: vector embeddings run in a Web
Worker, the HNSW graph is sharded across lazy-loaded JSON files, and BM25
keyword search is available immediately while the ONNX model loads. No backend
required.

**Stack:** Vite 6 · Vue 3 · Vuetify 3 · TypeScript · `@huggingface/transformers` v3 · wink-bm25-text-search

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Hosting Modes](#hosting-modes)
5. [Python Pipeline](#python-pipeline)
6. [Frontend Architecture](#frontend-architecture)
   - [TypeScript engine modules](#typescript-engine-modules)
   - [Vue components and composables](#vue-components-and-composables)
   - [Worker message protocol](#worker-message-protocol)
   - [BM25 fallback behavior](#bm25-fallback-behavior)
7. [Build and Deploy](#build-and-deploy)
   - [Local development](#local-development)
   - [Static build (GitHub Pages)](#static-build-github-pages)
   - [Server build with gzip compression](#server-build-with-gzip-compression)
   - [GitHub Actions example](#github-actions-example)
8. [Configuration](#configuration)
   - [manifest.json format](#manifestjson-format)
   - [URL parameters](#url-parameters)
   - [Cache versioning](#cache-versioning)
9. [Key Design Decisions](#key-design-decisions)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The search suite has two independent parts:

| Part | Location | Language |
|---|---|---|
| Python pipeline | `pipeline/` | Python 3 + uv |
| Browser frontend | `src/` + `server/` | TypeScript + Vue 3 |

The pipeline ingests documents, encodes them with a sentence-transformers
model, builds a sharded HNSW index, and writes a `manifest.json` that the
browser uses as its entry point.

The frontend loads the manifest in a Web Worker, downloads only the index
shards needed for each query (typically 3–4 shards, ~400 KB cold), and returns
results in milliseconds. BM25 keyword search is available instantly; semantic
search activates once the ONNX model has loaded (~30–60 s on first visit,
cached by the browser thereafter).

---

## Quick Start

```bash
# 1. Install Node dependencies
cd search
npm install

# 2. Run the pipeline (requires uv — see pipeline/README.md for full options)
cd ..
uv run python search/pipeline/pipeline.py prwp \
  --source=worldbank_api \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --output_dir=search/data/prwp \
  --compress=none

# 3. Start the Vite dev server
cd search
npm run dev
# Open http://localhost:5173/?manifest=../data/prwp/manifest.json
```

---

## Project Structure

```
search/
├── index.html                  # Vite entry point
├── vite.config.ts              # Build config (chunks, worker format, SCSS)
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main.ts                 # App bootstrap (Vue + Vuetify)
│   ├── App.vue                 # Root component
│   ├── components/
│   │   └── SearchStatus.vue    # Loading/status indicator
│   ├── composables/
│   │   ├── useSearchWorker.ts  # Worker lifecycle + typed event bus
│   │   └── useVoiceSearch.ts   # Web Speech API integration
│   ├── engine/                 # Pure-TS search engine modules (no Vue)
│   │   ├── fetch-json.ts       # Cache-aware JSON fetch helper
│   │   ├── int8-codec.ts       # INT8 quantization / L2 normalization
│   │   ├── shard-loader.ts     # On-demand HNSW shard fetcher
│   │   ├── flat-engine.ts      # Brute-force INT8 engine (small collections)
│   │   ├── hnsw-engine.ts      # Sharded HNSW beam search
│   │   └── hybrid-search.ts    # Semantic + BM25 score fusion
│   ├── workers/
│   │   ├── search.worker.ts    # Unified embedding + search worker
│   │   └── rank.worker.ts      # Optional reranking worker
│   ├── types/
│   │   ├── manifest.ts         # CollectionManifest and index config types
│   │   ├── search.ts           # SearchResult, SearchOptions, engine interface
│   │   └── worker.ts           # Discriminated-union worker message types
│   ├── utils/
│   │   └── format.ts           # Display formatting helpers
│   └── styles/                 # SCSS partials + variables
│
├── server/
│   ├── server.ts               # Express server for gzip-compressed indexes
│   ├── service-worker.js       # Cache-first SW for HNSW shards
│   └── README.md               # Server-mode detail
│
├── public/
│   └── service-worker.js       # SW deployed to site root
│
├── pipeline/                   # Python pipeline scripts
│   ├── 01_fetch_and_prepare.py
│   ├── 02_generate_embeddings.py
│   ├── 03_build_index.py
│   ├── decompress_for_github_pages.py
│   ├── pipeline.py             # End-to-end orchestrator
│   └── README.md               # Pipeline documentation (full reference)
│
└── data/                       # Generated index files (git-ignored by default)
    └── prwp/
        ├── manifest.json
        ├── flat/
        └── index/
```

---

## Hosting Modes

| Mode | Command | Index format | Use case |
|---|---|---|---|
| Vite dev server | `npm run dev` | Plain `.json` (via `--compress=none`) | Local development |
| GitHub Pages | `npm run build:gh` | Plain `.json` (via `--compress=none`) | Free static hosting |
| Express server | `npm run serve` | `.json.gz` (default pipeline output) | Self-hosted / Node |
| nginx / Caddy | `npm run build` | `.json.gz` with `gzip_static on` | Production |

GitHub Pages cannot serve `.json.gz` files with correct `Content-Encoding:
gzip` headers. Use `--compress=none` in the pipeline, or run
`decompress_for_github_pages.py` after a gzip build. See
[pipeline/README.md](pipeline/README.md) for details.

---

## Python Pipeline

The pipeline is documented in detail in [pipeline/README.md](pipeline/README.md).

**Quick reference:**

```bash
# Install uv (once)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Full pipeline (fetch → embed → index) from the repo root
export PATH="$HOME/.local/bin:$PATH"
uv run python search/pipeline/pipeline.py prwp \
  --source=worldbank_api \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --output_dir=search/data/prwp \
  --compress=none       # for GitHub Pages
  # --compress=gzip     # for the Express server or nginx

# Re-index only (skip fetch and embed)
uv run python search/pipeline/pipeline.py prwp \
  --skip_fetch --skip_embed \
  --output_dir=search/data/prwp \
  --compress=none
```

The pipeline writes a `manifest.json` that the browser worker fetches first to
determine the search mode (`flat` or `hnsw`) and the paths of all index files.

---

## Frontend Architecture

### TypeScript engine modules

All search logic lives in `src/engine/` and is framework-agnostic — these
modules are imported by the worker, never by Vue components.

| Module | Responsibility |
|---|---|
| `int8-codec.ts` | INT8 dequantization, dot-product scoring, L2 normalization |
| `fetch-json.ts` | `fetch` wrapper that reads/writes the Cache Storage API |
| `shard-loader.ts` | Loads HNSW layer-0 shards on demand; caches in-memory + Cache API |
| `flat-engine.ts` | Brute-force INT8 cosine search over a single flat index file |
| `hnsw-engine.ts` | Sharded HNSW beam search: upper layers loaded at init, layer-0 on demand |
| `hybrid-search.ts` | Min-max normalisation + linear blend of semantic and BM25 scores |

**Hybrid scoring** (default mode):

```
score = 0.7 × norm(semantic) + 0.3 × norm(BM25)
```

Both scores are min-max normalised over the candidate set before blending.
Weights are configurable via `HybridSearchOptions`.

**Engine selection** is automatic: `flat` mode for collections at or below
`flat_threshold` (default 2,000 documents), `hnsw` mode for larger
collections. The manifest's `search_mode` field records the choice.

### Vue components and composables

| File | Role |
|---|---|
| `App.vue` | Root: reads `?manifest=` and `?model=` URL params, instantiates worker |
| `components/SearchStatus.vue` | Progress indicator during two-phase worker init |
| `composables/useSearchWorker.ts` | Worker lifecycle: spawn, init, typed event bus, teardown |
| `composables/useVoiceSearch.ts` | Web Speech API — fills the search input from microphone |

`useSearchWorker` exposes a typed `.on(type, handler)` event bus so components
can subscribe to specific message types without a global state store:

```ts
const worker = useSearchWorker('../data/prwp/manifest.json')

const unsubscribe = worker.on('results', (msg) => {
  results.value = msg.data
  isFallback.value = msg.fallback ?? false
})
onUnmounted(unsubscribe)
```

Reactive refs provided by the composable:

| Ref | Type | Description |
|---|---|---|
| `isIndexReady` | `boolean` | Index + BM25 loaded; lexical search available |
| `isModelReady` | `boolean` | ONNX model loaded; semantic search available |
| `loadingMessage` | `string` | Latest progress message from the worker |
| `activeFallback` | `boolean` | Last search used BM25 fallback (model not ready) |
| `manifest` | `CollectionManifest \| null` | Parsed manifest, available after `ready` |

### Worker message protocol

Messages use TypeScript discriminated unions defined in `src/types/worker.ts`.

**Inbound (main thread → worker):**

| `type` | When to send | Key fields |
|---|---|---|
| `init` | On startup | `manifestUrl` (absolute URL), `modelId?` |
| `search` | User types | `text`, `topK?`, `ef?`, `mode?` (`semantic`/`lexical`/`hybrid`) |
| `embed` | Standalone embedding | `text` |
| `getRecent` | Pre-search state | `limit?` |
| `searchCompare` | Recall testing | `text`, `topK?` |
| `ping` | Health check | — |

**Outbound (worker → main thread):**

| `type` | When emitted | Key fields |
|---|---|---|
| `progress` | During init | `phase` (`model`/`index`), `message` |
| `index_ready` | Index + BM25 loaded | `bm25Ready` |
| `ready` | Model + index both ready | `mode`, `config` (manifest) |
| `results` | After `search` | `data`, `stats?`, `fallback?` |
| `embedding` | After `embed` | `data` (Float32Array) |
| `recent` | After `getRecent` | `data` |
| `compare` | After `searchCompare` | `hnsw`, `flat`, `recall`, `overlap` |
| `error` | Any failure | `message`, `originalType?` |
| `pong` | After `ping` | — |

> **Important:** `manifestUrl` in the `init` message must be an absolute URL.
> `useSearchWorker` resolves it automatically via
> `new URL(url, location.href).href` before posting.

### BM25 fallback behavior

The worker starts two phases in parallel:

1. **Phase 1 (fast):** Fetch manifest → load index files → build BM25 from
   `bm25_corpus.json` → emit `index_ready`. Typical time: 1–3 s (warm cache).

2. **Phase 2 (slow):** Download ONNX model → emit `ready`. Typical time:
   30–60 s on first visit (model is ~90 MB); near-instant on repeat visits
   (browser cache).

Between `index_ready` and `ready`, any `search` with `mode: 'semantic'` or
`mode: 'hybrid'` transparently falls back to BM25. The `results` message
carries `fallback: true` so the UI can show an indicator. Once the model is
ready the behaviour switches automatically — no reconnect required.

---

## Build and Deploy

### Local development

```bash
cd search
npm install
npm run dev
# App: http://localhost:5173/?manifest=../data/prwp/manifest.json
```

Vite serves the app with HMR. The worker is compiled automatically because
`worker.format` is `'es'` in `vite.config.ts`.

### Static build (GitHub Pages)

Build the pipeline with `--compress=none`, then:

```bash
# Build for a GitHub Pages project page (repo lives at /ai-for-data-blog/)
cd search
npm run build:gh    # sets VITE_BASE_URL=/ai-for-data-blog/

# Or for a root-level Pages site:
npm run build       # VITE_BASE_URL defaults to /
```

The built app lands in `dist/`. Commit `dist/` (or configure Pages to serve
from it) along with the `data/` directory.

The `build:gh` script is equivalent to:

```bash
VITE_BASE_URL=/ai-for-data-blog/ npm run build
```

For any other base path, set `VITE_BASE_URL` directly:

```bash
VITE_BASE_URL=/my-project/ npm run build
```

### Server build with gzip compression

```bash
# 1. Build index with compression (default)
uv run python search/pipeline/pipeline.py prwp \
  --output_dir=search/data/prwp \
  --compress=gzip

# 2. Build the Vite app
cd search
npm run build

# 3. Start the Express server (handles .json.gz headers)
npm run serve
# App: http://localhost:3000/?manifest=data/prwp/manifest.json
```

Server environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port |
| `DIST_DIR` | `../dist` | Path to built Vite output |
| `DATA_DIR` | `../data` | Path to pipeline data directory |

See [server/README.md](server/README.md) for nginx and Caddy equivalents using
`gzip_static`.

### GitHub Actions example

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Node deps
        run: npm ci
        working-directory: search

      - name: Build
        run: npm run build:gh
        working-directory: search

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: search/dist
          # Copy data/ so the app can reach ?manifest=data/prwp/manifest.json
          # Alternatively, commit data/ to the Pages branch separately.
```

> The pipeline step (embedding generation) is typically run locally and the
> resulting `data/` directory is committed, because encoding 10,000+ documents
> can take 20–30 minutes even on a fast CPU.

---

## Configuration

### manifest.json format

The manifest is written by `03_build_index.py` and is the worker's entry point.

```jsonc
{
  "version": "1",
  "collection_id": "prwp",
  "n_items": 10942,
  "embedding_dim": 512,
  "matryoshka_dim": null,
  "quant": "int8",
  "model_id": "avsolatorio/GIST-small-Embedding-v0",
  "search_mode": "hnsw",          // "flat" for collections ≤ flat_threshold
  "compressed": false,            // true when index files are .json.gz
  "flat": {
    "path": "flat/embeddings.int8.json"
  },
  "index": {
    "path": "index/",
    "config": "index/config.json",
    "upper_layers": "index/upper_layers.json",
    "node_to_shard": "index/node_to_shard.json",
    "cluster_centroids": "index/cluster_centroids.json",
    "titles": "index/titles.json",
    "bm25_corpus": "index/bm25_corpus.json"
  },
  "thresholds": { "flat_max": 2000 },
  "preview_fields": ["idno", "title", "abstract", "type", "doi"],
  "bm25_fields": ["title", "abstract"]
}
```

Key fields:

| Field | Description |
|---|---|
| `search_mode` | `"flat"` (brute-force) or `"hnsw"` (sharded graph) |
| `compressed` | `true` = files end in `.json.gz`; `false` = plain `.json` |
| `index.bm25_corpus` | Path to the BM25 text corpus; omit to disable BM25 |
| `preview_fields` | Fields kept in `titles.json` for result display |
| `matryoshka_dim` | Non-null only for MRL models (e.g. `nomic-embed-text-v1.5`) |

### URL parameters

| Parameter | Example | Description |
|---|---|---|
| `?manifest=` | `?manifest=data/prwp/manifest.json` | Path or URL to the collection manifest |
| `?model=` | `?model=avsolatorio/GIST-small-Embedding-v0` | HuggingFace model ID (overrides manifest) |

Both parameters are read by `App.vue` and forwarded to `useSearchWorker`.
Relative manifest paths are resolved against `location.href` before being sent
to the worker.

### Cache versioning

Two constants must stay in sync when the index format changes:

| File | Constant | Default |
|---|---|---|
| `public/service-worker.js` | `CACHE_NAME` | `'hnsw-shards-v1'` |
| `src/workers/search.worker.ts` | `CACHE_NAME` | `'hnsw-shards-v1'` |

Bumping `CACHE_NAME` in both files causes the service worker to evict all
cached shards from the previous build on the next page load. Change it
whenever you rebuild the index with a different model, shard count, or schema.

---

## Key Design Decisions

**No bundled ONNX model.** The model is fetched at runtime from HuggingFace
Hub (or a self-hosted mirror). This keeps the initial page bundle small
(~500 KB gzip) while the model (~90 MB) is only downloaded once and cached
by the browser.

**INT8 quantization.** Vectors are stored as signed 8-bit integers with a
per-vector scale factor. This gives a ~4× size reduction vs. float32 with
minimal recall loss. Dequantization and dot-product scoring are implemented
in `int8-codec.ts` using plain TypeScript loops (no WASM required).

**Sharded HNSW.** Layer-0 (the dense base layer) is split into one shard per
cluster. A query fetches only the 3–4 shards reachable from the beam search
path, reducing cold-start bandwidth to ~400–500 KB. Upper layers are small
(~250 KB gzip) and fetched once at init.

**Two-phase worker init.** BM25 is immediately useful for keyword search and
requires no ONNX model. Emitting `index_ready` as soon as the corpus is
indexed lets the UI become interactive within seconds.

**Service worker caching.** Downloaded shards are stored in Cache Storage
under `CACHE_NAME`. Repeat queries against already-seen clusters are served
entirely from cache. The service worker also handles offline gracefully,
returning a structured 503 JSON error rather than a generic network failure.

For pipeline-specific decisions (HNSW build parameters, clustering strategy,
quantization details) see [pipeline/README.md](pipeline/README.md).

---

## Troubleshooting

### Model not loading

**Symptom:** Search stays in BM25 fallback indefinitely; console shows a CORS
or network error from `huggingface.co`.

**Fix:** The ONNX model is fetched from HuggingFace Hub at runtime. If the
Hub is blocked in your environment, `search.worker.ts` automatically falls
back from WebGPU to WASM. For fully offline or firewalled deployments, mirror
the model files to your own server and pass its URL via `?model=https://...`.

The worker's fallback sequence is:

```
WebGPU (dtype: 'q8') → WASM (dtype: 'q8') → error
```

---

### GitHub Pages 404 or 500 for `.json.gz` files

**Symptom:** Searching returns no results; browser DevTools shows 404 or 500
on `shard_NNN.json.gz` or `upper_layers.json.gz`.

**Cause:** GitHub Pages does not serve pre-compressed files with the correct
`Content-Encoding: gzip` headers.

**Fix A (simplest):** Rebuild the index with `--compress=none`:

```bash
uv run python search/pipeline/pipeline.py prwp \
  --output_dir=search/data/prwp \
  --compress=none
```

**Fix B:** Keep the gzip build and decompress for Pages:

```bash
uv run python search/pipeline/decompress_for_github_pages.py \
  --output_dir=search/data/prwp
```

This updates `manifest.json` to reference `.json` paths and removes the `.gz`
files.

---

### Service worker cache is stale after rebuilding the index

**Symptom:** Old results appear after deploying a new index; hard-refreshing
the page fixes it temporarily.

**Fix:** Bump `CACHE_NAME` in both files to the same new value:

```
public/service-worker.js          CACHE_NAME = 'hnsw-shards-v2'
src/workers/search.worker.ts      CACHE_NAME = 'hnsw-shards-v2'
```

On next page load the service worker activates, deletes the old cache, and
fetches fresh shards.

---

### Manifest URL fails to resolve in the worker

**Symptom:** Worker logs `Failed to fetch manifest: ... (HTTP 404)` even
though the file exists.

**Cause:** Workers do not inherit `document.baseURI`. A relative path like
`data/prwp/manifest.json` resolves against the worker script URL, not the
page URL.

**Fix:** `useSearchWorker` already resolves the manifest path to an absolute
URL via:

```ts
new URL(manifestUrl, globalThis.location?.href ?? 'http://localhost/').href
```

If you instantiate the worker manually (outside `useSearchWorker`), apply the
same resolution before sending the `init` message.

---

### TypeScript errors after changing worker message types

Changing a message interface in `src/types/worker.ts` will surface type errors
in both `search.worker.ts` (outbound messages) and `useSearchWorker.ts`
(inbound message handler). Run:

```bash
npm run typecheck
```

to see all errors at once before building.
