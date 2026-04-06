from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import aiohttp
import traceback
import time
import subprocess
from .api import api_router
from .core.config import settings
from .core.database import SessionLocal, engine, Base
from .services.s3_service import ensure_bucket_exists

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: wait for DB to be ready, then initialize DB schema and create aiohttp session
    max_retries = 30
    for attempt in range(max_retries):
        try:
            conn = engine.connect()
            conn.close()
            break
        except Exception:
            if attempt == max_retries - 1:
                raise
            time.sleep(1)
    Base.metadata.create_all(bind=engine)
    ensure_bucket_exists()
    # Apply any pending Alembic migrations via the CLI (avoids the local
    # alembic/ directory shadowing the installed alembic package on import).
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Alembic migration failed:\n{result.stderr}")
    async with aiohttp.ClientSession() as session:
        app.state.http_session = session
        yield
        # Shutdown: close engine
        engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# Transaction Middleware
@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    request.state.db = SessionLocal()
    try:
        response = await call_next(request)
        if response.status_code < 400:
            request.state.db.commit()
        else:
            request.state.db.rollback()
    except Exception as e:
        request.state.db.rollback()
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        request.state.db.close()
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}
