FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source files
COPY bot.py .
COPY strategy.py .
COPY indicators.py .
COPY dashboard.py .
COPY start.py .

CMD ["python", "start.py"]
