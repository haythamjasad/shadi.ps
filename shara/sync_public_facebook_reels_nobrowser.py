#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import html
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import requests

from config import get_settings
from services.storage import ReelStorage, create_storage


PAGE_URL = "https://www.facebook.com/shadi.shirri/reels/"
SOURCE_PAGE_URL = "https://www.facebook.com/shadi.shirri/reels/"
THUMB_DIR = Path("images/reel_thumbnails")
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0 Safari/537.36"
)


def normalize_text(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*\|\s*Facebook$", "", text, flags=re.I)
    text = re.sub(r"\s+on Facebook$", "", text, flags=re.I)
    return text.strip()


def normalize_reel_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        return ""
    if url.startswith("/"):
        url = "https://www.facebook.com" + url

    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    if netloc.startswith("m.facebook.com"):
        netloc = "www.facebook.com"
    path = parsed.path.rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))


def reel_id_from_url(url: str) -> str:
    return hashlib.sha1(normalize_reel_url(url).encode("utf-8", errors="ignore")).hexdigest()


def timestamp_to_date(ts: str | int | float) -> str | None:
    try:
        value = int(float(ts))
        if value > 10_000_000_000:
            value //= 1000
        dt = datetime.fromtimestamp(value, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_upload_date_from_info(info: dict) -> str:
    for key in ("upload_date",):
        value = str(info.get(key) or "").strip()
        if re.fullmatch(r"\d{8}", value):
            return f"{value[:4]}-{value[4:6]}-{value[6:]}"

    for key in ("timestamp", "release_timestamp"):
        value = info.get(key)
        if value:
            parsed = timestamp_to_date(value)
            if parsed:
                return parsed
    return ""


def extract_popularity_score_from_info(info: dict) -> float:
    score = 0.0
    for key, weight in (
        ("view_count", 1.0),
        ("like_count", 0.25),
        ("comment_count", 0.1),
        ("repost_count", 0.2),
    ):
        try:
            score += float(info.get(key) or 0) * weight
        except Exception:
            pass
    return score


def run_ytdlp_json(url: str, *, flat_playlist: bool = False) -> dict:
    settings = get_settings()
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--user-agent",
        USER_AGENT,
    ]
    if flat_playlist:
        cmd.append("--flat-playlist")
    cookies_file = str(getattr(settings, "ytdlp_cookies_file", "") or "").strip()
    if cookies_file:
        cmd.extend(["--cookies", cookies_file])
    cmd.append(url)

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    if result.returncode != 0:
        error = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"yt-dlp failed for {url}: {error}")
    raw = (result.stdout or "").strip()
    if not raw:
        raise RuntimeError(f"yt-dlp returned empty output for {url}")
    return json.loads(raw)


def fetch_page_html(page_url: str) -> str:
    response = requests.get(
        page_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Referer": "https://www.facebook.com/",
            "Upgrade-Insecure-Requests": "1",
        },
        allow_redirects=True,
        timeout=30,
    )
    response.raise_for_status()
    return response.text


def _collect_urls_from_ytdlp_payload(payload: object) -> list[str]:
    candidates: list[str] = []
    stack = [payload]

    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            for key in ("webpage_url", "url", "original_url"):
                value = str(item.get(key) or "").strip()
                if value:
                    candidates.append(value)
            entries = item.get("entries")
            if isinstance(entries, list):
                stack.extend(reversed(entries))
        elif isinstance(item, list):
            stack.extend(reversed(item))

    return candidates


def collect_reel_urls(page_url: str, *, max_reels: int) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    try:
        playlist = run_ytdlp_json(page_url, flat_playlist=True)
        candidates = _collect_urls_from_ytdlp_payload(playlist)
        for candidate in candidates:
            normalized = normalize_reel_url(candidate)
            if "/reel/" not in normalized:
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            found.append(normalized)
            if len(found) >= max_reels:
                return found
    except Exception as exc:
        print(f"yt-dlp discovery failed: {exc}", flush=True)

    page_html = fetch_page_html(page_url)
    normalized_html = html.unescape(page_html).replace("\\/", "/")

    patterns = [
        r"https://www\.facebook\.com/reel/\d+",
        r"https://m\.facebook\.com/reel/\d+",
        r"/reel/\d+",
    ]
    candidates: list[str] = []
    for pattern in patterns:
        candidates.extend(re.findall(pattern, normalized_html))

    for candidate in candidates:
        normalized = normalize_reel_url(str(candidate))
        if "/reel/" not in normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        found.append(normalized)
        if len(found) >= max_reels:
            break
    return found


