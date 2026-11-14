# OpporCheck backend

FastAPI service for document utilities. Currently one endpoint: stateless PDF
text extraction for opportunity review uploads (no storage, no OCR, no AI
inference — analysis stays in the frontend via Firebase AI Logic).

## Setup (Windows PowerShell, from `backend/`)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
.venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8000
```

Health check: `GET http://localhost:8000/health`

Extract endpoint: `POST http://localhost:8000/api/v1/documents/extract`
(multipart field `file`, PDF up to 10 MB)

Set `FRONTEND_ORIGINS` (comma-separated) to allow other dev origins.
