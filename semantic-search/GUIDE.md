# Browser-Native Semantic Search — Developer Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Python Pipeline](#3-python-pipeline)
   - [01_fetch_and_prepare.py](#01_fetch_and_preparepy)
   - [02_generate_embeddings.py](#02_generate_embeddingspy)
   - [03_build_index.py](#03_build_indexp)
   - [pipeline.py](#pipelinepy)
4. [Index File Format](#4-index-file-format)
5. [JavaScript Modules](#5-javascript-modules)
   - [int8-codec.js](#int8-codecjs)
   - [fetch-json.js](#fetch-jsonjs)
   - [shard-loader.js](#shard-loaderjs)
   - [flat-engine.js](#flat-enginejs)
   - [hnsw-engine.js](#hnsw-enginejs)
   - [hybrid-search.js](#hybrid-searchjs)
   - [search.worker.js](#searchworkerjs)
   - [service-worker.js](#service-workerjs)
6. [Apps](#6-apps)
   - [app.html](#apphtml)
   - [test-hnsw-search.html](#test-hnsw-searchhtml)
   - [test-hnsw-vs-flat.html](#test-hnsw-vs-flathtml)
7. [Bandwidth and Performance](#7-bandwidth-and-performance)
8. [Key Design Decisions](#8-key-design-decisions)
9. [Extending to a New Collection](#9-extending-to-a-new-collection)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

This system is a **fully browser-native semantic search engine** — no backend server, no API calls at query time, no Python in production. A user opens a static HTML file and can perform sub-second approximate nearest-neighbor search over tens of thousands of documents using an embedding model that runs entirely inside their browser via WebAssembly or WebGPU.

### What it does

- Ingests documents from various sources (World Bank API, Excel/CSV, JSON).
- Encodes documents with a sentence-transformer model and quantizes the resulting embeddings to int8.
- Builds a sharded HNSW graph and exports it as a collection of small JSON files.
- Serves the JSON files as static assets — any CDN or `python -m http.server` works.
- Loads a quantized ONNX embedding model in the browser (via Transformers.js) and runs HNSW beam search by lazily fetching only the shard files needed for each query.
- Supports semantic-only, keyword-only (BM25), and hybrid search modes.
- Supports an optional cross-encoder reranker pass.

### Key design decisions at a glance

| Decision | Choice | Rationale |
|---|---|---|
| Quantization | SQ8 per-vector int8 | 4x compression, < 0.001 cosine error, trivial to decode in JS |
| Sharding strategy | K-Means cluster assignment | Semantically related nodes share a shard, 2-4 fetches/query |
| Upper-layer loading | Eager at init | ~5% of nodes, tiny footprint, eliminates cold-start for greedy descent |
| Flat vs HNSW routing | Threshold on `n_items` | Small collections brute-force faster; large ones need ANN |
| Titles file | Separate `titles.json` | Lightweight display metadata avoids loading the 44 MB flat file in HNSW mode |
| Embedding model | GIST-small-Embedding-v0 | 384-dim, small quantized ONNX (~30 MB), high quality |

### High-level architecture

```
+---------------------------------------------------------------------+
|                         PYTHON PIPELINE (offline)                   |
|                                                                     |
|  01_fetch_and_prepare.py                                            |
|    +-- metadata.json (id, title, abstract, content, ...)           |
|            |                                                        |
|  02_generate_embeddings.py                                          |
|    +-- raw_embeddings.npy  (float32, L2-normalized)                |
|    +-- flat/embeddings.int8.json(.gz)  (brute-force index)        |
|            |                                                        |
|  03_build_index.py                                                  |
|    +-- manifest.json                                                |
|    +-- index/                                                       |
|         +-- config.json(.gz)                                       |
|         +-- upper_layers.json(.gz)   (~835 KB → ~200 KB gzip)     |
|         +-- node_to_shard.json(.gz)  (~107 KB)                     |
|         +-- cluster_centroids.json(.gz)                            |
|         +-- titles.json(.gz)         (~1.4 MB)                     |
|         +-- layer0/                                                 |
|              +-- shard_000.json(.gz)  (~128 KB avg → ~35 KB gzip)  |
|              +-- ... (110 shards for PRWP)                         |
+---------------------------------------------------------------------+
                              | static file hosting
                              v
+---------------------------------------------------------------------+
|                         BROWSER (runtime)                           |
|                                                                     |
|  app.html                                                           |
|   +-- Vue 3 + Vuetify UI                                           |
|   +-- search.worker.js  (Web Worker)                               |
|   |    +-- Transformers.js v3  (ONNX embedding model)              |
|   |    +-- hnsw-engine.js  (or flat-engine.js)                     |
|   |    |    +-- shard-loader.js  (3-tier cache)                    |
|   |    |    +-- int8-codec.js   (dot product hot path)             |
|   |    +-- hybrid-search.js  (BM25 + semantic merge)               |
|   +-- service-worker.js  (Cache API interceptor)                   |
+---------------------------------------------------------------------+
```

---

## 2. Quick Start

### Prerequisites

```bash
pip install fire requests numpy sentence-transformers faiss-cpu pandas openpyxl
# or via the project's pyproject.toml
pip install -e .
```

A static file server (for the browser app):

```bash
pip install --upgrade "python-http-server"
# or simply: python -m http.server 8000
```

### Full pipeline for the PRWP collection

```bash
cd semantic-search/notebooks/pipeline

# Step 1: fetch ~10,000 Policy Research Working Papers from the World Bank API
python 01_fetch_and_prepare.py \
  --source=worldbank_api \
  --doctype="Policy Research Working Paper" \
  --output_dir=../../data/prwp \
  --content_fields="title,abstract" \
  --preview_fields="idno,title,abstract,type,doi,url,date_published"

# Step 2: generate embeddings and quantize to int8
python 02_generate_embeddings.py \
  --metadata_path=../../data/prwp/metadata.json \
  --output_dir=../../data/prwp \
  --model=avsolatorio/GIST-small-Embedding-v0

# Step 3: build the sharded HNSW index (default: gzip compression)
python 03_build_index.py \
  --output_dir=../../data/prwp \
  --collection_id=prwp \
  --model_id=avsolatorio/GIST-small-Embedding-v0

# Disable compression: --compress=none

# Or use the orchestrator (runs all three steps):
python pipeline.py prwp \
  --source=worldbank_api \
  --doctype="Policy Research Working Paper" \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --output_dir=../../data/prwp

# Serve the app
cd ../../
python -m http.server 8000
# Open http://localhost:8000/app.html
```

---

## 3. Python Pipeline

All four scripts live in `notebooks/pipeline/` and use [python-fire](https://github.com/google/python-fire) for CLI argument parsing.

### `01_fetch_and_prepare.py`

**Purpose:** Ingests documents from a supported source and writes a normalized `metadata.json` ready for step 2.

#### Supported sources

| `--source` value | Description |
|---|---|
| `worldbank_api` | Paginates the World Bank Document Search API (`/api/v2/wds`). Supports `--doctype` to filter by document type (e.g., "Policy Research Working Paper"). |
| `excel` | Reads `.xlsx` or `.csv` files with `pandas`. Requires `--input_file`. Supports `--sheet_name` for multi-sheet workbooks. |
| `json` | Reads a JSON array or dict-of-records file. Supports NDJSON-style. Requires `--input_file`. |

#### Output

A single file: `<output_dir>/metadata.json` — a JSON array of objects. Every record has at minimum:
- `id` — string identifier
- `content` — the text that will be embedded (concatenation of `content_fields`)
- All fields listed in `preview_fields`

Records with empty `content` are filtered out before writing.

#### All CLI flags

| Flag | Default | Description |
|---|---|---|
| `--source` | `worldbank_api` | Source type: `worldbank_api`, `excel`, or `json` |
| `--output_dir` | `data/collection` | Directory for output files |
| `--doctype` | `"Policy Research Working Paper"` | World Bank API document type filter |
| `--max_docs` | `0` (all) | Maximum number of documents to fetch (API source only) |
| `--input_file` | `None` | Path to Excel/CSV/JSON input file (required for `excel` and `json`) |
| `--sheet_name` | `None` | Sheet name for Excel files |
| `--id_field` | `idno` | Column/field name to use as the document identifier |
| `--content_fields` | `"title,abstract"` | Comma-separated field names to concatenate for the embedding text |
| `--preview_fields` | `"idno,title,abstract,type,doi,url,date_published"` | Comma-separated fields to include in the output metadata |

#### Example: WDI indicators from Excel

```bash
python 01_fetch_and_prepare.py \
  --source=excel \
  --input_file=data/WDIEXCEL.xlsx \
  --sheet_name=Series \
  --id_field="Series Code" \
  --content_fields="Indicator Name,Long definition,Short definition" \
  --preview_fields="Series Code,Indicator Name,Long definition,Short definition,Source" \
  --output_dir=data/wdi
```

---

### `02_generate_embeddings.py`

**Purpose:** Encodes documents (or loads pre-computed embeddings), applies L2 normalization, optionally truncates dimensions (Matryoshka), applies SQ8 int8 quantization, validates quality, and writes two output files.

#### Input options

**Option A — from `metadata.json`** (produced by step 1):

```bash
python 02_generate_embeddings.py \
  --metadata_path=data/prwp/metadata.json \
  --output_dir=data/prwp \
  --model=avsolatorio/GIST-small-Embedding-v0
```

The script loads the model with `sentence-transformers`, concatenates `title_field + "\n\n" + content_field` for each document, and calls `model.encode()`.

**Option B — from pre-computed float32 embeddings**:

```bash
python 02_generate_embeddings.py \
  --embeddings_path=data/avsolatorio__GIST-small-Embedding-v0__doc_embeddings.json \
  --output_dir=data/prwp \
  --id_field=idno \
  --content_field=abstract \
  --title_field=title \
  --preview_fields=idno,title,abstract,type,doi
```

The input JSON must be an array of objects, each with an `embedding` key (or whichever `--embedding_field` specifies) containing a float32 list.

#### SQ8 quantization

Each vector is quantized independently:

```
scale = max(|vec|) / 127
qv[i] = round(vec[i] / scale)  clipped to [-127, 127]
```

This is **per-vector symmetric int8** — not product quantization. Benefits:
- 4x size reduction (float32 -> int8)
- Simple decode: `vec[i] = qv[i] * scale`
- Validated cosine similarity error: typically < 0.001 (minimum cosine sim > 0.999 on PRWP)

The validation step asserts `min_cosine_sim > 0.98` on a random sample of 500 vectors. If this fails, the pipeline aborts.

#### Matryoshka support

For models trained with Matryoshka Representation Learning (e.g., `nomic-ai/nomic-embed-text-v1.5`), you can truncate embedding dimensions to reduce index size and search cost:

```bash
python 02_generate_embeddings.py \
  --metadata_path=data/prwp/metadata.json \
  --output_dir=data/prwp \
  --model=nomic-ai/nomic-embed-text-v1.5 \
  --matryoshka_dim=128
```

**Do not** set `--matryoshka_dim` for models not trained with MRL (such as GIST-small-Embedding-v0). The script validates truncation quality and warns if `min_cosine_sim < 0.85`.

#### Output files

| File | Description |
|---|---|
| `<output_dir>/raw_embeddings.npy` | Float32 array, shape `[N, D]`, L2-normalized. Input to step 3. |
| `<output_dir>/metadata.json` | Normalized metadata array with `id`, `title`, `text`, and preview fields. Overwrites the step-1 file with a standardized schema. |
| `<output_dir>/flat/embeddings.int8.json` | Complete flat brute-force index in int8. Used for small collections and as a fallback. |

#### All CLI flags

| Flag | Default | Description |
|---|---|---|
| `--metadata_path` | `None` | Path to `metadata.json` from step 1 (use this OR `--embeddings_path`) |
| `--embeddings_path` | `None` | Path to pre-computed embedding JSON (use this OR `--metadata_path`) |
| `--output_dir` | `data/collection` | Directory for output files |
| `--model` | `avsolatorio/GIST-small-Embedding-v0` | HuggingFace model ID (only used with `--metadata_path`) |
| `--batch_size` | `64` | Batch size for `model.encode()` |
| `--id_field` | `idno` | Field name used as document identifier |
| `--content_field` | `abstract` | Field name for main content text |
| `--title_field` | `title` | Field name for title |
| `--embedding_field` | `embedding` | Field name for embeddings (pre-computed input only) |
| `--preview_fields` | `"idno,title,abstract,type,doi"` | Comma-separated fields to carry through |
| `--matryoshka_dim` | `None` | Dimension to truncate to (MRL models only) |
| `--bm25_text_field` | `abstract` | Field stored as `text` in the flat index for BM25 |
| `--bm25_title_field` | `title` | Field stored as `title` in the flat index |
| `--seed` | `42` | Random seed for validation sampling |

---

### `03_build_index.py`

**Purpose:** Takes the normalized embeddings from step 2, builds a sharded HNSW index using FAISS, and exports everything as browser-loadable JSON files.

#### Processing steps

**1. Mode decision**

If `n_items <= flat_threshold` (default 2000), the script skips HNSW entirely and writes a `manifest.json` pointing to the flat index already built in step 2. This is appropriate for small collections like WDI indicators (~1,500 items).

**2. K-Means clustering (shard assignment)**

```python
n_clusters = max(10, int(sqrt(n_items)))  # if not overridden
kmeans = faiss.Kmeans(dim, n_clusters, niter=30, seed=42)
kmeans.train(embeddings_norm)
cluster_ids = kmeans.index.search(embeddings_norm, 1)
```

Each node is assigned to the cluster whose centroid is nearest. Because the cluster assignment mirrors the HNSW graph's local neighborhood structure, most layer-0 neighbors of any given node belong to the same or adjacent clusters. This means the beam search needs only 2-4 shard fetches per query instead of 10-15.

**3. HNSW index build**

```python
hnsw_index = faiss.IndexHNSWFlat(dim, hnsw_M, faiss.METRIC_INNER_PRODUCT)
hnsw_index.hnsw.efConstruction = ef_construction
hnsw_index.add(embeddings_norm)
```

The index is built over L2-normalized vectors with inner product metric, so dot product equals cosine similarity.

**4. Recall validation**

Before export, the script runs `validate_recall()` — compares HNSW top-10 results at `efSearch=50` against brute-force results on 100 random queries and asserts recall >= 0.85.

**5. FAISS levels convention**

FAISS stores, for each node `i`, an integer `levels[i]` equal to the **number of levels** the node participates in (not the maximum layer index):

```
levels[i] = 1  ->  node is in layer 0 only (layer0-only node)
levels[i] = k  ->  node is in layers 0 through k-1; max layer index = k-1
```

The threshold for a node to be exported to `upper_layers.json` is `levels[i] >= 2`, meaning it appears in at least one layer above layer 0. The maximum layer index for such a node is `levels[i] - 1`.

```python
# Correct: levels[i] is num_levels, not max_layer
actual_max_layer = num_levels - 1
for l in range(1, num_levels):     # layers 1 .. actual_max_layer
    nbrs = get_hnsw_neighbors(hnsw, offsets, flat_neighbors, node_id, l)
```

**6. Shard export**

For each K-Means cluster, one shard file is written containing all layer-0 nodes in that cluster plus their layer-0 HNSW neighbors:

```json
{
  "shard_id": 42,
  "nodes": [
    { "id": 1234, "scale": 0.00612, "qv": [-12, 45, "..."], "neighbors": [87, 1901, "..."] }
  ]
}
```

**7. Lookup tables**

- `node_to_shard.json` — maps every node ID (string) to its shard/cluster ID (integer).
- `cluster_centroids.json` — list of SQ8-quantized cluster centroids, used for prefetching likely shards before the beam search begins.

**8. Shard integrity validation**

After writing all shards, the script verifies that every neighbor ID referenced in every shard is a valid node ID in `[0, n_items)`. Any invalid reference is logged as an error.

**9. titles.json**

A lightweight metadata file keyed by integer node ID (insertion order = HNSW node ID):

```json
{
  "0": { "idno": "WPS9999", "title": "Growth and Poverty", "type": "Working Paper", "doi": "..." },
  "1": { "...": "..." }
}
```

`abstract` and `text` fields are deliberately excluded — they are large and not needed for result display. This keeps `titles.json` small enough to load at init even for HNSW collections.

#### All CLI flags

| Flag | Default | Description |
|---|---|---|
| `--output_dir` | `data/collection` | Directory containing `raw_embeddings.npy` and `metadata.json` |
| `--collection_id` | `collection` | Short identifier written into `manifest.json` |
| `--model_id` | `avsolatorio/GIST-small-Embedding-v0` | Model identifier written into manifest |
| `--compress` | `gzip` | `gzip` compresses all JSON to `.json.gz` (~70% smaller); `none` keeps uncompressed. **GitHub Pages does not serve `.gz` files** — use `none` or run `decompress_for_github_pages.py` after building. |
| `--hnsw_M` | `16` | HNSW `M` parameter (neighbors per node per layer). Higher = better recall, larger index |
| `--ef_construction` | `200` | HNSW build-time beam width. Higher = better graph quality, slower build |
| `--flat_threshold` | `2000` | Maximum `n_items` to use flat (brute-force) mode instead of HNSW |
| `--n_clusters` | `None` | Number of K-Means clusters (shards). Default: `max(10, sqrt(n_items))` |
| `--kmeans_niter` | `30` | K-Means iteration count |
| `--preview_fields` | `"idno,title,abstract,type,doi"` | Fields to include in `titles.json` (excluding `abstract` and `text`) |
| `--bm25_fields` | `"title,text"` | BM25 field list written to `manifest.json` |
| `--seed` | `42` | Random seed |

---

### `pipeline.py`

**Purpose:** End-to-end orchestrator. Calls all three scripts in sequence using Python's `importlib.machinery.SourceFileLoader`. This is equivalent to running the three scripts manually but with a single command and consistent parameters.

```bash
# Full run from API
python pipeline.py prwp \
  --source=worldbank_api \
  --doctype="Policy Research Working Paper" \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --output_dir=../../data/prwp

# Skip fetch (metadata.json already exists)
python pipeline.py prwp --skip_fetch \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --output_dir=../../data/prwp

# Skip fetch and embed (raw_embeddings.npy already exists)
python pipeline.py prwp --skip_fetch --skip_embed \
  --output_dir=../../data/prwp
```

#### All CLI flags

| Flag | Default | Description |
|---|---|---|
| `collection_id` | (required positional) | Short collection identifier |
| `--source` | `worldbank_api` | Source type for step 1 |
| `--doctype` | `"Policy Research Working Paper"` | WB API document type |
| `--input_file` | `None` | Input file for Excel/JSON sources |
| `--sheet_name` | `None` | Sheet name for Excel |
| `--id_field` | `idno` | Document identifier field |
| `--content_fields` | `"title,abstract"` | Fields to concatenate for embedding |
| `--preview_fields` | `"idno,title,abstract,type,doi,url,date_published"` | Fields to carry through |
| `--bm25_fields` | `"title,text"` | BM25 fields for manifest |
| `--max_docs` | `0` | Maximum documents from API (0 = all) |
| `--model` | `avsolatorio/GIST-small-Embedding-v0` | Embedding model |
| `--batch_size` | `64` | Encoding batch size |
| `--matryoshka_dim` | `None` | MRL truncation dimension |
| `--title_field` | `title` | Title field name |
| `--bm25_text_field` | `abstract` | Field for BM25 `text` |
| `--hnsw_M` | `16` | HNSW M parameter |
| `--ef_construction` | `200` | HNSW build beam width |
| `--flat_threshold` | `2000` | Flat vs HNSW threshold |
| `--n_clusters` | `None` | K-Means cluster count |
| `--kmeans_niter` | `30` | K-Means iterations |
| `--output_dir` | `../../data/<collection_id>` | Output directory |
| `--skip_fetch` | `False` | Skip step 1 (use existing metadata.json) |
| `--skip_embed` | `False` | Skip step 2 (use existing raw_embeddings.npy) |
| `--seed` | `42` | Random seed |

---

## 4. Index File Format

After running the full pipeline for a collection, the output directory has the following structure:

```
data/prwp/
+-- manifest.json                   # entry point for the browser
+-- metadata.json                   # intermediate (not served directly)
+-- raw_embeddings.npy              # intermediate (not served directly)
+-- flat/
|   +-- embeddings.int8.json        # brute-force index (all documents)
+-- index/
    +-- config.json                 # HNSW build parameters + recall metric
    +-- upper_layers.json           # nodes in layers 1+ (tiny, ~5% of N)
    +-- node_to_shard.json          # {node_id_str: shard_id}
    +-- cluster_centroids.json      # [{shard_id, scale, qv}]
    +-- titles.json                 # {node_id_str: {title, idno, type, ...}}
    +-- layer0/
        +-- shard_000.json          # layer-0 nodes + neighbors for cluster 0
        +-- shard_001.json
        +-- ... (n_clusters files)
```

### `manifest.json`

The top-level entry point. The browser worker fetches this URL first.

```json
{
  "version": "1.0",
  "collection_id": "prwp",
  "n_items": 10942,
  "embedding_dim": 384,
  "matryoshka_dim": null,
  "quant": "int8",
  "model_id": "avsolatorio/GIST-small-Embedding-v0",
  "flat": {
    "path": "flat/embeddings.int8.json"
  },
  "index": {
    "path": "index/",
    "config": "index/config.json",
    "titles": "index/titles.json"
  },
  "thresholds": {
    "flat_max": 2000
  },
  "preview_fields": ["idno", "title", "abstract", "type", "doi"],
  "bm25_fields": ["title", "text"],
  "search_mode": "hnsw"
}
```

All paths in `flat` and `index` are relative to the manifest URL. `search_mode` is either `"flat"` (for small collections) or `"hnsw"`. The `titles` key is only present in HNSW mode.

When the pipeline uses `--compress=gzip` (default), paths point to `.json.gz` files (e.g. `flat/embeddings.int8.json.gz`) and `compressed: true` is set. The app decompresses these automatically via `fetch-json.js`.

### `index/config.json`

HNSW build parameters and measured recall. Loaded by `hnsw-engine.js` at init.

```json
{
  "n_items": 10942,
  "dim": 384,
  "matryoshka_dim": null,
  "quant": "int8",
  "hnsw_M": 16,
  "hnsw_ef_construction": 200,
  "n_layers": 4,
  "n_clusters": 110,
  "entry_node_id": 3123,
  "entry_layer": 3,
  "recall_at_10": 0.999
}
```

`n_layers` is `max_layer + 1`. `entry_layer` is the highest layer in the graph (= `n_layers - 1`). `recall_at_10` is measured at `efSearch=50` over 100 random queries against brute-force.

### `index/upper_layers.json`

All HNSW nodes that appear in layer 1 or higher. For PRWP (10,942 docs), this is approximately 550 nodes (~5%). The entire file is fetched once at init and never again.

```json
{
  "max_layer": 3,
  "entry_node_id": 3123,
  "nodes": {
    "3123": {
      "max_layer": 3,
      "scale": 0.00612,
      "qv": [-12, 45, "..."],
      "layers": {
        "1": [88, 214, 999],
        "2": [214, 3001],
        "3": [88]
      }
    },
    "88": { "...": "..." }
  }
}
```

`max_layer` for a node is `levels[i] - 1` (0-indexed). The `layers` object maps layer number strings to arrays of neighbor node IDs at that layer. Layer 0 neighbors are NOT included here — they are in the shard files.

**Important note on FAISS levels:** The FAISS `levels` array stores the **number of levels** a node participates in, not its maximum layer index. Upper-layer nodes satisfy `levels[i] >= 2`.

### `index/node_to_shard.json`

A flat dictionary mapping every HNSW node ID (string) to its shard/cluster ID (integer). Used during beam search to look up which shard to fetch for each neighbor.

```json
{
  "0": 42,
  "1": 7,
  "2": 42
}
```

Size for PRWP: ~107 KB (10,942 entries). Loaded once at init.

### `index/cluster_centroids.json`

Array of SQ8-quantized K-Means cluster centroids. One entry per shard. Used to pre-rank shards by proximity to the query before the beam search starts, enabling prefetch of the most likely shards.

```json
[
  { "shard_id": 0, "scale": 0.00589, "qv": [-8, 31, "..."] },
  { "shard_id": 1, "scale": 0.00601, "qv": [22, -14, "..."] }
]
```

Size for PRWP: ~126 KB (110 centroids, 384 dims each). Loaded once at init.

### `index/titles.json`

Lightweight display metadata for every document, keyed by integer node ID (same as HNSW insertion order). Excludes `abstract` and `text` fields to stay small.

```json
{
  "0": { "idno": "WPS9999", "title": "Growth and Poverty", "type": "Working Paper", "doi": "10.1..." },
  "1": { "idno": "WPS8888", "title": "Climate Finance", "type": "Working Paper" }
}
```

Size for PRWP: ~1.4 MB. Fetched in parallel with the HNSW init files at worker startup.

### `index/layer0/shard_NNN.json`

One file per K-Means cluster. Contains the SQ8-quantized vectors and layer-0 HNSW neighbor lists for all nodes in that cluster. Fetched lazily during beam search.

```json
{
  "shard_id": 42,
  "nodes": [
    {
      "id": 1234,
      "scale": 0.00523,
      "qv": [5, -98, 44, "..."],
      "neighbors": [87, 1901, 5432, 7800, "..."]
    }
  ]
}
```

Filename format: `shard_NNN.json` where NNN is zero-padded to 3 digits (e.g., `shard_007.json`). Average size for PRWP: ~128 KB per shard.

### `flat/embeddings.int8.json` (or `.json.gz`)

Complete flat brute-force index. Contains every document's int8 vector, title, text, and preview fields. Used directly by `FlatEngine` for small collections and also as the source for BM25 construction in flat mode. When `--compress=gzip`, written as `.json.gz` (~75% smaller).

```json
{
  "format": "int8_flat",
  "n_items": 1500,
  "dim": 384,
  "full_dim": 384,
  "matryoshka_dim": null,
  "model_id": "avsolatorio/GIST-small-Embedding-v0",
  "items": [
    {
      "id": "SP.POP.TOTL",
      "scale": 0.00598,
      "qv": [11, -44, "..."],
      "title": "Population, total",
      "text": "Total population is based on the de facto definition...",
      "Series Code": "SP.POP.TOTL",
      "Source": "World Bank"
    }
  ]
}
```

---

## 5. JavaScript Modules

All modules live in `semantic-search/js/search/`. They use ES module syntax and are loaded by `search.worker.js` as a Web Worker.

### `int8-codec.js`

A zero-dependency utility module for SQ8 quantization operations. Designed to be the inner loop of the search hot path with no allocation overhead.

#### API

```js
import { dotProductMixed, dequantize, l2NormalizeInPlace, toInt8Array } from './int8-codec.js';
```

| Function | Signature | Description |
|---|---|---|
| `dotProductMixed` | `(queryF32: Float32Array, storedQV: Int8Array, storedScale: number) -> number` | Computes dot product between a float32 query and a stored int8 vector without allocating a new array. Returns approximate cosine similarity since vectors are pre-normalized. This is the hot path during HNSW beam search. |
| `dequantize` | `(qv: Int8Array, scale: number) -> Float32Array` | Full dequantization — allocates a new Float32Array. Use for reranking, not for search. |
| `l2NormalizeInPlace` | `(vec: Float32Array) -> Float32Array` | L2-normalizes a vector in place. Required before passing a query embedding to any search engine. |
| `toInt8Array` | `(arr: number[]) -> Int8Array` | Converts a plain JS number array to a typed `Int8Array`. Call once when loading a shard to speed up subsequent dot products. |

#### Hot-path design

`dotProductMixed` avoids creating a dequantized float32 array by multiplying inline: `queryF32[i] * (storedQV[i] * storedScale)`. This keeps L1 cache pressure low and avoids GC pressure during beam search iterations.

---

### `fetch-json.js`

Fetches JSON from a URL with automatic gzip decompression. When the pipeline uses `--compress=gzip`, index files are written as `.json.gz`; this module fetches and decompresses them using `DecompressionStream` before parsing.

#### API

```js
import { fetchJson } from './fetch-json.js';

const data = await fetchJson('data/prwp/flat/embeddings.int8.json.gz');
// Automatically decompresses .gz URLs before parsing
```

| Parameter | Description |
|---|---|
| `url` | Full URL to `.json` or `.json.gz` file |
| `opts.cacheName` | If set, uses Cache API for caching (stores decompressed JSON) |

---

### `shard-loader.js`

Manages lazy loading of layer-0 shard files with three-tier caching. Supports both `.json` and `.json.gz` (when `manifest.compressed` is true).

#### Cache tiers

1. **Memory cache** (`Map<shardId, data>`) — survives within a session. Lookups are synchronous and require no I/O.
2. **Cache API** — populated by `service-worker.js`. Survives page reloads and works offline. Accessed via `caches.open()`.
3. **Network fetch** — only on first-ever access. The fetched JSON is stored in both memory and the Cache API for future use.

#### Inflight deduplication

If two concurrent beam-search paths both need the same shard, only one network request is issued. Both callers `await` the same `Promise` stored in the `inflight` Map. The promise is removed from `inflight` once the load completes (in the `finally` block).

```js
const loader = new ShardLoader('data/prwp/index/layer0/', 'hnsw-shards-v1');

// Load shard 42 — fetches from network (or cache) on first call
const shard = await loader.load(42);

// Prefetch shards likely to be needed (fire-and-forget)
loader.prefetch([43, 44, 45]);

// Evict oldest from memory if too many are cached
loader.evict(200);  // keep at most 200 shards in memory
```

#### API

| Method | Description |
|---|---|
| `constructor(baseUrl, cacheName, shardSuffix)` | `baseUrl` must end with `/`. `cacheName` is the Cache API bucket. `shardSuffix` is `.json` or `.json.gz` (default `.json`). |
| `async load(shardId)` | Load and return parsed shard JSON. Checks memory -> Cache API -> network in order. |
| `prefetch(shardIds)` | Fire-and-forget load for a list of shard IDs. Skips IDs already in memory or inflight. |
| `evict(maxEntries)` | Remove oldest entries from memory using FIFO order until the cache is at most `maxEntries`. Default: 200. |

---

### `flat-engine.js`

Brute-force cosine similarity search for small collections. Used when `manifest.search_mode === 'flat'` (i.e., `n_items <= flat_threshold`).

#### When it is used

For collections with 2,000 or fewer documents (e.g., WDI indicators with ~1,500 items), HNSW overhead is not worthwhile. FlatEngine scans all vectors in a single loop over pre-typed `Int8Array` values using `dotProductMixed`. A JavaScript engine can typically process 1,500 vectors of dimension 384 in under 5 ms.

#### Loading

```js
const engine = new FlatEngine();
const items = await engine.load('data/wdi/flat/embeddings.int8.json');
// items: raw array with plain JS objects (for BM25 construction)
// engine.items: same data but with typed Int8Array qv fields (for search)
```

#### Searching

```js
const results = engine.search(queryF32, { topK: 20, threshold: 0.0 });
// Returns: [{ id, score, title, text, ...previewFields }]
```

The search computes dot product against every item (full scan), filters by `threshold`, partially sorts by score descending, and returns the top `topK` items with all preview fields spread in.

---

### `hnsw-engine.js`

Approximate nearest-neighbor search using the HNSW algorithm over browser-lazily-loaded JSON shards.

#### Init sequence

```js
const engine = new HNSWEngine();
await engine.init('data/prwp/', { cacheName: 'hnsw-shards-v1', manifest });
```

When `manifest.compressed` is true, paths point to `.json.gz` and the loader uses `.json.gz` for shards. `init()` fetches three files in **parallel**:

1. `index/config.json` — build parameters and entry point.
2. `index/upper_layers.json` — all nodes in layers 1+; their `qv` arrays are immediately converted to `Int8Array` and stored in `nodeCache`.
3. `index/node_to_shard.json` — full node-to-shard lookup table.

A `ShardLoader` is created pointing at `index/layer0/`.

#### Two-phase search algorithm

**Phase 1 — Greedy descent through upper layers (`_greedyDescentLayer`)**

Starting from the global entry node at the top layer, the algorithm descends one layer at a time using greedy hill-climbing with `ef=1`:

- At each step, score all neighbors of the current best node using `dotProductMixed`.
- If any neighbor has a higher score, move to it.
- Repeat until no improvement is found.
- Move down one layer and repeat from the best node found.

All upper-layer nodes are already in `nodeCache` from init — this phase requires zero I/O.

**Phase 2 — Beam search at layer 0 (`_beamSearchLayer0`)**

Standard HNSW beam search with frontier `C` and result set `W`, both maintained as ascending-sorted arrays:

1. Load the entry node's shard to get its layer-0 neighbors.
2. While the frontier is not empty:
   a. Pop the best candidate from `C`.
   b. **Early termination:** if the candidate's score is below the worst score in `W` (which has `ef` elements), stop.
   c. For each unvisited neighbor, identify which shards are missing from memory.
   d. **Batch prefetch:** `await Promise.all(neededShards.map(s => loader.load(s)))` — all missing shards for this iteration are fetched in parallel.
   e. Score each neighbor; add to `C` and `W` if score is competitive.
3. Return `W` sorted descending by score.

The K-Means cluster-based shard assignment means that step (d) typically loads 0-1 new shards per iteration after the first few candidates, since neighbors are usually in the same cluster as the candidate.

#### `nodeCache`

A `Map<nodeId, nodeObject>` that stores both upper-layer nodes (pre-cached at init) and layer-0 node data (cached on first shard load). The `_l0loaded` flag marks whether a node's layer-0 neighbors have been populated. Upper-layer nodes are pre-cached without layer-0 neighbors; the flag prevents redundant shard loads.

#### `lastStats`

After each `search()` call, `engine.lastStats` is set to:

```js
{
  latencyMs: 127,        // wall clock time for the search
  shardsLoaded: 3,       // new shards loaded during this search
  totalCachedShards: 8,  // total shards now in memory
}
```

This is forwarded to the main thread in the `results` message.

#### Searching

```js
const results = await engine.search(queryF32, { ef: 50, topK: 10 });
// Returns: [{ id: number, score: number }]
// Note: for HNSW mode, id is the integer node ID, not the document idno.
// Enrich with titles: titlesMap[String(result.id)]
```

---

### `hybrid-search.js`

Merges results from a semantic engine (FlatEngine or HNSWEngine) and a BM25 lexical engine.

#### Scoring

```
combined_score = semanticWeight * normalized_semantic_score
               + lexicalWeight  * normalized_bm25_score
```

Both score ranges are normalized independently to `[0, 1]` within the current result set before combining, preventing either system from dominating due to scale differences (cosine similarity is in roughly `[0.5, 1.0]` for relevant results; BM25 scores are arbitrary positive numbers).

#### Modes

| `mode` | Behavior |
|---|---|
| `'semantic'` | Only the semantic engine runs. BM25 scores are 0. |
| `'lexical'` | Only BM25 runs. Semantic scores are 0. |
| `'hybrid'` | Both run in parallel (`Promise.all`); scores are normalized and merged. |

For hybrid and lexical modes, `candidateK = topK * 3` — more candidates are fetched before the merge step to improve recall after re-ranking.

```js
const hybrid = new HybridSearch(hnswEngine, bm25Engine, (id) => titlesMap[String(id)]);
const results = await hybrid.search(queryVec, queryText, {
  topK: 20,
  semanticWeight: 0.7,
  lexicalWeight: 0.3,
  ef: 50,
  mode: 'hybrid',
});
```

---

### `search.worker.js`

The unified Web Worker that manages embedding inference and search routing. Runs in a background thread so the main thread and UI remain fully responsive.

#### Message protocol

All messages use a `type` field. The worker also handles a legacy bare-message format (`{ text, ping }`) for backward compatibility.

**Outbound to worker (main thread -> worker):**

| Message type | Fields | Description |
|---|---|---|
| `init` | `manifestUrl: string`, `modelId?: string` | Start initialization. `manifestUrl` must be an absolute URL — resolve with `new URL(url, location.href).href`. |
| `search` | `text: string`, `topK?: number`, `ef?: number`, `threshold?: number` | Run a search query. Worker must be ready. |
| `embed` | `text: string` | Get a raw embedding vector (transferred as `ArrayBuffer`). |
| `searchCompare` | `text: string`, `topK?: number`, `ef?: number` | Run both HNSW and flat search, return both result sets + recall@k overlap. Only supported in HNSW mode. |
| `ping` | — | Health check. |

**Inbound from worker (worker -> main thread):**

| Message type | Fields | Description |
|---|---|---|
| `progress` | `phase: 'model' or 'index'`, `message: string` | Loading progress update for display in UI. |
| `bm25_init` | `items: Array`, `manifest: object` | Sent after index load. In flat mode, `items` is the full flat items array for BM25 construction. In HNSW mode, `items` is empty. The manifest is forwarded for collection metadata. |
| `ready` | `mode: 'flat' or 'hnsw'`, `config: object` | Both model and index are ready. Triggers initial search in `app.html`. |
| `results` | `data: Array`, `stats?: object` | Search results array. `stats` contains `lastStats` from the engine (latencyMs, shardsLoaded, totalCachedShards). |
| `compare` | `hnsw: Array`, `flat: Array`, `recall: number`, `overlap: number`, `k: number` | Response to `searchCompare`. Recall = overlap/k (how many flat top-k appear in HNSW top-k). |
| `embedding` | `data: Float32Array` | Response to `embed` message. Transferred as `ArrayBuffer` for zero-copy. |
| `pong` | — | Response to `ping` when ready. |
| `loading` | — | Response to `ping` when still initializing. |
| `error` | `message: string`, `originalType?: string` | Unrecoverable error. |

#### Init sequence

`init()` starts the model and index **in parallel** using `Promise.all()`:

1. `loadModel()` — calls `pipeline('feature-extraction', modelId, { dtype: 'q8', device: 'webgpu' })`. Falls back to `device: 'wasm'` if WebGPU throws.
2. `initIndex()` — fetches manifest, then either creates `FlatEngine` (and sends `bm25_init` with items) or creates `HNSWEngine` (fetches `upper_layers.json`, `node_to_shard.json`, `config.json`, and `titles.json` in parallel).

Once both complete, `isReady = true` and a `ready` message is sent.

#### Flat vs HNSW routing

```js
if (searchEngine instanceof FlatEngine) {
  results = searchEngine.search(queryVec, { topK, threshold });
} else {
  // HNSW: enrich bare {id, score} with display metadata
  const raw = await searchEngine.search(queryVec, { topK, ef });
  results = titlesMap
    ? raw.map(r => ({ ...(titlesMap[String(r.id)] ?? {}), ...r }))
    : raw;
}
```

For HNSW mode, results from `HNSWEngine` contain only `{ id, score }`. The worker enriches them with fields from `titlesMap` (loaded from `titles.json` at init) before posting back to the main thread.

#### Embedding inference

```js
// Transformers.js v3 API — call pipeline directly with pooling option
const output = await extractor(text, { pooling: 'mean', normalize: false });
const raw = new Float32Array(output.data);
l2NormalizeInPlace(raw);
```

The model tries WebGPU first for hardware acceleration, then falls back to WASM.

---

### `service-worker.js`

A cache-first service worker that intercepts requests for index files and shard files, serving them from the Cache API after the first visit.

#### Cache strategy

- **Install:** calls `skipWaiting()` so new versions activate immediately without waiting for old tabs to close.
- **Activate:** deletes all caches whose name is not `CACHE_NAME` (stale versions), then calls `clients.claim()` to take control of existing pages.
- **Fetch:** for matched URLs, checks the cache first. On a cache miss, fetches from the network, stores a cloned response in cache, and returns the original. For offline misses, returns a `503` JSON error response.

#### Cached URL patterns

The service worker intercepts requests matching these patterns (supports both `.json` and `.json.gz` when the pipeline uses `--compress=gzip`):

```
/index/layer0/shard_NNN.json(.gz)
/index/upper_layers.json(.gz)
/index/node_to_shard.json(.gz)
/index/cluster_centroids.json(.gz)
/index/config.json(.gz)
/index/titles.json(.gz)
/manifest.json
/flat/embeddings.int8.json(.gz)
```

All other URLs pass through to the browser without interception.

#### Cache versioning

The `CACHE_NAME` constant (`'hnsw-shards-v1'`) must match the `cacheName` parameter passed to `ShardLoader` in `search.worker.js`. When you rebuild the index (new shard files), bump the version in both places:

```js
// service-worker.js
const CACHE_NAME = 'hnsw-shards-v2';

// search.worker.js — in the engine.init() call:
await engine.init(baseUrl, { cacheName: 'hnsw-shards-v2' });
```

On next page load the new service worker activates, deletes the old cache, and starts populating the new one.

Registration in HTML:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }
</script>
```

---

## 6. Apps

### `app.html`

The main search application. Built with Vue 3 and Vuetify. All search logic runs in a Web Worker — the main thread is only responsible for UI rendering and BM25 (in flat mode).

#### Progressive loading phases

| Phase | What happens | UI state |
|---|---|---|
| Page load | Service worker registered; `init` message sent to worker with resolved manifest URL | "Loading index..." spinner |
| `progress (phase=model)` | Model downloading and initializing | "Loading embedding model..." |
| `progress (phase=index)` | Manifest fetched, index loading | "Loading HNSW index..." |
| `bm25_init` | Items received (flat mode) or empty (HNSW); BM25 engine built in main thread; `manifestConfig` set | `indexReady = true` |
| `ready` | Both model and index ready | `modelReady = true`; triggers initial empty search |
| First `results` | Results rendered in the list | Search panel active |

#### Mode switcher

The search mode is controlled by a `searchMode` ref with values `'semantic'`, `'lexical'`, or `'hybrid'`:

- **Semantic:** sends `{ type: 'search', text, topK: 50, ef: 50 }` to the worker.
- **Lexical:** runs BM25 entirely in the main thread using `window.SearchBundle.createBM25Engine`. No worker call. Only available in flat mode (when `bm25_init` has items).
- **Hybrid:** sends to worker; `HybridSearch` inside the worker merges semantic and BM25 results.

The mode is auto-selected after init: HNSW collections default to `'semantic'`; when BM25 is ready, it can be upgraded to `'hybrid'`.

#### Manifest-driven collection switching via `?manifest=`

The active collection is determined by the `?manifest=` URL parameter:

```
http://localhost:8000/app.html?manifest=data/prwp/manifest.json
http://localhost:8000/app.html?manifest=data/wdi/manifest.json
```

The default is `data/prwp/manifest.json`. The manifest URL is resolved to an absolute URL at mount time:

```js
const resolvedManifest = new URL(manifestUrl.value, location.href).href;
searchWorker.postMessage({ type: 'init', manifestUrl: resolvedManifest });
```

This resolution is critical — the worker script is served from `js/search/`, so relative URLs resolve against that path, not the page's path.

#### Result enrichment from titles.json

In HNSW mode, results from the worker already contain metadata from `titles.json` (the worker enriches them before posting). The main thread additionally checks `metaById` (a `Map` populated when `bm25_init` arrives with items in flat mode) for any additional preview fields:

```js
const results = (msg.data || []).map(r => {
  const meta = metaById.get(String(r.id));
  return meta ? { ...meta, ...r } : r;
});
```

#### Reranker

An optional cross-encoder reranker runs in a separate worker (`rank.worker.js`). The reranker is triggered by toggling the `applyReranking` switch in the UI. It processes the top 20 results by sending `{ query, documents, top_k }` to `rank.worker.js` and reorders the results by `rerank_score`. The reranker operates on `title + "\n\n" + abstract` concatenations.

---

### `test-hnsw-search.html`

A self-contained benchmarking and validation app for the HNSW search engine.

#### What it tests

Runs 7 predefined queries covering diverse topics (poverty, climate, education, public health, fiscal policy, financial inclusion, infrastructure) against the PRWP collection. For each query, it runs:

1. **Cold run** — measures wall-clock latency and shards loaded (first time, shards are fetched from network or Cache API).
2. **Warm run** — measures latency with all relevant shards already in the worker's in-memory cache.

#### Performance targets

| Target | Value |
|---|---|
| Cold query latency | < 1000 ms |
| Shards per query | <= 8 |

Queries that exceed either target are flagged as failures. The summary panel shows color-coded chips (green for pass, yellow for warning) for each metric.

#### How to interpret results

- **Avg Cold Latency** — includes embedding model inference time (~200-400 ms for WASM) plus shard I/O plus beam search computation.
- **Avg Warm Latency** — effectively embedding inference only, since shards come from the in-memory `Map` synchronously.
- **Avg Shards / Query** — the key metric for K-Means clustering effectiveness. Values of 2-4 confirm that the cluster-based sharding is working correctly. Values above 8 suggest the K-Means clusters are not well-aligned with the HNSW neighborhood structure.
- **Search Mode** — confirms whether `flat` or `hnsw` mode is active for the tested collection.

The log panel shows every worker message (`<- type`) and every outbound message (`-> type`) with timestamps, which is useful for diagnosing stuck inits or unexpected mode switching.

---

### `test-hnsw-vs-flat.html`

A comparison test that validates HNSW approximate search against brute-force flat search. Use this to verify that HNSW returns results comparable to exact retrieval.

#### What it does

- **Single query:** Enter a query, click "Compare HNSW vs Flat". The worker runs both HNSW and flat search, then computes recall@k (overlap of top-k results). Results are shown side-by-side with match/mismatch highlighting.
- **Batch mode:** Runs 7 predefined queries and reports average recall, min recall, and how many queries achieved 100% recall.

#### Requirements

- Manifest must be in **HNSW mode** (`search_mode: "hnsw"`).
- The manifest must have a `flat.path` (e.g. `flat/embeddings.int8.json` or `.json.gz`) — the flat index is lazy-loaded on first comparison (~44 MB uncompressed, ~11 MB gzip for PRWP).

#### How to interpret

- **Recall@k:** Fraction of flat top-k results that appear in HNSW top-k. Python build validation targets recall@10 ≥ 0.85; typical PRWP index achieves ~0.999.
- **Match column:** Green = same document at same rank; red = different document at that rank (ordering may differ even when recall is high).
- **Batch summary:** Avg recall ≥ 95% is good; ≥ 80% is acceptable; below 80% may warrant higher `ef_search` or index rebuild.

---

## 7. Bandwidth and Performance

All numbers are measured for the **PRWP collection** (10,942 documents, 384-dimensional embeddings, 110 clusters, M=16).

### Initialization cost (fetched once per session)

| File | Approx. size |
|---|---|
| `index/upper_layers.json` | ~835 KB (~200 KB gzip) |
| `index/node_to_shard.json` | ~107 KB |
| `index/cluster_centroids.json` | ~126 KB |
| `index/config.json` | ~1 KB |
| `index/titles.json` | ~1.4 MB |
| **Total init bandwidth** | **~2.5 MB** |

After the first session, the service worker caches these files and serves them instantly on subsequent visits (including offline).

### Embedding model

- GIST-small-Embedding-v0 quantized ONNX: ~30 MB
- Cached by the browser (HTTP cache) after first load.
- WebGPU inference: ~50-100 ms per query.
- WASM fallback inference: ~200-400 ms per query.

### Per-query bandwidth

| Scenario | Bandwidth | Typical total latency (WASM) |
|---|---|---|
| Cold (first query, no cached shards) | ~383-511 KB (3-4 shards x ~128 KB avg) | ~600-1000 ms |
| Warm (shards in memory cache) | 0 KB | ~200-400 ms (embedding inference only) |
| After page reload (shards in Cache API) | 0 KB (served from SW cache) | ~200-400 ms |

### Recall

`recall@10 = 0.999` at `efSearch=50` on 100 random queries. Measured against brute-force (FAISS flat inner-product index) on L2-normalized float32 embeddings during the build step.

---

## 8. Key Design Decisions

### K-Means cluster-based sharding vs contiguous ID ranges

A naive sharding approach would split node IDs into contiguous ranges (e.g., nodes 0-99 in shard 0, nodes 100-199 in shard 1). This would mean that any HNSW neighbor — which is a semantically similar document — could be in a random shard. Queries would touch O(n_clusters) shards.

K-Means clustering assigns nodes to shards based on embedding similarity. Because HNSW constructs edges between similar vectors, and K-Means groups similar vectors together, most layer-0 neighbors of any given node share its cluster. The result is **2-4 shard fetches per query** instead of 10-15 for a 110-shard index — a 3-5x reduction in bandwidth and latency.

### SQ8 per-vector int8 quantization vs product quantization

Product quantization (PQ) can achieve higher compression ratios but requires a trained codebook and complex decode logic in JavaScript. SQ8 (symmetric scalar quantization per vector) is:

- **Simple to implement** in both Python (`numpy`) and JavaScript (a single multiply-and-accumulate loop).
- **Lossless enough** — validated cosine similarity error < 0.001 on the PRWP dataset.
- **4x compression** — float32 (4 bytes/dim) -> int8 (1 byte/dim) with a single per-vector scale factor.
- **Hot-path friendly** — `dotProductMixed` avoids any allocation by multiplying inline: `q[i] * scale * queryF32[i]`.

### Upper layers always loaded at init

Upper-layer nodes are approximately 5% of total nodes. For PRWP, that is ~550 nodes out of 10,942, totaling ~835 KB. Loading all of them at init means the greedy descent phase (Phase 1) never requires any I/O — it runs entirely from the in-memory `nodeCache`. This eliminates latency variance from the upper-layer traversal and makes cold query latency predictable.

Lazy-loading upper layers would save the initial ~835 KB but would add 1-3 round-trips per query during descent, which at typical browser latencies (20-100 ms/request) would cost more time than the bandwidth savings are worth.

### Separate `titles.json` vs loading the flat file for HNSW mode

The flat index (`flat/embeddings.int8.json`) for PRWP is approximately 44 MB uncompressed (~11 MB gzip) — it contains quantized vectors for all 10,942 documents. Loading this file just to show titles in HNSW mode would be prohibitive (takes seconds and wastes memory).

`titles.json` contains only display fields (title, idno, type, doi) without the large abstract/text fields or vectors, keeping it at ~1.4 MB. It is fetched in parallel with the three HNSW init files at startup, adding only ~50 ms to init time on a typical connection.

### FAISS levels[i] convention: num_levels, not max layer index

FAISS's internal `levels` array stores the **number of levels** each node participates in, which is `max_layer_for_node + 1`. This is not the same as the maximum layer index:

```
levels[i] = 1  ->  node is ONLY in layer 0 (not an upper-layer node)
levels[i] = 2  ->  node is in layers 0 and 1; its max layer index = 1
levels[i] = k  ->  node is in layers 0 through k-1; its max layer index = k-1
```

The filter for upper-layer nodes is `levels[i] >= 2`. Using `levels[i] >= 1` would include all nodes (none would be skipped). Using `levels[i] > max_level` would miss nearly all upper-layer nodes. The `max_layer` field stored per node in `upper_layers.json` is always `levels[i] - 1`.

---

## 9. Extending to a New Collection

This walkthrough adds a hypothetical dataset of journal articles stored in a CSV file.

### Step 1: Prepare your data

Your CSV should have at minimum an ID column and text columns for the embedding content:

```
article_id,title,abstract,journal,year,url
A001,Improving Crop Yields with AI,...,Nature Food,2024,...
```

### Step 2: Fetch and prepare

```bash
cd semantic-search/notebooks/pipeline

python 01_fetch_and_prepare.py \
  --source=excel \
  --input_file=/path/to/articles.csv \
  --id_field=article_id \
  --content_fields="title,abstract" \
  --preview_fields="article_id,title,abstract,journal,year,url" \
  --output_dir=../../data/articles
```

This writes `data/articles/metadata.json`. If your collection has fewer than 2,000 items, steps 3 and 4 will produce a flat index automatically.

### Step 3: Generate embeddings

```bash
python 02_generate_embeddings.py \
  --metadata_path=../../data/articles/metadata.json \
  --output_dir=../../data/articles \
  --model=avsolatorio/GIST-small-Embedding-v0 \
  --id_field=article_id \
  --content_field=abstract \
  --title_field=title \
  --preview_fields="article_id,title,abstract,journal,year,url"
```

For a large collection (> 2,000 items), this generates `raw_embeddings.npy` and `flat/embeddings.int8.json`. The flat file is always written regardless of collection size.

### Step 4: Build the index

```bash
python 03_build_index.py \
  --output_dir=../../data/articles \
  --collection_id=articles \
  --model_id=avsolatorio/GIST-small-Embedding-v0 \
  --preview_fields="article_id,title,journal,year,url"
```

For large collections (> 2,000 items), tune `--n_clusters` and `--hnsw_M` if needed:

```bash
python 03_build_index.py \
  --output_dir=../../data/articles \
  --collection_id=articles \
  --n_clusters=80 \
  --hnsw_M=16 \
  --ef_construction=200
```

As a rule of thumb, `n_clusters = max(10, sqrt(n_items))` is the default and works well for most collections.

### Step 5: Serve and test

```bash
cd semantic-search/
python -m http.server 8000

# Open the benchmark app to verify performance:
# http://localhost:8000/test-hnsw-search.html
# (edit manifestUrl to 'data/articles/manifest.json' in the UI)

# Or open the app directly:
# http://localhost:8000/app.html?manifest=data/articles/manifest.json
```

### Step 6: Service worker cache busting

If you rebuild an existing collection (replacing shard files on disk), bump the cache version in both places to force browsers to re-download:

```js
// service-worker.js
const CACHE_NAME = 'hnsw-shards-v2';

// search.worker.js — in the engine.init() call inside initIndex():
await engine.init(baseUrl, { cacheName: 'hnsw-shards-v2' });
```

Users will automatically get the new files on their next visit once the updated service worker activates.

### Step 7 (optional): Add collection navigation to the app

To let users switch between collections, add navigation links that pass different manifest URLs via the query parameter:

```html
<a href="app.html?manifest=data/prwp/manifest.json">Working Papers</a>
<a href="app.html?manifest=data/articles/manifest.json">Journal Articles</a>
```

No other code changes are required — the app reads all collection configuration from the manifest.

---

## 10. Troubleshooting

### Worker resolves manifest URL relative to its own path

**Symptom:** The worker logs `Failed to fetch manifest: js/search/data/prwp/manifest.json (HTTP 404)`.

**Cause:** The `search.worker.js` file is served from `js/search/`. When the main thread passes a relative path like `'data/prwp/manifest.json'`, the worker resolves it relative to its own URL (`js/search/data/prwp/manifest.json`), not the page's URL.

**Fix:** Always resolve the manifest URL to an absolute URL in the **main thread** before posting it to the worker:

```js
// In app.html onMounted():
const resolvedManifest = new URL(manifestUrl.value, location.href).href;
// resolves to: 'http://localhost:8000/data/prwp/manifest.json'
searchWorker.postMessage({ type: 'init', manifestUrl: resolvedManifest });
```

### FAISS levels bug — wrong threshold for upper-layer nodes

**Symptom:** `upper_layers.json` is unexpectedly large (close to full N), or the HNSW engine cannot find the entry node in `nodeCache` during descent.

**Cause:** `levels[i]` in FAISS is the **number of levels** a node participates in, not the **maximum layer index**. The threshold for an upper-layer node is `levels[i] >= 2`. Using `levels[i] >= 1` includes all nodes; using `levels[i] > max_layer` skips almost all upper-layer nodes.

**Fix:**

```python
# Correct: upper-layer nodes have levels[i] >= 2
num_levels = int(levels[node_id])
if num_levels < 2:
    continue  # layer-0-only node, skip

actual_max_layer = num_levels - 1  # 0-indexed
for l in range(1, num_levels):     # layers 1 through actual_max_layer
    nbrs = get_hnsw_neighbors(hnsw, offsets, flat_neighbors, node_id, l)
```

### Transformers.js v3 API change — wrong embedding call

**Symptom:** `TypeError: extractor.model is not a function` or `TypeError: extractor.tokenizer is not a function`.

**Cause:** Transformers.js v2 required separate `tokenizer` and `model` calls. Version 3 changed the API to call the pipeline directly with options.

**Fix (v3 API):**

```js
// Correct for Transformers.js v3:
const output = await extractor(text, { pooling: 'mean', normalize: false });
const raw = new Float32Array(output.data);
l2NormalizeInPlace(raw);
```

**Wrong (v2 style, will fail in v3):**

```js
// Do NOT use this — will throw in Transformers.js v3:
const encoded = await extractor.tokenizer(text);
const output = await extractor.model(encoded);
```

### Vuetify icon set must be `defaultSet: 'mdi'`

**Symptom:** All icons render as empty squares or raw text like `mdi-magnify`.

**Cause:** Vuetify 3 requires an explicit icon set configuration. Passing a custom icon object or omitting `defaultSet` causes a silent fallback that renders nothing.

**Fix:**

```js
const vuetify = createVuetify({
  icons: { defaultSet: 'mdi' },
  theme: { defaultTheme: 'light' },
});
```

Ensure the MDI icon font is loaded in the HTML `<head>`:

```html
<link href="https://cdn.jsdelivr.net/npm/@mdi/font@latest/css/materialdesignicons.min.css" rel="stylesheet">
```

### Two `pendingResolve` variables in the same scope — hung promises

**Symptom:** Search queries hang indefinitely in `test-hnsw-search.html`; the `results` message is received (visible in the log) but the `sendSearch()` promise never resolves.

**Cause:** If `pendingResolve` is declared with `let` inside an inner function scope, a second declaration in a closure captures a different variable from the one the message handler updates. The message handler resolves the inner binding; the outer `sendSearch` awaits the outer binding, which is never resolved.

**Fix:** Declare `pendingResolve` at the enclosing scope (outside both `sendSearch` and the message handler) and access it consistently:

```js
// Declare ONCE in the setup() closure, outside runTestSuite()
let pendingResolve = null;

function sendSearch(text) {
  return new Promise((resolve) => {
    pendingResolve = resolve;  // sets the single shared variable
    worker.postMessage({ type: 'search', text, topK: topK.value, ef: efSearch.value });
  });
}

// In the worker.onmessage handler:
} else if (msg.type === 'results') {
  if (pendingResolve) {
    pendingResolve(msg);
    pendingResolve = null;
  }
}
```

### Shards returning 503 offline error

**Symptom:** Search fails offline with `{ error: 'offline', url: '...' }` even after visiting the page before.

**Cause:** The service worker has not yet cached the specific shard files needed by this query. Only shards that have been fetched at least once (in the current cache version) are stored.

**Fix:** Shards are cached lazily on first use. After a few online sessions covering diverse queries, most shards will be cached. For guaranteed offline support, add a pre-caching step in the service worker's `install` event that fetches all shard URLs listed in the manifest. Alternatively, ensure users run at least one online query session before going offline.

### GitHub Pages: 404 or 500 for shard/index files

**Symptom:** `shard_NNN.json` or `.json.gz` returns 404 or 500 when deployed to GitHub Pages.

**Cause:** GitHub Pages does not serve pre-compressed `.gz` files correctly (can cause 500 errors). If you built with `--compress=gzip`, the index files are `.json.gz` and may fail on GitHub Pages.

**Fix:** Use uncompressed `.json` for GitHub Pages deployment:

```bash
# Option 1: Build with --compress=none
python 03_build_index.py --output_dir=../../data/prwp --compress=none

# Option 2: Decompress existing .gz output (after building with gzip)
python decompress_for_github_pages.py --output_dir=../../data/prwp
```

Then commit and push the `.json` files and updated `manifest.json`.

### Init timeout

**Symptom:** `Error: Init timeout (60s)` in the log panel of `test-hnsw-search.html`.

**Cause:** Usually the embedding model download is slow (first visit, ~30 MB ONNX file) or the network is unavailable.

**Fix:** Check the browser's Network tab for the model download request. If the model is being fetched for the first time on a slow connection, consider hosting the ONNX file on a CDN closer to users. If the CDN is unreachable (e.g., behind a firewall), set `env.allowRemoteModels = false` in `search.worker.js` and serve the model files from your own origin, updating the model path in the worker's `loadModel()` call.