def fetch_reel_metadata(reel_url: str) -> dict[str, str]:
    info = run_ytdlp_json(reel_url, flat_playlist=False)
    title = normalize_text(str(info.get("title") or info.get("description") or ""))
    thumbnail = str(info.get("thumbnail") or "").strip()
    upload_date = parse_upload_date_from_info(info)
    popularity_score = extract_popularity_score_from_info(info)

    return {
        "title": title,
        "thumbnail_url": thumbnail,
        "upload_date": upload_date,
        "popularity_score": str(popularity_score),
    }


def download_thumbnail_local(thumbnail_url: str, reel_id: str) -> str:
    url = str(thumbnail_url or "").strip()
    if not url:
        return ""

    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    local_name = f"{reel_id}.jpg"
    local_disk_path = THUMB_DIR / local_name
    local_web_path = f"/images/reel_thumbnails/{local_name}"

    if local_disk_path.exists() and local_disk_path.is_file():
        return local_web_path

    try:
        resp = requests.get(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Referer": PAGE_URL,
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
            timeout=25,
        )
        resp.raise_for_status()
        local_disk_path.write_bytes(resp.content)
        return local_web_path
    except Exception:
        return url


def load_existing_urls(storage: ReelStorage) -> set[str]:
    rows = storage.list_facebook_reels(limit=None, source_page_url=SOURCE_PAGE_URL)
    return {normalize_reel_url(str(row.get("reel_url") or "")) for row in rows if row.get("reel_url")}


def sync_public_reels_nobrowser(*, page_url: str, max_reels: int) -> dict:
    settings = get_settings()
    storage = create_storage(settings)

    existing_urls = load_existing_urls(storage)
    collected = collect_reel_urls(page_url, max_reels=max_reels)

    stored = 0
    skipped = 0
    failed = 0

    for index, reel_url in enumerate(collected, 1):
        normalized_url = normalize_reel_url(reel_url)
        if normalized_url in existing_urls:
            skipped += 1
            print(f"[{index}] skip duplicate: {normalized_url}", flush=True)
            continue

        print(f"[{index}] fetch: {normalized_url}", flush=True)
        try:
            meta = fetch_reel_metadata(normalized_url)
        except Exception as exc:
            failed += 1
            print(f"    ERROR: {exc}", flush=True)
            continue

        reel_id = reel_id_from_url(normalized_url)
        local_thumbnail = download_thumbnail_local(str(meta.get("thumbnail_url") or ""), reel_id)
        storage.upsert_facebook_reel(
            reel_id=reel_id,
            reel_url=normalized_url,
            source_page_url=SOURCE_PAGE_URL,
            title=meta.get("title") or None,
            upload_date=meta.get("upload_date") or None,
            thumbnail_url=local_thumbnail or None,
            popularity_score=float(meta.get("popularity_score") or 0),
        )
        existing_urls.add(normalized_url)
        stored += 1
        print(
            f"    saved: title={meta.get('title') or ''} date={meta.get('upload_date') or ''} thumb={local_thumbnail or ''}",
            flush=True,
        )

    db_total = storage.count_facebook_reels(source_page_url=SOURCE_PAGE_URL)
    storage.close()
    return {
        "collected": len(collected),
        "stored": stored,
        "skipped": skipped,
        "failed": failed,
        "db_total": db_total,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync public Facebook reels into MySQL without Selenium or a browser.")
    parser.add_argument("--page-url", default=PAGE_URL, help="Facebook reels page URL to scrape.")
    parser.add_argument("--max-reels", type=int, default=20, help="Maximum number of reels to collect.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = sync_public_reels_nobrowser(
        page_url=args.page_url,
        max_reels=max(1, int(args.max_reels or 20)),
    )
    print(result)
