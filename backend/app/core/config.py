from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    PROJECT_NAME: str = "SolAuction"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/sol_auction"
    
    # Security
    SECRET_KEY: str = "supersecretkey"  # Change in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Solana
    SOLANA_RPC_URL: str = "https://api.devnet.solana.com"

settings = Settings()
