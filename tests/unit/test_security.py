"""
Unit Tests — Security Utilities.

Tests for password hashing and JWT token management.
"""

from datetime import timedelta

from backend.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    """Tests for bcrypt password hashing."""

    def test_hash_produces_bcrypt_hash(self) -> None:
        hashed = hash_password("TestPassword123!")
        assert hashed.startswith("$2b$")

    def test_hash_is_not_plaintext(self) -> None:
        password = "TestPassword123!"
        hashed = hash_password(password)
        assert hashed != password

    def test_verify_correct_password(self) -> None:
        password = "TestPassword123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self) -> None:
        hashed = hash_password("CorrectPassword!")
        assert verify_password("WrongPassword!", hashed) is False

    def test_different_hashes_for_same_password(self) -> None:
        """bcrypt uses random salt, so same password produces different hashes."""
        password = "TestPassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
        # But both should verify
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokens:
    """Tests for JWT access token creation and validation."""

    def test_create_and_decode_token(self) -> None:
        token = create_access_token(
            subject="user-123",
            role="ADMIN",
        )
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["role"] == "ADMIN"
        assert payload["type"] == "access"

    def test_token_contains_expiry(self) -> None:
        token = create_access_token(subject="user-123", role="STUDENT")
        payload = decode_access_token(token)
        assert payload is not None
        assert "exp" in payload
        assert "iat" in payload

    def test_expired_token_returns_none(self) -> None:
        token = create_access_token(
            subject="user-123",
            role="STUDENT",
            expires_delta=timedelta(seconds=-1),
        )
        payload = decode_access_token(token)
        assert payload is None

    def test_invalid_token_returns_none(self) -> None:
        payload = decode_access_token("invalid.token.string")
        assert payload is None

    def test_empty_token_returns_none(self) -> None:
        payload = decode_access_token("")
        assert payload is None

    def test_extra_claims(self) -> None:
        token = create_access_token(
            subject="user-123",
            role="RESEARCHER",
            extra_claims={"department": "CS"},
        )
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["department"] == "CS"
