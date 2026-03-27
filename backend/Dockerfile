FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy requirements
COPY requirements.txt .

# Install dependencies using uv
RUN uv pip install --no-cache-dir --system -r requirements.txt

# Copy project files
COPY . .

# Ensure start.sh is executable
RUN chmod +x start.sh

CMD ["./start.sh"]
