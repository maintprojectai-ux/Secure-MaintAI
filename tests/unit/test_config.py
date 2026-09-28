"""
Unit Tests — Application Configuration.

Tests for configuration loading and computed properties.
"""

from backend.core.config import AppEnvironment, Settings


class TestSettings:
    """Tests for the Settings configuration."""

    def test_default_environment(self) -> None:
        """Default environment should be development unless overridden."""
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
        )
        # When APP_ENV is not set or set to development
        assert settings.app_env in (AppEnvironment.DEVELOPMENT, AppEnvironment.TEST)

    def test_database_dsn_constructed(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            database_url=None,
            database_host="db.example.com",
            database_port=5432,
            database_name="mydb",
            database_user="myuser",
            database_password="mypass",
            app_env=AppEnvironment.DEVELOPMENT,
        )
        assert "db.example.com" in settings.database_dsn
        assert "mydb" in settings.database_dsn
        assert "asyncpg" in settings.database_dsn

    def test_database_dsn_sync(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            database_url=None,
            database_host="localhost",
            database_port=5432,
            database_name="testdb",
            database_user="user",
            database_password="pass",
            app_env=AppEnvironment.DEVELOPMENT,
        )
        dsn = settings.database_dsn_sync
        assert "asyncpg" not in dsn
        assert "postgresql://" in dsn

    def test_test_database_used_in_test_env(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            database_url=None,
            app_env=AppEnvironment.TEST,
            database_name="main_db",
            test_database_name="test_db",
            database_host="localhost",
            database_user="user",
            database_password="pass",
        )
        assert "test_db" in settings.database_dsn

    def test_cors_origins_parsed(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            app_cors_origins="http://localhost:3000, http://localhost:8080",
        )
        origins = settings.cors_origins_list
        assert len(origins) == 2
        assert "http://localhost:3000" in origins
        assert "http://localhost:8080" in origins

    def test_is_production(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            app_env=AppEnvironment.PRODUCTION,
        )
        assert settings.is_production is True
        assert settings.is_testing is False

    def test_is_testing(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            app_env=AppEnvironment.TEST,
        )
        assert settings.is_testing is True
        assert settings.is_production is False

    def test_database_url_override(self) -> None:
        settings = Settings(
            app_secret_key="test-secret-key-32-chars-minimum",
            auth_jwt_secret_key="test-jwt-secret-key-minimum",
            database_url="postgresql+asyncpg://custom:pass@custom-host:5432/custom-db",
        )
        assert (
            settings.database_dsn
            == "postgresql+asyncpg://custom:pass@custom-host:5432/custom-db"
        )
