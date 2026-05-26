from pydantic_settings import BaseSettings


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

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    ENVIRONMENT: str = "development"

    # Cloudflare API token — backend-only, auto-provisions DNS when a domain is added.
    # Create at: https://dash.cloudflare.com/profile/api-tokens
    # Required permissions: Zone:Read + DNS:Edit (all zones, or specific zone)
    CLOUDFLARE_API_TOKEN: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
