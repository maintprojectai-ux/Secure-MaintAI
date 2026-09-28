"""
Unit Tests — Authentication and Refresh Tokens.

Tests JWT token lifecycle, refresh token separation, and validation.
Per engineering rules Section 8: authentication and authorization are separate concerns.
"""

from datetime import timedelta

from backend.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)


class TestTokenSeparation:
    """Tests that access tokens and refresh tokens cannot be used interchangeably."""

    def test_access_token_rejected_by_refresh_decoder(self) -> None:
        access_token = create_access_token(subject="user-123", role="ADMIN")
        # decode_refresh_token should reject tokens with type="access"
        payload = decode_refresh_token(access_token)
        assert payload is None

    def test_refresh_token_rejected_by_access_decoder(self) -> None:
        refresh_token = create_refresh_token(subject="user-123")
        # decode_access_token should reject tokens with type="refresh"
        payload = decode_access_token(refresh_token)
        assert payload is None

    def test_refresh_token_valid_and_decodable(self) -> None:
        refresh_token = create_refresh_token(subject="user-456")
        payload = decode_refresh_token(refresh_token)
        assert payload is not None
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"
        assert "exp" in payload

    def test_expired_refresh_token_returns_none(self) -> None:
        expired_token = create_refresh_token(
            subject="user-789",
            expires_delta=timedelta(seconds=-10),
        )
        payload = decode_refresh_token(expired_token)
        assert payload is None

    def test_tampered_token_returns_none(self) -> None:
        token = create_refresh_token(subject="user-000")
        tampered = token[:-5] + "XXXXX"
        assert decode_refresh_token(tampered) is None
        assert decode_access_token(tampered) is None
