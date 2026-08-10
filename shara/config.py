from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_host: str = "0.0.0.0"
    app_port: int = 8000
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_database: str = ""
    mysql_user: str = ""
    mysql_password: str = ""

    # Optional: legacy AI settings kept for existing environments.
    assembly_ai_api_key: str = ""
    assembly_ai_poll_interval_seconds: float = 3.0
    assembly_ai_timeout_seconds: int = 900
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    mysql_connect_timeout_seconds: int = 10

    # Optional: Manus scraping/downloading
    manus_api_key: str = ""
    manus_timeout_seconds: int = 0
    reel_media_dir: str = "videos/reels"

    # Optional: Facebook Graph API (Page reels/videos indexing)
    fb_graph_api_version: str = "v20.0"
    fb_page_id: str = ""
    fb_page_access_token: str = ""

    # Optional: yt-dlp cookies export for Facebook scraping
    ytdlp_cookies_file: str = ""

    # Optional: TikTok workbook source
    tiktok_sheet_path: str = str(ROOT.parent / "tiktok_videos_shadishirri.xlsx")

    # Required for admin/costly write endpoints.
    sharah_admin_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
