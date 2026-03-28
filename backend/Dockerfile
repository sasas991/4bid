FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies using uv
RUN pip install --no-cache-dir --system -r requirements.txt

# Copy project files
COPY . .

RUN alembic upgrade head

RUN fastapi run main.py
