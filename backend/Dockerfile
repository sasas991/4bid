FROM python:3.14-slim

WORKDIR /app

COPY pyproject.toml .

RUN pip install --no-cache-dir .

COPY . .

CMD ["fastapi", "dev", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
