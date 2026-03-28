from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import aiohttp
from .api import api_router
from .core.config import settings
from .core.database import SessionLocal, engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create aiohttp session
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
        raise e
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
