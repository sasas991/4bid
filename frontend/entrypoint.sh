#!/bin/sh
set -e

LOCKFILE_HASH_FILE="/app/node_modules/.package-lock.hash"
CURRENT_LOCKFILE_HASH="$(sha256sum /app/package-lock.json | awk '{print $1}')"
INSTALLED_LOCKFILE_HASH=""

if [ -f "$LOCKFILE_HASH_FILE" ]; then
  INSTALLED_LOCKFILE_HASH="$(cat "$LOCKFILE_HASH_FILE")"
fi

if [ ! -d /app/node_modules ] || [ "$CURRENT_LOCKFILE_HASH" != "$INSTALLED_LOCKFILE_HASH" ]; then
  echo "Installing frontend dependencies..."
  npm install --no-audit --no-fund
  mkdir -p /app/node_modules
  printf "%s" "$CURRENT_LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
fi

echo "Waiting for backend..."
until wget -qO /app/openapi.json http://backend:8000/openapi.json 2>/dev/null; do
  sleep 1
done
echo "OpenAPI schema downloaded"

echo "Generating API client..."
npx orval
echo "API client generated"

exec npm run dev -- --hostname 0.0.0.0
