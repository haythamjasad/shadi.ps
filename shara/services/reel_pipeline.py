from __future__ import annotations

import hashlib
import json
import mimetypes
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse

import requests

from config import get_settings
from services.manus import ManusClient
from services.storage import create_storage


def _log(message: str) -> None:
    print(f"[Pipeline] {message}", flush=True)


def _thumbnail_public_path(*, reel_id: str, suffix: str) -> str:
    suffix = suffix if suffix.startswith(".") else f".{suffix}"
    return f"/images/reel_thumbnails/{reel_id}{suffix}"


def _video_id_from_url(url: str) -> str:
    parsed = urlparse(str(url or ""))
    path = str(parsed.path or "")
    if "/video/" in path:
        tail = path.rsplit("/video/", 1)[-1].strip("/")
        if tail:
            return tail.split("/", 1)[0]
    if "/reel/" in path:
        tail = path.rsplit("/reel/", 1)[-1].strip("/")
        if tail:
            return tail.split("/", 1)[0]
    fallback = path.rsplit("/", 1)[-1].strip()
    if fallback:
        return fallback
    return hashlib.sha1(str(url or "").encode("utf-8", errors="ignore")).hexdigest()


def _download_thumbnail_file(*, thumbnail_url: str, reel_id: str) -> str:
    source = str(thumbnail_url or "").strip()
    if not source:
        return ""

    if source.startswith("/images/reel_thumbnails/"):
        return source

    if source.startswith("images/reel_thumbnails/"):
        return f"/{source.lstrip('/')}"

    root_dir = Path(__file__).resolve().parent.parent
    target_dir = root_dir / "images" / "reel_thumbnails"
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(source.split("?", 1)[0]).suffix or ".jpg"
    target_name = f"{reel_id}{ext}"
    target_path = target_dir / target_name
    if target_path.exists() and target_path.is_file():
        return _thumbnail_public_path(reel_id=reel_id, suffix=ext)

    response = requests.get(
        source,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.facebook.com/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        timeout=30,
    )
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ext
    if guessed and guessed not in {".bin", ".txt"}:
        target_name = f"{reel_id}{guessed}"
        target_path = target_dir / target_name

    _log(f"Downloading thumbnail to {target_path}")
    target_path.write_bytes(response.content)
    return f"/images/reel_thumbnails/{target_path.name}"


def _detect_platform(*, reel_url: str, platform: str | None = None) -> str:
    explicit = str(platform or "").strip().lower()
    if explicit in {"facebook", "tiktok"}:
        return explicit
    url = str(reel_url or "").lower()
    if "tiktok.com" in url:
        return "tiktok"
    return "facebook"


def ingest_manus_reel(
    *,
    reel_url: str,
    platform: str = "auto",
    source_page_url: str | None = None,
) -> Dict[str, Any]:
    effective_platform = _detect_platform(reel_url=reel_url, platform=platform)
    _log(f"Ingest started for {effective_platform}: {reel_url}")
    settings = get_settings()
    manus = ManusClient(
        api_key=settings.manus_api_key,
        timeout_seconds=settings.manus_timeout_seconds,
    )
    storage = None

    try:
        scraped = manus.scrape_reel(reel_url, platform=effective_platform)
        _log("Manus returned reel metadata")
        parsed_url = urlparse(scraped.reel_url or reel_url)
        reel_id = _video_id_from_url(scraped.reel_url or reel_url)

        _log("Connecting to database")
        storage = create_storage(settings)
        _log("Database connected")

        if effective_platform == "tiktok":
            existing = storage.get_tiktok_reel(video_id=reel_id)
            existing_thumbnail = str((existing or {}).get("thumbnail_path") or (existing or {}).get("thumbnail_url") or "").strip()

            local_thumbnail = _download_thumbnail_file(
                thumbnail_url=scraped.thumbnail_url or existing_thumbnail,
                reel_id=reel_id,
            )

            storage.upsert_tiktok_reel(
                video_id=reel_id,
                video_url=scraped.reel_url or reel_url,
                thumbnail_url=scraped.thumbnail_url or None,
                thumbnail_path=local_thumbnail or scraped.thumbnail_url or None,
                title=scraped.title or None,
                raw_row_json=json.dumps(
                    {
                        "reel_url": scraped.reel_url or reel_url,
                        "title": scraped.title,
                        "upload_date": scraped.upload_date,
                        "thumbnail_url": scraped.thumbnail_url,
                        "source_page_url": source_page_url or scraped.source_page_url or reel_url,
                        "platform": "tiktok",
                    },
                    ensure_ascii=False,
                ),
                source_xlsx="manus",
                source_row=0,
            )
            _log("Saved TikTok reel metadata to database")

            return {
                "reel_id": reel_id,
                "reel_url": scraped.reel_url,
                "title": scraped.title,
                "upload_date": scraped.upload_date,
                "thumbnail_url": local_thumbnail or scraped.thumbnail_url,
                "video_path": None,
                "status": "refreshed" if existing else "ingested",
                "platform": "tiktok",
            }

        existing = storage.get_facebook_reel(reel_id=reel_id)
        existing_thumbnail = str((existing or {}).get("thumbnail_url") or "").strip()

        if existing and existing_thumbnail:
            _log("Existing reel already has metadata and thumbnail; skipping")
            return {
                "reel_id": reel_id,
                "reel_url": scraped.reel_url or reel_url,
                "title": scraped.title,
                "upload_date": scraped.upload_date,
                "thumbnail_url": existing_thumbnail,
                "video_path": None,
                "status": "skipped",
            }

        if existing and not existing_thumbnail:
            _log("Existing reel is missing thumbnail only; refreshing thumbnail")
            local_thumbnail = _download_thumbnail_file(
                thumbnail_url=scraped.thumbnail_url or existing_thumbnail,
                reel_id=reel_id,
            )
            storage.upsert_facebook_reel(
                reel_id=reel_id,
                reel_url=scraped.reel_url or reel_url,
                source_page_url=source_page_url or scraped.source_page_url or reel_url,
                title=scraped.title or None,
                upload_date=scraped.upload_date or None,
                thumbnail_url=local_thumbnail or scraped.thumbnail_url or None,
                video_path=None,
            )
            return {
                "reel_id": reel_id,
                "reel_url": scraped.reel_url or reel_url,
                "title": scraped.title,
                "upload_date": scraped.upload_date,
                "thumbnail_url": local_thumbnail or scraped.thumbnail_url,
                "video_path": None,
                "status": "refreshed-thumbnail",
            }

        local_thumbnail = _download_thumbnail_file(
            thumbnail_url=scraped.thumbnail_url or existing_thumbnail,
            reel_id=reel_id,
        )

        storage.upsert_facebook_reel(
            reel_id=reel_id,
            reel_url=scraped.reel_url or reel_url,
            source_page_url=source_page_url or scraped.source_page_url or reel_url,
            title=scraped.title or None,
            upload_date=scraped.upload_date or None,
            thumbnail_url=local_thumbnail or scraped.thumbnail_url or None,
            video_path=None,
        )
        _log("Saved reel metadata to database")
        return {
            "reel_id": reel_id,
            "reel_url": scraped.reel_url,
            "title": scraped.title,
            "upload_date": scraped.upload_date,
            "thumbnail_url": local_thumbnail or scraped.thumbnail_url,
            "video_path": None,
            "status": "refreshed" if existing else "ingested",
        }
    finally:
        if storage is not None:
            storage.close()
        _log("Pipeline finished")
