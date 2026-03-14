"""
pipeline.py — End-to-end CLI orchestrator
==========================================
Runs all three pipeline steps in order:
  01_fetch_and_prepare.py  → metadata.json
  02_generate_embeddings.py → raw_embeddings.npy + flat/embeddings.int8.json
  03_build_index.py         → manifest.json + index/

Usage:
  # PRWP (full run, fetch from API)
  python pipeline.py prwp \\
    --source=worldbank_api \\
    --doctype="Policy Research Working Paper" \\
    --model=avsolatorio/GIST-small-Embedding-v0 \\
    --output_dir=../../data/prwp

  # WDI from local Excel
  python pipeline.py wdi \\
    --source=excel \\
    --input_file=../../data/WDIEXCEL.xlsx \\
    --sheet_name=Series \\
    --id_field="Series Code" \\
    --content_fields="Indicator Name,Long definition,Short definition" \\
    --preview_fields="Series Code,Indicator Name,Long definition,Short definition,Source" \\
    --model=avsolatorio/GIST-small-Embedding-v0 \\
    --output_dir=../../data/wdi \\
    --flat_threshold=2000

  # Skip fetch (use existing metadata.json)
  python pipeline.py prwp --skip_fetch \\
    --model=avsolatorio/GIST-small-Embedding-v0 \\
    --output_dir=../../data/prwp

  # Skip fetch + embedding (use existing raw_embeddings.npy)
  python pipeline.py prwp --skip_fetch --skip_embed \\
    --output_dir=../../data/prwp

  # With Matryoshka truncation (MRL-trained models only)
  python pipeline.py my_collection \\
    --source=json \\
    --input_file=my_docs.json \\
    --model=nomic-ai/nomic-embed-text-v1.5 \\
    --matryoshka_dim=128 \\
    --output_dir=../../data/my_collection
"""
import sys
import fire
from pathlib import Path


def main(
    collection_id: str,

    # Step 1: fetch / prepare
    source: str = "worldbank_api",
    doctype: str = "Policy Research Working Paper",
    input_file: str = None,
    sheet_name: str = None,
    id_field: str = "idno",
    content_fields: str = "title,abstract",
    preview_fields: str = "idno,title,abstract,type,doi,url,date_published",
    bm25_fields: str = "title,text",
    max_docs: int = 0,

    # Step 2: embedding
    model: str = "avsolatorio/GIST-small-Embedding-v0",
    batch_size: int = 64,
    matryoshka_dim: int = None,
    title_field: str = "title",
    bm25_text_field: str = "abstract",

    # Step 3: index building
    hnsw_M: int = 16,
    ef_construction: int = 200,
    flat_threshold: int = 2000,
    n_clusters: int = None,
    kmeans_niter: int = 30,

    # Control
    output_dir: str = None,
    skip_fetch: bool = False,
    skip_embed: bool = False,
    seed: int = 42,
):
    if output_dir is None:
        output_dir = f"../../data/{collection_id}"

    output_path = Path(output_dir)
    print(f"\n{'='*60}")
    print(f"Pipeline: {collection_id}")
    print(f"Output:   {output_path.resolve()}")
    print(f"{'='*60}\n")

    # ── Step 1: Fetch & prepare ──────────────────────────────────────────────
    if not skip_fetch:
        print("Step 1: Fetching and preparing documents...")
        from importlib import import_module
        sys.path.insert(0, str(Path(__file__).parent))
        from importlib.machinery import SourceFileLoader
        fetch_mod = SourceFileLoader("fetch", str(Path(__file__).parent / "01_fetch_and_prepare.py")).load_module()

        fetch_mod.main(
            source=source,
            output_dir=str(output_path),
            doctype=doctype,
            max_docs=max_docs,
            input_file=input_file,
            sheet_name=sheet_name,
            id_field=id_field,
            content_fields=content_fields,
            preview_fields=preview_fields,
        )
    else:
        print("Step 1: Skipped (--skip_fetch)")

    # ── Step 2: Generate embeddings ──────────────────────────────────────────
    if not skip_embed:
        print("\nStep 2: Generating embeddings and quantizing...")
        from importlib.machinery import SourceFileLoader
        embed_mod = SourceFileLoader("embed", str(Path(__file__).parent / "02_generate_embeddings.py")).load_module()

        meta_path = str(output_path / "metadata.json")
        embed_mod.main(
            metadata_path=meta_path,
            output_dir=str(output_path),
            model=model,
            batch_size=batch_size,
            id_field=id_field,
            content_field=content_fields.split(",")[1] if "," in content_fields else content_fields,
            title_field=title_field,
            preview_fields=preview_fields,
            matryoshka_dim=matryoshka_dim,
            bm25_text_field=bm25_text_field,
            seed=seed,
        )
    else:
        print("Step 2: Skipped (--skip_embed)")

    # ── Step 3: Build index ──────────────────────────────────────────────────
    print("\nStep 3: Building search index...")
    from importlib.machinery import SourceFileLoader
    index_mod = SourceFileLoader("index", str(Path(__file__).parent / "03_build_index.py")).load_module()

    index_mod.main(
        output_dir=str(output_path),
        collection_id=collection_id,
        model_id=model,
        hnsw_M=hnsw_M,
        ef_construction=ef_construction,
        flat_threshold=flat_threshold,
        n_clusters=n_clusters,
        kmeans_niter=kmeans_niter,
        preview_fields=preview_fields,
        bm25_fields=bm25_fields,
        seed=seed,
    )

    print(f"\n{'='*60}")
    print(f"Pipeline complete! Index ready at: {output_path.resolve()}")
    print(f"Load manifest at: {(output_path / 'manifest.json').resolve()}")
    print(f"{'='*60}")


if __name__ == "__main__":
    fire.Fire(main)
