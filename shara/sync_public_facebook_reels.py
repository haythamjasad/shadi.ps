#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import html
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from bs4 import BeautifulSoup
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

    parts = [part.strip() for part in text.split("|") if part.strip()]
    if len(parts) >= 2:
        useful_parts = [
            part
            for part in parts
            if not re.search(r"\b(views?|reactions?|comments?|shares?)\b", part, flags=re.I)
            and part.lower() not in {"facebook", "shadi shirri"}
        ]
        if useful_parts:
            text = useful_parts[0]

    return text.strip()


def parse_compact_number(raw: str) -> float:
    text = normalize_text(raw).replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*([KMB]?)", text, flags=re.I)
    if not match:
        return 0.0
    value = float(match.group(1))
    suffix = match.group(2).upper()
    multiplier = {"": 1.0, "K": 1_000.0, "M": 1_000_000.0, "B": 1_000_000_000.0}.get(suffix, 1.0)
    return value * multiplier


def extract_popularity_score(page_html: str, page_title: str) -> float:
    soup = BeautifulSoup(page_html, "html.parser")
    candidates: list[str] = []

    for name in ["og:title", "twitter:title", "description", "og:description", "article:title"]:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            candidates.append(str(tag["content"]))

    candidates.append(page_title or "")

    best = 0.0
    for candidate in candidates:
        text = normalize_text(candidate)
        if not text:
            continue

        views = 0.0
        reactions = 0.0
        likes = 0.0
        comments = 0.0

        for value, label in re.findall(r"(\d+(?:[\.,]\d+)?\s*[KMB]?)\s*(views?|reactions?|likes?|comments?)", text, flags=re.I):
            amount = parse_compact_number(value)
            label = label.lower()
            if "view" in label:
                views = max(views, amount)
            elif "reaction" in label:
                reactions = max(reactions, amount)
            elif "like" in label:
                likes = max(likes, amount)
            elif "comment" in label:
                comments = max(comments, amount)

        score = views + (reactions * 0.5) + (likes * 0.25) + (comments * 0.1)
        best = max(best, score)

    return best


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


def create_chrome_browser(*, headless: bool):
    from selenium import webdriver

    options = webdriver.ChromeOptions()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument(f"--user-agent={USER_AGENT}")
    options.add_argument("--window-size=1440,1800")
    if headless:
        options.add_argument("--headless=new")
    return webdriver.Chrome(options=options)


