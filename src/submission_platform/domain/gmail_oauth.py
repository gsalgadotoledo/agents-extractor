"""One-time OAuth2 consent flow for Gmail API.

Opens a browser for user consent, then prints the refresh token
to paste into .env as GOOGLE_REFRESH_TOKEN.

Usage:
    uv run submission gmail-auth
"""
from __future__ import annotations

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]


def run_consent() -> str | None:
    """Run the OAuth2 consent flow. Returns the refresh token."""
    from submission_platform.config import get_settings

    settings = get_settings()

    if not settings.google_client_id or not settings.google_client_secret:
        print("Error: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.")
        return None

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost:8080"],
            }
        },
        scopes=SCOPES,
    )
    creds = flow.run_local_server(port=8080, prompt="consent", access_type="offline")

    print("\n" + "=" * 50)
    print("SUCCESS! Paste this into your .env file:")
    print("=" * 50)
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print("=" * 50)

    return creds.refresh_token


if __name__ == "__main__":
    run_consent()
