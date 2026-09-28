"""
Secure-MaintAI — Application Configuration.

Loads configuration from environment variables using Pydantic Settings.
Supports development, test, and production environments.
"""

from enum import Enum
from functools import lru_cache

from pathlib import Path
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class AppEnvironment(str, Enum):
    """Application environment modes."""

    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(_PROJECT_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---------- General ----------
    app_name: str = "Secure-MaintAI"
    app_env: AppEnvironment = AppEnvironment.DEVELOPMENT
    app_debug: bool = False
    app_log_level: str = "INFO"
    app_secret_key: str = Field(
        default="INSECURE-DEFAULT-CHANGE-ME",
        min_length=16,
        description="Application-wide secret key. Must be changed in production.",
    )
    app_cors_origins: str = "http://localhost:3000"

    # ---------- API ----------
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    api_rate_limit: str = "100/minute"
    api_max_payload_size_mb: int = 10

    # ---------- Database ----------
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "secure_maintai"
    database_user: str = "secure_maintai"
    database_password: str = Field(
        default="change-me",
        description="Database password. Must be changed in production.",
    )
    database_echo: bool = False
    database_url: str | None = None

    # ---------- Test Database ----------
    test_database_name: str = "secure_maintai_test"

    # ---------- Authentication ----------
    auth_jwt_secret_key: str = Field(
        default="INSECURE-JWT-DEFAULT-CHANGE-ME",
        min_length=16,
        description="JWT signing secret. Must be changed in production.",
    )
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_access_token_expire_minutes: int = 30
    auth_jwt_refresh_token_expire_days: int = 7
    auth_password_min_length: int = 12
    auth_max_login_attempts: int = 5
    auth_lockout_duration_minutes: int = 15

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_dsn(self) -> str:
        """Construct the async database DSN (using asyncpg)."""
        if self.database_url:
            url = self.database_url
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        db_name = (
            self.test_database_name
            if self.app_env == AppEnvironment.TEST
            else self.database_name
        )
        return (
            f"postgresql+asyncpg://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{db_name}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_dsn_sync(self) -> str:
        """Synchronous DSN for Alembic migrations."""
        if self.database_url:
            url = self.database_url.replace("+asyncpg", "")
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        db_name = (
            self.test_database_name
            if self.app_env == AppEnvironment.TEST
            else self.database_name
        )
        return (
            f"postgresql://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{db_name}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.app_cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == AppEnvironment.PRODUCTION

    @property
    def is_testing(self) -> bool:
        """Check if running in test mode."""
        return self.app_env == AppEnvironment.TEST


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings singleton."""
    return Settings()
