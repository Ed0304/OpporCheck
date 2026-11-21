# OpporCheck FastAPI backend (Phase 2.6B).
#
# Production-oriented image: Python 3.13 slim, full OCR stack, baked
# PaddleOCR v6-small models, Uvicorn on the platform-provided $PORT.
# No documents, no credentials, no test code inside.
#
# Build context is the backend/ directory (Railway Root Directory).
# NOT validated with a real `docker build` in this environment (no
# container runtime available) — validate on first use, see report.

FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PADDLE_PDX_CACHE_HOME=/opt/models \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

WORKDIR /srv

# PaddlePaddle's OpenMP runtime (the one system library the wheels need).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ocr.txt ./
RUN pip install --no-cache-dir -r requirements-ocr.txt

COPY app ./app
COPY scripts/download_models.py ./scripts/download_models.py

# Bake the pinned OCR models into the image so cold starts never download.
RUN python scripts/download_models.py \
    && rm -rf /root/.cache/pip /tmp/*

EXPOSE 8080

# Shell form so Railway's injected $PORT (or 8080 locally) is honored.
# 0.0.0.0 is REQUIRED inside a container; loopback-only applies to bare
# `uvicorn` runs on a dev machine, not here.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
