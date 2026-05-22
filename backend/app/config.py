from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "KuroFunnels"
    SECRET_KEY: str = "dev-secret-key-change-in-production-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "postgresql://kuro:kuropass@localhost:5432/kurofunnels"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
