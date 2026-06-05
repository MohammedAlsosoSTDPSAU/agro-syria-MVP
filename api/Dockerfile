# Agro-Syria FastAPI backend — deploy with Root Directory = api
# Works on Render, Railway, Fly.io, or any container host.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code (build context = the api/ directory).
COPY . .

# Cloud hosts inject $PORT; main.py binds 0.0.0.0 and reads it.
EXPOSE 8000
CMD ["python", "main.py"]
