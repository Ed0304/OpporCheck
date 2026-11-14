"""OpporCheck backend: document utilities for opportunity review.

Run (from the backend/ directory, fresh shell):
    .venv/Scripts/activate        # Windows PowerShell
    uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .documents import DocumentError, MAX_PDF_BYTES, extract_pdf_text

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


@app.post("/api/v1/documents/extract")
async def extract_document(file: UploadFile = File(...)) -> JSONResponse:
    """Extract embedded text from an uploaded PDF (stateless, nothing stored)."""
    filename = file.filename or "upload.pdf"
    if file.content_type and file.content_type != "application/pdf":
        return JSONResponse(
            status_code=400,
            content={
                "error": f'"{filename}" was sent as {file.content_type}. '
                "Please upload a PDF file."
            },
        )
    content = await file.read(MAX_PDF_BYTES + 1)
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
        }
    )
