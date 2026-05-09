# Build from repo root:
#   docker build -f scraper/Dockerfile scraper
# Or set Railway/Fly "Root Directory" to `scraper` and use this Dockerfile.

FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chromium for Playwright scrapers (StockX, etc.)
RUN playwright install --with-deps chromium

COPY . .

# `scraper` is a directory, not a command — never use CMD ["scraper"].
# Run the pipeline (adjust if you use a scheduler entrypoint).
CMD ["python", "pipeline.py"]