def timestamp_to_date(ts: str | int | float) -> str | None:
    try:
        value = int(float(ts))
        if value > 10_000_000_000:
            value //= 1000
        dt = datetime.fromtimestamp(value, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def extract_title(page_html: str, page_title: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")
    candidates: list[str] = []

    for name in ["og:title", "twitter:title", "description", "og:description", "article:title"]:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            candidates.append(tag["content"])

    candidates.append(page_title)

    for candidate in candidates:
        title = normalize_text(candidate)
        if title and title.lower() not in {"facebook", "facebook reels", "log into facebook", "watch"}:
            return title
    return ""


def extract_thumbnail(page_html: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")
    for name in ["og:image", "og:image:url", "twitter:image"]:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return ""


def extract_date(page_html: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")

    time_tag = soup.find("time")
    if time_tag:
        if time_tag.get("datetime"):
            value = normalize_text(time_tag["datetime"])
            for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d"):
                try:
                    return datetime.strptime(value, fmt).date().isoformat()
                except Exception:
                    pass
            return value
        if time_tag.text:
            return normalize_text(time_tag.text)

    meta_names = [
        "article:published_time",
        "og:published_time",
        "og:updated_time",
        "datePublished",
        "uploadDate",
    ]
    for name in meta_names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            value = normalize_text(tag["content"])
            for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d"):
                try:
                    return datetime.strptime(value, fmt).date().isoformat()
                except Exception:
                    pass
            return value

    patterns = [
        r'"publish_time"\s*:\s*(\d+)',
        r'"creation_time"\s*:\s*(\d+)',
        r'"created_time"\s*:\s*(\d+)',
        r'"creation_timestamp"\s*:\s*(\d+)',
        r'"timestamp"\s*:\s*(\d{10,13})',
        r'"creation_time"\s*:\s*\{"timestamp"\s*:\s*(\d+)',
        r'"publish_time"\s*:\s*\{"timestamp"\s*:\s*(\d+)',
        r'"datePublished"\s*:\s*"([^"]+)"',
        r'"uploadDate"\s*:\s*"([^"]+)"',
        r'"created_time"\s*:\s*"([^"]+)"',
    ]

    for pattern in patterns:
        match = re.search(pattern, page_html)
        if not match:
            continue
        value = match.group(1).strip()
        if value.isdigit():
            parsed = timestamp_to_date(value)
            if parsed:
                return parsed
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except Exception:
                pass
        return value

    return ""


def fetch_reel_metadata(reel_url: str) -> dict[str, str]:
    browser = create_chrome_browser(headless=True)
    try:
        browser.set_page_load_timeout(45)
        browser.get(reel_url)
        time.sleep(6)
        page_html = browser.page_source
        page_title = browser.title or ""
    finally:
        browser.quit()

    title = extract_title(page_html, page_title=page_title)
    thumbnail = extract_thumbnail(page_html)
    upload_date = extract_date(page_html)
    popularity_score = extract_popularity_score(page_html, page_title)

    return {
        "title": title,
        "thumbnail_url": thumbnail,
        "upload_date": upload_date,
        "popularity_score": str(popularity_score),
    }


def extract_fresh_thumbnail_from_reel_page(reel_url: str) -> str:
    browser = create_chrome_browser(headless=True)
    try:
        browser.set_page_load_timeout(45)
        browser.get(reel_url)
        time.sleep(6)
        page_html = browser.page_source
    finally:
        browser.quit()

    soup = BeautifulSoup(page_html, "html.parser")
    for name in ["og:image", "og:image:url", "twitter:image"]:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return ""


def download_thumbnail_local(thumbnail_url: str, reel_id: str, reel_url: str = "") -> str:
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
        if reel_url:
            try:
                fresh = extract_fresh_thumbnail_from_reel_page(reel_url)
                if fresh:
                    resp = requests.get(
                        fresh,
                        headers={
                            "User-Agent": USER_AGENT,
                            "Referer": reel_url,
                            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                        },
                        timeout=25,
                    )
                    resp.raise_for_status()
                    local_disk_path.write_bytes(resp.content)
                    return local_web_path
            except Exception:
                pass

        return url


def collect_reel_urls(page_url: str, *, headless: bool, max_scrolls: int, scroll_pause_ms: int, max_reels: int) -> list[str]:
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
    except Exception as exc:  # pragma: no cover - runtime dependency guard
        raise SystemExit(
            "Selenium is required for this scraper. Install it with `pip install selenium`."
        ) from exc

    found: list[str] = []
    seen: set[str] = set()

    browser = create_chrome_browser(headless=headless)
    try:
        browser.set_page_load_timeout(45)
        browser.get(page_url)
        time.sleep(6)

        stagnant_rounds = 0
        for _ in range(max_scrolls):
            hrefs = [el.get_attribute("href") for el in browser.find_elements(By.CSS_SELECTOR, "a[href]")]

            before = len(seen)
            for href in hrefs:
                normalized = normalize_reel_url(href)
                if "/reel/" not in normalized:
                    continue
                if normalized in seen:
                    continue
                seen.add(normalized)
                found.append(normalized)
                if len(found) >= max_reels:
                    return found

            if len(seen) == before:
                stagnant_rounds += 1
            else:
                stagnant_rounds = 0

            if stagnant_rounds >= 2:
                break

            browser.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(scroll_pause_ms / 1000)
    finally:
        browser.quit()

    return found


def load_existing_urls(storage: ReelStorage) -> set[str]:
    rows = storage.list_facebook_reels(limit=None, source_page_url=SOURCE_PAGE_URL)
    return {normalize_reel_url(str(row.get("reel_url") or "")) for row in rows if row.get("reel_url")}


def sync_public_reels(*, page_url: str, max_reels: int, headless: bool, max_scrolls: int, scroll_pause_ms: int) -> dict:
    settings = get_settings()
    storage = create_storage(settings)

    existing_urls = load_existing_urls(storage)
    collected = collect_reel_urls(
        page_url,
        headless=headless,
        max_scrolls=max_scrolls,
        scroll_pause_ms=scroll_pause_ms,
        max_reels=max_reels,
    )

    stored = 0
    skipped = 0
    failed = 0

    for index, reel_url in enumerate(collected, 1):
        normalized_url = normalize_reel_url(reel_url)
        if normalized_url in existing_urls:
            skipped += 1
            print(f"[{index}] skip duplicate: {normalized_url}")
            continue

        print(f"[{index}] fetch: {normalized_url}")
        try:
            meta = fetch_reel_metadata(normalized_url)
        except Exception as exc:
            failed += 1
            print(f"    ERROR: {exc}")
            continue

        reel_id = reel_id_from_url(normalized_url)
        local_thumbnail = download_thumbnail_local(str(meta.get("thumbnail_url") or ""), reel_id, normalized_url)
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
            f"    saved: title={meta.get('title') or ''} date={meta.get('upload_date') or ''} thumb={local_thumbnail or ''}"
        )

    return {
        "collected": len(collected),
        "stored": stored,
        "skipped": skipped,
        "failed": failed,
        "db_total": storage.count_facebook_reels(source_page_url=SOURCE_PAGE_URL),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync public Facebook reels into MySQL without duplicates.")
    parser.add_argument("--page-url", default=PAGE_URL, help="Facebook reels page URL to scrape.")
    parser.add_argument("--max-reels", type=int, default=20, help="Maximum number of reels to collect.")
    parser.add_argument("--max-scrolls", type=int, default=12, help="How many scroll rounds to attempt.")
    parser.add_argument("--scroll-pause-ms", type=int, default=3500, help="Pause between scrolls in milliseconds.")
    parser.add_argument("--headful", action="store_true", help="Show the browser instead of headless mode.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = sync_public_reels(
        page_url=args.page_url,
        max_reels=max(1, int(args.max_reels or 20)),
        headless=not args.headful,
        max_scrolls=max(1, int(args.max_scrolls or 12)),
        scroll_pause_ms=max(500, int(args.scroll_pause_ms or 3500)),
    )
    print(result)
