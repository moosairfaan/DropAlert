# Railway: set service Root Directory to `scraper`, or use repo-root Dockerfile.
FROM mcr.microsoft.com/playwright/python:v1.59.0-noble

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

# Default: long-running scheduler (every 30 min). Override with SCRAPER_MODE or start command.
CMD ["./start.sh"]
