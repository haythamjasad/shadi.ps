#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import hashlib
import logging
from urllib.parse import urlparse

import requests

from config import get_settings
from services.storage import create_storage


CONFIG = {
    "profile_username": "shadishirri",
    "max_videos": 10,
    "uploads_dir_abs": "/home/user/public_html/uploads/reels/",
    "uploads_url_prefix": "/uploads/reels/",
    "api": {
        "url": "https://your-tiktok-scraper-api.example.com/profile/videos",
        "timeout_seconds": 30,
        "headers": {
            "Accept": "application/json",
        },
        "params": {},
    },
}


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("tiktok_sync")


def ensure_uploads_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def fetch_profile_videos(username: str, limit: int):
    api_conf = CONFIG["api"]
    params = dict(api_conf.get("params", {}))
    params.update({"username": username, "limit": limit})

    try:
        resp = requests.get(
            api_conf["url"],
            headers=api_conf.get("headers", {}),
            params=params,
            timeout=api_conf.get("timeout_seconds", 30),
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        log.error("API request error: %s", e)
        raise
    except ValueError as e:
        log.error("API returned invalid JSON: %s", e)
        raise


def normalize_videos(payload):
    candidates = []
    if isinstance(payload, list):
        candidates = payload
    elif isinstance(payload, dict):
        for key in ("videos", "items", "data", "aweme_list", "results"):
            val = payload.get(key)
            if isinstance(val, list):
                candidates = val
                break
            if isinstance(val, dict):
                for nested_key in ("videos", "items", "aweme_list", "results"):
                    nested = val.get(nested_key)
                    if isinstance(nested, list):
                        candidates = nested
                        break
                if candidates:
                    break

    normalized = []
    for item in candidates:
        if not isinstance(item, dict):
            continue

        video_id = (str(item.get("video_id") or "") or str(item.get("id") or "") or str(item.get("aweme_id") or "")).strip()
        video_url = str(item.get("video_url") or item.get("url") or item.get("share_url") or item.get("permalink") or "").strip()
        thumbnail_url = str(item.get("thumbnail_url") or item.get("cover") or item.get("cover_url") or item.get("thumbnail") or "").strip()

        if not video_id:
            if video_url:
                video_id = hashlib.sha1(video_url.encode("utf-8")).hexdigest()[:16]
            else:
                continue

        if not video_url:
            video_url = f"https://www.tiktok.com/@{CONFIG['profile_username']}/video/{video_id}"

        normalized.append({
            "video_id": video_id,
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
        })

    return normalized


def guess_extension_from_url(url: str) -> str:
    try:
        path = urlparse(url).path.lower()
        if path.endswith(".png"):
            return ".png"
        if path.endswith(".webp"):
            return ".webp"
        if path.endswith(".jpeg"):
            return ".jpeg"
        return ".jpg"
    except Exception:
        return ".jpg"


def download_thumbnail(thumbnail_url: str, video_id: str):
    if not thumbnail_url:
        return None, None

    ext = guess_extension_from_url(thumbnail_url)
    filename = f"reel_{video_id}{ext}"
    abs_path = os.path.join(CONFIG["uploads_dir_abs"], filename)
    rel_path = f"{CONFIG['uploads_url_prefix']}{filename}"

    try:
        r = requests.get(thumbnail_url, timeout=30, stream=True)
        r.raise_for_status()
        with open(abs_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return abs_path, rel_path
    except requests.RequestException as e:
        log.warning("Thumbnail download failed for %s: %s", video_id, e)
        return None, None
    except OSError as e:
        log.warning("File write failed for %s: %s", video_id, e)
        return None, None


def sync_tiktok_reels():
    ensure_uploads_dir(CONFIG["uploads_dir_abs"])

    storage = None
    try:
        storage = create_storage(get_settings())

        raw_payload = fetch_profile_videos(username=CONFIG["profile_username"], limit=CONFIG["max_videos"])
        videos = normalize_videos(raw_payload)

        if not videos:
            log.warning("No videos found from API payload.")
            return

        new_count = 0
        skipped_count = 0

        for video in videos:
            video_id = video["video_id"]
            video_url = video["video_url"]
            thumbnail_url = video["thumbnail_url"]

            if storage.get_tiktok_reel(video_id=video_id):
                skipped_count += 1
                continue

            _, rel_thumb_path = download_thumbnail(thumbnail_url, video_id)
            storage.upsert_tiktok_reel(
                video_id=video_id,
                video_url=video_url,
                thumbnail_url=thumbnail_url or None,
                thumbnail_path=rel_thumb_path or None,
                source_xlsx="api",
                source_row=new_count + 1,
            )

            new_count += 1
            log.info("Installed new video: %s | thumb=%s", video_id, rel_thumb_path or "N/A")

        log.info("Sync complete. New: %d | Skipped (duplicates): %d", new_count, skipped_count)

    except Exception as e:
        log.error("Sync failed: %s", e)
        raise
    finally:
        if storage is not None:
            storage.close()


if __name__ == "__main__":
    try:
        sync_tiktok_reels()
    except Exception:
        sys.exit(1)
