"""
Offline prospectus indexer: download PDF from Supabase Storage → chunk → embed → prospectus_chunks.

Run from jobs/indexer after copying .env.example → .env:
  python -m venv .venv
  .venv\\Scripts\\activate   # Windows
  pip install -r requirements.txt
  python indexer.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from io import BytesIO

import psycopg2
import pypdf
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536


def require_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        print(f"Missing env: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def chunk_text(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP
        if start < 0:
            start = 0
    return [c for c in chunks if c]


def pdf_to_text(data: bytes) -> str:
    reader = pypdf.PdfReader(BytesIO(data))
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(f"\n--- page {i + 1} ---\n{t}")
    return "\n".join(parts)


def vector_literal(values: list[float]) -> str:
    if len(values) != EMBED_DIM:
        raise ValueError(f"expected {EMBED_DIM} dims, got {len(values)}")
    return "[" + ",".join(str(float(x)) for x in values) + "]"


def main() -> None:
    supabase_url = require_env("SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    database_url = require_env("DATABASE_URL")
    openai_key = require_env("OPENAI_API_KEY")
    ipo_id = require_env("IPO_ID")
    storage_path = require_env("STORAGE_OBJECT_PATH")

    client = create_client(supabase_url, service_key)
    dl = client.storage.from_("prospectus").download(storage_path)
    if not dl:
        print("Empty download from storage", file=sys.stderr)
        sys.exit(1)
    data = dl if isinstance(dl, (bytes, bytearray)) else bytes(dl)

    text = pdf_to_text(data)
    chunks = chunk_text(text)
    if not chunks:
        print("No text extracted from PDF; check file or add OCR later.", file=sys.stderr)
        sys.exit(1)

    oai = OpenAI(api_key=openai_key)
    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("delete from public.prospectus_chunks where ipo_id = %s::uuid", (ipo_id,))
            for idx, content in enumerate(chunks):
                emb_resp = oai.embeddings.create(model=EMBED_MODEL, input=content)
                vec = emb_resp.data[0].embedding
                lit = vector_literal(vec)
                cur.execute(
                    """
                    insert into public.prospectus_chunks
                      (ipo_id, chunk_index, content, metadata, embedding)
                    values (%s::uuid, %s, %s, %s::jsonb, %s::extensions.vector)
                    """,
                    (ipo_id, idx, content, json.dumps({"chunk_chars": len(content)}), lit),
                )
            cur.execute(
                "update public.ipos set indexed_at = now(), updated_at = now() where id = %s::uuid",
                (ipo_id,),
            )
        conn.commit()
        print(f"Indexed {len(chunks)} chunks for ipo_id={ipo_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
