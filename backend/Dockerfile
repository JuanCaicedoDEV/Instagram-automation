FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    httpx \
    python-multipart \
    asyncpg \
    pydantic-settings \
    sqlalchemy \
    google-genai \
    supabase \
    python-magic \
    Pillow

# Copy application code
COPY . /app

# Expose port
EXPOSE 8000

# Command to run the application
# We use shell form to allow environment variable expansion for $PORT
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
