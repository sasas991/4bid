from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, auctions
from .db.session import engine, Base

# Create tables if they don't exist (Simple way for dev, use Alembic for real)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SolAuction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(auctions.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to SolAuction API"}
