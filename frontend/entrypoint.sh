#!/bin/sh
set -e

echo "Waiting for backend..."
until wget -qO /app/openapi.json http://backend:8000/openapi.json 2>/dev/null; do
  sleep 1
done
echo "OpenAPI schema downloaded"

echo "Generating API client..."
npx orval
echo "API client generated"

exec npm run dev -- --hostname 0.0.0.0
