"""
Secure-MaintAI — Security Utilities.

Password hashing (bcrypt) and JWT token management.
Per engineering rules Section 8: authentication and authorization are separate concerns.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from backend.core.config import get_settings


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: The plaintext password.

    Returns:
        The bcrypt hash of the password.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a bcrypt hash.

    Args:
        plain_password: The plaintext password to verify.
        hashed_password: The stored bcrypt hash.

    Returns:
        True if the password matches, False otherwise.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    subject: str,
    role: str,
    extra_claims: dict | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        subject: The token subject (typically user ID).
        role: The user's role for RBAC.
        extra_claims: Additional claims to include in the token.
        expires_delta: Custom expiration duration. Defaults to config value.

    Returns:
        The encoded JWT string.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)

    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.auth_jwt_access_token_expire_minutes)

    claims: dict = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": now + expires_delta,
        "type": "access",
    }

    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(
        claims,
        settings.auth_jwt_secret_key,
        algorithm=settings.auth_jwt_algorithm,
    )


def decode_access_token(token: str) -> dict | None:
    """
    Decode and validate a JWT access token.

    Args:
        token: The JWT string to decode.

    Returns:
        The decoded claims dictionary, or None if the token is invalid.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.auth_jwt_secret_key,
            algorithms=[settings.auth_jwt_algorithm],
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def create_refresh_token(
    subject: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT refresh token with longer lifespan.

    Args:
        subject: The token subject (user ID).
        expires_delta: Custom expiration duration. Defaults to config value.

    Returns:
        The encoded JWT refresh token.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)

    if expires_delta is None:
        expires_delta = timedelta(days=settings.auth_jwt_refresh_token_expire_days)

    claims: dict = {
        "sub": str(subject),
        "iat": now,
        "exp": now + expires_delta,
        "type": "refresh",
    }

    return jwt.encode(
        claims,
        settings.auth_jwt_secret_key,
        algorithm=settings.auth_jwt_algorithm,
    )


def decode_refresh_token(token: str) -> dict | None:
    """
    Decode and validate a JWT refresh token.

    Args:
        token: The JWT refresh token string to decode.

    Returns:
        The decoded claims dictionary, or None if the token is invalid or not of type 'refresh'.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.auth_jwt_secret_key,
            algorithms=[settings.auth_jwt_algorithm],
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None
