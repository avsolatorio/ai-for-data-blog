"""
add_bm25_corpus.py
==================
One-off: add index/bm25_corpus.json and manifest entry to an existing index
that was built without BM25 (e.g. older pipeline or different repo).

Reads metadata.json (or index/titles.json as fallback for id/title) and
writes index/bm25_corpus.json, then updates manifest.json.

Usage:
  # From repo root, for semantic-search/data/prwp (default)
  uv run python search/pipeline/add_bm25_corpus.py

  # Custom path
  uv run python search/pipeline/add_bm25_corpus.py --data_dir=semantic-search/data/prwp
"""

import json
import fire
from pathlib import Path


def add_bm25_corpus(data_dir: str = "semantic-search/data/prwp") -> None:
    data_path = Path(data_dir)
    if not data_path.is_dir():
        raise SystemExit(f"Not a directory: {data_path}")

    metadata_path = data_path / "metadata.json"
    manifest_path = data_path / "manifest.json"
    index_dir = data_path / "index"
    bm25_path = index_dir / "bm25_corpus.json"

    if not metadata_path.exists():
        raise SystemExit(f"Missing metadata.json at {metadata_path}")

    index_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading {metadata_path}...")
    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    n = len(metadata)
    bm25_corpus = []
    for i, meta in enumerate(metadata):
        doc_id = meta.get("id", meta.get("idno", str(i)))
        title = meta.get("title", "")
        text = meta.get("text", meta.get("abstract", ""))
        bm25_corpus.append({"id": doc_id, "title": title, "text": text})

    with open(bm25_path, "w", encoding="utf-8") as f:
        json.dump(bm25_corpus, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = bm25_path.stat().st_size / 1024
    print(f"Wrote {bm25_path} ({n} entries, {size_kb:.1f} KB)")

    if not manifest_path.exists():
        print(f"No manifest at {manifest_path}; skipping manifest update.")
        return

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    if "index" not in manifest:
        manifest["index"] = {}
    manifest["index"]["bm25_corpus"] = "index/bm25_corpus.json"

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Updated {manifest_path} with index.bm25_corpus")
    print("Done. Reload the search demo; BM25 / ?skipModel=1 should now return results.")


if __name__ == "__main__":
    fire.Fire(add_bm25_corpus)
