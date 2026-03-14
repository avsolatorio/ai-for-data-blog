"""
01_fetch_and_prepare.py
=======================
Generic document ingestion — produces metadata.json ready for 02_generate_embeddings.py.

Supported sources:
  --source=worldbank_api   World Bank search API (PRWP, WDRs, etc.)
  --source=excel           Excel/CSV file
  --source=json            JSON / NDJSON file

Usage examples:
  # Fetch all Policy Research Working Papers
  python 01_fetch_and_prepare.py \\
    --source=worldbank_api \\
    --doctype="Policy Research Working Paper" \\
    --output_dir=data/prwp \\
    --content_fields="title,abstract" \\
    --preview_fields="idno,title,abstract,type,doi,url,date_published"

  # WDI indicators from Excel
  python 01_fetch_and_prepare.py \\
    --source=excel \\
    --input_file=data/WDIEXCEL.xlsx \\
    --sheet_name=Series \\
    --id_field="Series Code" \\
    --content_fields="Indicator Name,Long definition,Short definition" \\
    --preview_fields="Series Code,Indicator Name,Long definition,Short definition,Source" \\
    --output_dir=data/wdi

  # Generic JSON
  python 01_fetch_and_prepare.py \\
    --source=json \\
    --input_file=my_docs.json \\
    --id_field=id \\
    --content_fields="title,body" \\
    --output_dir=data/my_collection
"""
import json
import time
import fire
import requests
from pathlib import Path
from typing import Optional


# ── World Bank API ────────────────────────────────────────────────────────────

WB_SEARCH_API = "https://search.worldbank.org/api/v2/wds"


def _clean_text(text) -> str:
    """Normalize whitespace and strip leading/trailing spaces."""
    if not text:
        return ""
    import re
    return re.sub(r"\s+", " ", str(text)).strip()


