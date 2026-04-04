from dataclasses import dataclass

import httpx

from ..core.config import settings

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@dataclass(frozen=True)
class GoogleUserInfo:
    google_id: str
    email: str
    name: str | None
    picture: str | None


async def verify_google_token(id_token: str) -> GoogleUserInfo:
    """Verify Google ID token and return user info.

    Raises:
        ValueError: If the token is invalid or doesn't match our client ID.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_TOKENINFO_URL, params={"id_token": id_token}
        )

    if resp.status_code != 200:
        raise ValueError("Invalid Google token")

    data = resp.json()

    if data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Token audience mismatch")

    if data.get("email_verified") != "true":
        raise ValueError("Email not verified")

    return GoogleUserInfo(
        google_id=data["sub"],
        email=data["email"],
        name=data.get("name"),
        picture=data.get("picture"),
    )
