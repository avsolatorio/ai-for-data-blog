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


# ── World Bank API ─────────────────────────────────────────────────────────────

WB_SEARCH_API = "https://search.worldbank.org/api/v2/wds"


def _clean_text(text: object) -> str:
    """Normalize whitespace and strip leading/trailing spaces.

    Args:
        text: Any value; will be cast to str. None and empty strings return "".

    Returns:
        Whitespace-normalized string.
    """
    if not text:
        return ""
    import re
    return re.sub(r"\s+", " ", str(text)).strip()


def _wb_fetch_batch(
    doctype: str,
    offset: int,
    rows: int = 1000,
    lang: str = "en",
) -> dict:
    """Fetch a single page of results from the World Bank search API.

    Args:
        doctype: Document type string, e.g. "Policy Research Working Paper".
        offset: Zero-based result offset for pagination.
        rows: Number of rows to request per page.
        lang: API language parameter.

    Returns:
        Parsed JSON response dict from the World Bank API.

    Raises:
        requests.HTTPError: If the HTTP request fails.
    """
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


def _extract_wb_doc(
    doc: dict,
    preview_field_list: list[str],
    content_field_list: list[str],
) -> dict:
    """Normalize a World Bank API document into the standard pipeline format.

    Extracts known fields from the raw API response and assembles the ``content``
    field by joining the requested content fields in order.

    Args:
        doc: Raw document dict from the World Bank API.
        preview_field_list: Fields to include in the output record for display.
        content_field_list: Fields to concatenate into the ``content`` text used
            for embedding. Supports ``"title"`` and ``"abstract"`` as special
            aliases that map to the normalized title/abstract values.

    Returns:
        Normalized record dict with at least ``id``, ``title``, ``abstract``,
        ``content``, and common metadata fields.
    """
    idno = doc.get("id", doc.get("docdt", ""))
    title = _clean_text(doc.get("display_title") or doc.get("docna", ""))
    abstract = _clean_text(
        doc.get("abstracts", {}).get("cdata!", "")
        or doc.get("abstracts", {}).get("#text", "")
        or ""
    )
    doi = doc.get("doi", "")
    url = doc.get("url", doc.get("pdfurl", ""))
    dtype = doc.get("docty", doc.get("majdocty", ""))
    date_pub = doc.get("docdt", "")
    authors_raw = doc.get("authr", "")
    source = doc.get("colti", doc.get("repnb", ""))

    # Compose content text for embedding
    content_parts: list[str] = []
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
    content_fields: list[str],
    preview_field_list: list[str],
    max_docs: int = 0,
    batch_size: int = 1000,
    retry_delay: float = 5.0,
) -> list[dict]:
    """Fetch documents from the World Bank search API with pagination.

    Iterates over all pages of results for the given document type, retrying
    individual batches up to 3 times on transient errors.

    Args:
        doctype: Document type to filter by, e.g. "Policy Research Working Paper".
        output_dir: Destination directory (used only for logging context here).
        content_fields: List of field names to concatenate into the ``content``
            embedding text.
        preview_field_list: List of field names to include in the output record
            for display/preview.
        max_docs: Maximum number of documents to fetch. 0 means fetch all.
        batch_size: Number of documents to request per API call.
        retry_delay: Seconds to wait between retries on API errors.

    Returns:
        List of normalized document dicts.

    Raises:
        requests.HTTPError: If a batch request fails after 3 retries.
    """
    print(f"Fetching '{doctype}' from World Bank API...")
    all_docs: list[dict] = []
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
        batch = [
            _extract_wb_doc(d, preview_field_list, content_fields)
            for d in docs.values()
            if isinstance(d, dict)
        ]
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
    content_fields: list[str],
    preview_field_list: list[str],
    sheet_name: str | None = None,
) -> list[dict]:
    """Load documents from an Excel (.xlsx) or CSV file.

    Merges ``content_fields`` into a single ``content`` string per row, with a
    fallback to the short-definition column when the primary long-definition
    column is empty (WDI-style datasets).

    Args:
        input_file: Path to the .xlsx or .csv file.
        id_field: Column name to use as the document ``id``.
        content_fields: Ordered list of column names to merge into ``content``.
        preview_field_list: Columns to include in the output record.
        sheet_name: Sheet name for .xlsx files; defaults to the first sheet.

    Returns:
        List of document dicts, one per non-empty row.
    """
    import pandas as pd
    print(f"Loading Excel/CSV: {input_file}")

    if input_file.endswith(".csv"):
        df = pd.read_csv(input_file)
    else:
        kwargs = {"sheet_name": sheet_name} if sheet_name else {}
        df = pd.read_excel(input_file, **kwargs)

    print(f"  {len(df)} rows, columns: {list(df.columns)[:10]}...")

    # Merge content fields; fall back to next non-null for WDI-style definitions
    def get_content(row: object) -> str:
        """Assemble content string from ordered content fields for one row.

        Args:
            row: A pandas Series representing a single spreadsheet row.

        Returns:
            Content string with non-empty field values joined by double newlines.
        """
        parts: list[str] = []
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

    docs: list[dict] = []
    for _, row in df.iterrows():
        raw_id = row.get(id_field, row.get("id", ""))
        record: dict = {
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
    content_fields: list[str],
    preview_field_list: list[str],
) -> list[dict]:
    """Load documents from a JSON or NDJSON file.

    Accepts either a JSON array of objects, a dict-of-objects (keyed by any
    string), or a single top-level JSON object.

    Args:
        input_file: Path to the JSON file.
        id_field: Key to use as the document ``id``.
        content_fields: Keys whose values are joined into ``content``.
        preview_field_list: Keys to copy verbatim into the output record.

    Returns:
        List of document dicts.
    """
    print(f"Loading JSON: {input_file}")
    with open(input_file) as f:
        data = json.load(f)

    if isinstance(data, dict):
        # Support NDJSON-style or dict-of-records
        records = list(data.values()) if all(isinstance(v, dict) for v in data.values()) else [data]
    else:
        records = data

    docs: list[dict] = []
    for item in records:
        content_parts = [_clean_text(item.get(f, "")) for f in content_fields if item.get(f)]
        record: dict = {
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
    input_file: str | None = None,
    sheet_name: str | None = None,

    # Field configuration (comma-separated)
    id_field: str = "idno",
    content_fields: str = "title,abstract",   # fields joined for embedding content
    preview_fields: str = "idno,title,abstract,type,doi,url,date_published",
) -> None:
    """Entry point: fetch documents from the specified source and save metadata.json.

    Args:
        source: Data source type. One of ``worldbank_api``, ``excel``, or ``json``.
        output_dir: Directory where ``metadata.json`` will be written.
        doctype: Document type for ``worldbank_api`` source.
        max_docs: Maximum documents to fetch from the API (0 = all).
        input_file: Path to input file for ``excel`` or ``json`` sources.
        sheet_name: Sheet name for Excel files.
        id_field: Field name used as the document identifier.
        content_fields: Comma-separated field names to merge into the ``content``
            text for embedding.
        preview_fields: Comma-separated field names to include in the output
            record for display purposes.

    Raises:
        ValueError: If a required argument is missing or an unknown source is
            given.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    content_field_list = [f.strip() for f in content_fields.split(",")]
    preview_field_list = [f.strip() for f in preview_fields.split(",")]

    if source == "worldbank_api":
        docs = fetch_worldbank_api(
            doctype=doctype,
            output_dir=output_path,
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

    out_path = output_path / "metadata.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(docs)} documents → {out_path}")
    print(f"\nDone! Next: run 02_generate_embeddings.py --metadata_path={out_path} --output_dir={output_path}")


if __name__ == "__main__":
    fire.Fire(main)