def _wb_fetch_batch(doctype: str, offset: int, rows: int = 1000, lang: str = "en") -> dict:
    params = {
        "format": "json",
        "rows": rows,
        "os": offset,
        "srt": "docdt",
        "order": "desc",
        "apilang": lang,
        "lang_exact": "English",
        "docty_exact": doctype,
    }
    resp = requests.get(WB_SEARCH_API, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def _extract_wb_doc(doc: dict, preview_field_list: list, content_field_list: list) -> dict:
    """Normalize a World Bank API document into our standard format."""
    idno = doc.get("id", doc.get("docdt", ""))
    title = _clean_text(doc.get("display_title") or doc.get("docna", ""))
    abstract = _clean_text(
        doc.get("abstracts", {}).get("cdata!", "") or doc.get("abstracts", {}).get("#text", "") or ""
    )
    doi = doc.get("doi", "")
    url = doc.get("url", doc.get("pdfurl", ""))
    dtype = doc.get("docty", doc.get("majdocty", ""))
    date_pub = doc.get("docdt", "")
    authors_raw = doc.get("authr", "")
    source = doc.get("colti", doc.get("repnb", ""))

    # Compose content text for embedding
    content_parts = []
    for field in content_field_list:
        if field == "title":
            content_parts.append(title)
        elif field == "abstract":
            content_parts.append(abstract)
        else:
            val = _clean_text(doc.get(field, ""))
            if val:
                content_parts.append(val)
    content = "\n\n".join(p for p in content_parts if p)

    record = {
        "id": str(idno),
        "idno": str(idno),
        "title": title,
        "abstract": abstract,
        "type": dtype,
        "doi": doi,
        "url": url,
        "date_published": date_pub,
        "authors": authors_raw,
        "source": source,
        "content": content,
    }
    return record


def fetch_worldbank_api(
    doctype: str,
    output_dir: Path,
    content_fields: list,
    preview_field_list: list,
    max_docs: int = 0,
    batch_size: int = 1000,
    retry_delay: float = 5.0,
):
    print(f"Fetching '{doctype}' from World Bank API...")
    all_docs = []
    offset = 0

    # Get total count first
    try:
        first = _wb_fetch_batch(doctype, 0, rows=1)
        total = int(first.get("total", 0))
    except Exception as e:
        print(f"  Warning: could not get total count: {e}")
        total = None

    if total:
        print(f"  Total available: {total} documents")
        if max_docs > 0:
            total = min(total, max_docs)
            print(f"  Fetching up to: {max_docs}")

    while True:
        if max_docs > 0 and offset >= max_docs:
            break
        rows = min(batch_size, max_docs - offset) if max_docs > 0 else batch_size

        for attempt in range(3):
            try:
                data = _wb_fetch_batch(doctype, offset, rows=rows)
                break
            except Exception as e:
                if attempt == 2:
                    raise
                print(f"  Retry {attempt+1}/3 after error: {e}")
                time.sleep(retry_delay)

        docs = data.get("documents", {})
        if not docs:
            break

        # API returns dict keyed by doc id
        batch = [_extract_wb_doc(d, preview_field_list, content_fields) for d in docs.values()
                 if isinstance(d, dict)]
        all_docs.extend(batch)
        offset += len(batch)
        total_str = f"/{total}" if total else ""
        print(f"  Fetched {offset}{total_str} documents...", end="\r")

        if len(batch) < rows:
            break  # last page

    print(f"\n  Total fetched: {len(all_docs)}")
    return all_docs


def fetch_excel(
    input_file: str,
    id_field: str,
    content_fields: list,
    preview_field_list: list,
    sheet_name: Optional[str] = None,
) -> list:
    import pandas as pd
    print(f"Loading Excel/CSV: {input_file}")

    if input_file.endswith(".csv"):
        df = pd.read_csv(input_file)
    else:
        kwargs = {"sheet_name": sheet_name} if sheet_name else {}
        df = pd.read_excel(input_file, **kwargs)

    print(f"  {len(df)} rows, columns: {list(df.columns)[:10]}...")

    # Merge content fields; fall back to next non-null for WDI-style definitions
    def get_content(row):
        parts = []
        for field in content_fields:
            if field in row and pd.notna(row[field]) and str(row[field]).strip():
                parts.append(str(row[field]).strip())
            elif field == content_fields[-1] and not parts:
                # WDI: if Long definition is null, use Short definition
                for fallback in ["Short definition", "short_definition"]:
                    if fallback in row and pd.notna(row[fallback]):
                        parts.append(str(row[fallback]).strip())
                        break
        return "\n\n".join(parts)

    docs = []
    for _, row in df.iterrows():
        raw_id = row.get(id_field, row.get("id", ""))
        record = {
            "id": str(raw_id),
            "content": get_content(row),
        }
        for field in preview_field_list:
            val = row.get(field)
            if val is not None and str(val) != "nan":
                record[field] = str(val).strip()
        docs.append(record)

    return docs


def fetch_json_file(
    input_file: str,
    id_field: str,
    content_fields: list,
    preview_field_list: list,
) -> list:
    print(f"Loading JSON: {input_file}")
    with open(input_file) as f:
        data = json.load(f)

    if isinstance(data, dict):
        # Support NDJSON-style or dict-of-records
        records = list(data.values()) if all(isinstance(v, dict) for v in data.values()) else [data]
    else:
        records = data

    docs = []
    for item in records:
        content_parts = [_clean_text(item.get(f, "")) for f in content_fields if item.get(f)]
        record = {
            "id": str(item.get(id_field, item.get("id", ""))),
            "content": "\n\n".join(p for p in content_parts if p),
        }
        for field in preview_field_list:
            if field in item:
                record[field] = item[field]
        docs.append(record)

    print(f"  {len(docs)} records loaded")
    return docs


def main(
    source: str = "worldbank_api",       # worldbank_api | excel | json
    output_dir: str = "data/collection",

    # World Bank API
    doctype: str = "Policy Research Working Paper",
    max_docs: int = 0,                    # 0 = all

    # Excel/CSV/JSON
    input_file: Optional[str] = None,
    sheet_name: Optional[str] = None,

    # Field configuration (comma-separated)
    id_field: str = "idno",
    content_fields: str = "title,abstract",   # fields joined for embedding content
    preview_fields: str = "idno,title,abstract,type,doi,url,date_published",
):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    content_field_list = [f.strip() for f in content_fields.split(",")]
    preview_field_list = [f.strip() for f in preview_fields.split(",")]

    if source == "worldbank_api":
        docs = fetch_worldbank_api(
            doctype=doctype,
            output_dir=output_dir,
            content_fields=content_field_list,
            preview_field_list=preview_field_list,
            max_docs=max_docs,
        )
    elif source == "excel":
        if not input_file:
            raise ValueError("--input_file required for source=excel")
        docs = fetch_excel(input_file, id_field, content_field_list, preview_field_list, sheet_name)
    elif source == "json":
        if not input_file:
            raise ValueError("--input_file required for source=json")
        docs = fetch_json_file(input_file, id_field, content_field_list, preview_field_list)
    else:
        raise ValueError(f"Unknown source: {source}. Use worldbank_api, excel, or json.")

    # Filter out docs with no content
    before = len(docs)
    docs = [d for d in docs if d.get("content", "").strip()]
    if len(docs) < before:
        print(f"  Filtered {before - len(docs)} docs with empty content → {len(docs)} remaining")

    out_path = output_dir / "metadata.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(docs)} documents → {out_path}")
    print(f"\nDone! Next: run 02_generate_embeddings.py --metadata_path={out_path} --output_dir={output_dir}")


if __name__ == "__main__":
    fire.Fire(main)
