"""
Secure-MaintAI — Database Configuration.

Async SQLAlchemy engine and session management.
Per engineering rules Section 22: use migrations, foreign keys, indexes, timestamps.
"""

from collections.abc import AsyncGenerator

from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.core.config import get_settings

settings = get_settings()

_engine_kwargs: dict[str, Any] = {
    "echo": settings.database_echo,
    "pool_pre_ping": True,
}
if "sqlite" not in settings.database_dsn:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_async_engine(
    settings.database_dsn,
    **_engine_kwargs,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provide an async database session via dependency injection.

    Yields:
        An async SQLAlchemy session that is automatically closed.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
