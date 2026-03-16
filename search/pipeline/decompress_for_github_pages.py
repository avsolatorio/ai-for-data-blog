#!/usr/bin/env python3
"""
Decompress .json.gz index files to .json for GitHub Pages deployment.

GitHub Pages does not serve pre-compressed .gz files correctly (500 errors).
Run this after 03_build_index.py with --compress=gzip to produce .json files
for deployment to GitHub Pages.

Alternatively, build the index with ``--compress=none`` from the start to
skip compression entirely and avoid this extra step.

Usage:
  python decompress_for_github_pages.py --output_dir=../../data/prwp
"""

import gzip
import json
import fire
from pathlib import Path


def main(output_dir: str = "data/collection") -> None:
    """Decompress all .json.gz index files back to plain .json.

    Walks the standard pipeline output layout under ``output_dir`` and
    decompresses every gzip-compressed file in-place, then rewrites
    ``manifest.json`` to reference the uncompressed paths.

    Handles the following files:
      - ``flat/embeddings.int8.json.gz``
      - ``index/config.json.gz``
      - ``index/upper_layers.json.gz``
      - ``index/node_to_shard.json.gz``
      - ``index/cluster_centroids.json.gz``
      - ``index/titles.json.gz``
      - ``index/bm25_corpus.json.gz``
      - ``index/layer0/shard_*.json.gz``

    Args:
        output_dir: Root directory of the pipeline output (contains
            ``manifest.json``).

    Raises:
        FileNotFoundError: If ``output_dir`` does not exist.
    """
    output_path = Path(output_dir)
    if not output_path.exists():
        raise FileNotFoundError(f"Output dir not found: {output_path}")

    # 1. Decompress flat index
    flat_gz = output_path / "flat" / "embeddings.int8.json.gz"
    if flat_gz.exists():
        with gzip.open(flat_gz, "rt", encoding="utf-8") as f:
            data = json.load(f)
        flat_json = flat_gz.with_suffix("")
        with open(flat_json, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"Decompressed {flat_gz.name} -> {flat_json.name}")

    # 2. Decompress index files
    index_dir = output_path / "index"
    for name in (
        "config",
        "upper_layers",
        "node_to_shard",
        "cluster_centroids",
        "titles",
        "bm25_corpus",
    ):
        gz_path = index_dir / f"{name}.json.gz"
        if gz_path.exists():
            with gzip.open(gz_path, "rt", encoding="utf-8") as f:
                data = json.load(f)
            json_path = index_dir / f"{name}.json"
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            print(f"Decompressed index/{name}.json.gz -> index/{name}.json")

    # 3. Decompress layer0 shards
    layer0 = index_dir / "layer0"
    if layer0.exists():
        for gz_path in sorted(layer0.glob("shard_*.json.gz")):
            with gzip.open(gz_path, "rt", encoding="utf-8") as f:
                data = json.load(f)
            json_path = gz_path.with_suffix("")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, separators=(",", ":"))
            print(f"Decompressed layer0/{gz_path.name} -> layer0/{json_path.name}")

    # 4. Update manifest to use .json paths (remove compressed flag)
    manifest_path = output_path / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
        manifest["flat"]["path"] = "flat/embeddings.int8.json"
        if "index" in manifest:
            manifest["index"]["config"] = "index/config.json"
            manifest["index"]["titles"] = "index/titles.json"
            manifest["index"]["upper_layers"] = "index/upper_layers.json"
            manifest["index"]["node_to_shard"] = "index/node_to_shard.json"
            # Update bm25_corpus path if present
            if "bm25_corpus" in manifest["index"]:
                manifest["index"]["bm25_corpus"] = "index/bm25_corpus.json"
        manifest["compressed"] = False
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"Updated manifest.json (compressed: false)")

    print("\nDone. Commit and push for GitHub Pages deployment.")


if __name__ == "__main__":
    fire.Fire(main)
