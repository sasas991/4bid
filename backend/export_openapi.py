"""Export OpenAPI schema to JSON file for client generation."""
import json
import sys
from pathlib import Path

# Patch database to avoid connection requirement during schema export
from unittest.mock import MagicMock
sys.modules["aiohttp"] = MagicMock()

from app.main import app

schema = app.openapi()
output = Path(__file__).parent.parent / "frontend" / "openapi.json"
output.write_text(json.dumps(schema, indent=2, default=str))
print(f"OpenAPI schema exported to {output}")
