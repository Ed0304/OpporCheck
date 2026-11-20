"""OpporCheck backend: document utilities and official-source retrieval.

Run (from the backend/ directory, fresh shell):
    .venv/Scripts/activate        # Windows PowerShell
    uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .corridors import (
    DEFAULT_PROFILE,
    get_profile,
    list_profiles,
    profile_catalog,
    profile_urls,
)
from .documents import DocumentError, MAX_PDF_BYTES, extract_pdf_text
from .ocr import (
    DEFAULT_LANGUAGE,
    MAX_IMAGE_BYTES,
    OCRError,
    extract_image_text,
    sanitize_filename,
)
from .official_sources import retrieve_sources

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="OpporCheck backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class RetrieveRequest(BaseModel):
    """Source ids come from GET /api/v1/sources; raw URLs are never accepted."""

    source_ids: list[str] | None = Field(default=None, max_length=10)
    queries: list[str] = Field(default_factory=list, max_length=10)
    profile: str | None = Field(default=None, max_length=8)


@app.get("/api/v1/corridors")
def list_corridors() -> dict:
    """Supported investigation corridors and their verification status."""
    return {"default": DEFAULT_PROFILE, "corridors": list_profiles()}


@app.get("/api/v1/sources")
def list_sources(profile: str | None = None) -> dict:
    """The approved official-source catalog for one corridor (GB by default)."""
    try:
        resolved = get_profile(profile)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    catalog = profile_catalog(resolved.code)
    return {
        "corridor": resolved.display_name,
        "code": resolved.code,
        "status": resolved.status,
        "sources": [
            {
                "source_id": source.id,
                "label": source.label,
                "url": source.url,
                "category": source.category,
            }
            for source in catalog.values()
        ],
    }


@app.post("/api/v1/sources/retrieve")
def retrieve_official_sources(body: RetrieveRequest) -> JSONResponse:
    """Fetches allowlisted pages and returns short excerpts (nothing stored)."""
    try:
        resolved = get_profile(body.profile)
        sources, failures = retrieve_sources(
            body.source_ids,
            body.queries,
            catalog=profile_catalog(resolved.code),
            allowed_urls=profile_urls(resolved.code),
        )
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    return JSONResponse(
        content={
            "sources": [
                {
                    "source_id": source.source_id,
                    "title": source.title,
                    "url": source.url,
                    "retrieved_at": source.retrieved_at,
                    "excerpts": [
                        {"text": excerpt.text, "truncated": excerpt.truncated}
                        for excerpt in source.excerpts
                    ],
                }
                for source in sources
            ],
            "errors": [
                {"source_id": failure.source_id, "url": failure.url, "error": failure.error}
                for failure in failures
            ],
        }
    )


@app.post("/api/v1/documents/extract")
async def extract_document(file: UploadFile = File(...)) -> JSONResponse:
    """Extract embedded text from an uploaded PDF (stateless, nothing stored)."""
    filename = file.filename or "upload.pdf"
    content = await file.read(MAX_PDF_BYTES + 1)
    return extract_response(filename, file.content_type, content)


@app.post("/api/v1/documents/ocr")
async def ocr_document(
    file: UploadFile = File(...), language: str = Form(DEFAULT_LANGUAGE)
) -> JSONResponse:
    """Extract text from an uploaded image with PaddleOCR (stateless)."""
    filename = file.filename or "upload.png"
    content = await file.read(MAX_IMAGE_BYTES + 1)
    return ocr_response(filename, file.content_type, language, content)


def ocr_response(
    filename: str, content_type: str | None, language: str | None, content: bytes
) -> JSONResponse:
    """Validates and OCRs upload bytes. Sync core of the OCR route."""
    try:
        result = extract_image_text(
            filename, content, language=language, content_type=content_type
        )
    except OCRError as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc)})
    text = result.text
    return JSONResponse(
        content={
            "filename": sanitize_filename(filename),
            "text": text,
            "pages": 1,
            "truncated": result.truncated,
            "page_texts": [text],
            "source": "ocr",
            "language": result.language,
            "lines": result.lines,
            "mean_confidence": round(result.mean_confidence, 4),
            "low_confidence_lines": result.low_confidence_lines,
        }
    )


def extract_response(
    filename: str, content_type: str | None, content: bytes
) -> JSONResponse:
    """Validates and extracts upload bytes. Sync core of the extract route."""
    if content_type and content_type != "application/pdf":
        return JSONResponse(
            status_code=400,
            content={
                "error": f'"{filename}" was sent as {content_type}. '
                "Please upload a PDF file."
            },
        )
    try:
        result = extract_pdf_text(filename, content)
    except DocumentError as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc)})
    return JSONResponse(
        content={
            "filename": filename,
            "text": result.text,
            "pages": result.pages,
            "truncated": result.truncated,
            "page_texts": list(result.page_texts),
        }
    )
