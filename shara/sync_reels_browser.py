from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
from typing import Any

from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service as FirefoxService

from config import ROOT, get_settings
from services.storage import create_storage
from sync_reels_manus import (
    DEFAULT_FACEBOOK_LIMIT,
    DEFAULT_FACEBOOK_URL,
    DEFAULT_TIKTOK_LIMIT,
    DEFAULT_TIKTOK_URL,
    clean_text,
    clean_title,
    download_thumbnail,
    is_complete,
    parse_raw,
    reel_id_from_url,
    run_assembly,
)


def log(message: str) -> None:
    print(f"[BrowserSync] {message}", flush=True)


def raw_json(row: dict[str, Any] | None, **updates: Any) -> str:
    raw = parse_raw(row)
    raw.update({key: value for key, value in updates.items() if value is not None})
    raw["sync_source"] = "sync_reels_browser"
    raw["sync_updated_at"] = int(time.time())
    return json.dumps(raw, ensure_ascii=False)


def normalize_url(url: str) -> str:
    value = clean_text(url)
    if not value:
        return ""
    return value.split("#", 1)[0]


def clean_browser_title(value: object, *, platform: str, reel_url: str = "") -> str:
    title = clean_title(value)
    lowered = title.lower()
    generic = {
        "reel tile preview",
        "reels",
        "facebook",
        "watch",
        "tiktok - make your day",
    }
    if not title or lowered in generic:
        return ""
    if reel_url and reel_url.lower() in lowered:
        return ""
    if platform == "facebook":
        title = title.replace(" | Facebook", "").strip()
    return title


def create_driver(args: argparse.Namespace):
    browser = clean_text(args.browser).lower()
    if browser == "firefox":
        options = FirefoxOptions()
        if args.headless:
            options.add_argument("-headless")
        if args.browser_binary:
            options.binary_location = args.browser_binary
        service = FirefoxService(executable_path=args.driver_path) if args.driver_path else FirefoxService()
        return webdriver.Firefox(service=service, options=options)

    options = ChromeOptions()
    if args.headless:
        options.add_argument("--headless=new")
    if args.browser_binary:
        options.binary_location = args.browser_binary
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--lang=ar,en-US,en")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,2200")
    options.add_argument("--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
    service = ChromeService(executable_path=args.driver_path) if args.driver_path else ChromeService()
    return webdriver.Chrome(service=service, options=options)


def scroll_page(driver: Any, *, rounds: int, pause: float) -> None:
    last_height = 0
    for _ in range(max(1, int(rounds or 1))):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(max(0.5, float(pause or 1.0)))
        height = int(driver.execute_script("return document.body.scrollHeight || 0;") or 0)
        if height and height == last_height:
            break
        last_height = height


def extraction_script(platform: str) -> str:
    return r"""
const platform = arguments[0];
const absolute = (value) => {
  try { return new URL(value, location.href).toString(); } catch (_) { return ''; }
};
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const isWanted = (href) => {
  if (!href) return false;
  if (platform === 'tiktok') return /tiktok\.com\/@[^/?#]+\/video\/\d+/.test(href);
  return /facebook\.com\/(?:[^/?#]+\/)?(?:reel|reels|watch|share\/r|share\/reel)\//.test(href) || /facebook\.com\/watch\?v=\d+/.test(href);
};
const bestImage = (anchor) => {
  const scope = anchor.closest('article, div') || anchor;
  const images = Array.from(scope.querySelectorAll('img'));
  for (const img of images) {
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (src && !src.startsWith('data:')) return absolute(src);
  }
  const og = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
  return og ? absolute(og.getAttribute('content') || '') : '';
};
const bestTitle = (anchor) => {
  const values = [
    anchor.getAttribute('aria-label'),
    anchor.getAttribute('title'),
    anchor.innerText,
    anchor.closest('article, div')?.innerText,
    document.querySelector('meta[property="og:title"], meta[name="og:title"]')?.getAttribute('content'),
    document.title,
  ];
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
};
const items = [];
const seen = new Set();
const addItem = (href, sourceEl) => {
  href = absolute(href).replace(/[?&]__cft__=[^&#]*/g, '').replace(/[?&]__tn__=[^&#]*/g, '');
  if (!isWanted(href) || seen.has(href)) return;
  seen.add(href);
  items.push({
    reel_url: href,
    title: sourceEl ? bestTitle(sourceEl) : clean(document.querySelector('meta[property="og:title"], meta[name="og:title"]')?.getAttribute('content') || document.title),
    upload_date: '',
    thumbnail_url: sourceEl ? bestImage(sourceEl) : clean(document.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute('content') || ''),
    video_url: '',
    source_page_url: location.href,
  });
};
for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
  addItem(anchor.getAttribute('href') || '', anchor);
}
const html = document.documentElement.innerHTML.replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
const fallbackPattern = platform === 'tiktok'
  ? /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>\\]+\/video\/\d+/g
  : /https?:\/\/(?:www\.)?facebook\.com\/(?:reel|watch|share\/reel)\/[^\s"'<>\\]+/g;
for (const match of html.matchAll(fallbackPattern)) {
  addItem(match[0].replace(/\\/g, ''), null);
}
return items;
"""


def fetch_browser_reels(driver: Any, *, page_url: str, platform: str, limit: int, rounds: int, pause: float) -> list[dict[str, Any]]:
    log(f"Opening {platform} page: {page_url}")
    driver.get(page_url)
    time.sleep(max(1.0, float(pause or 1.0)))
    scroll_page(driver, rounds=rounds, pause=pause)
    items = driver.execute_script(extraction_script(platform), platform) or []
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        reel_url = normalize_url(item.get("reel_url") or item.get("url"))
        if not reel_url or reel_url in seen:
            continue
        seen.add(reel_url)
        normalized.append(
            {
                "platform": platform,
                "reel_url": reel_url,
                "title": clean_browser_title(item.get("title"), platform=platform, reel_url=reel_url),
                "upload_date": clean_text(item.get("upload_date") or item.get("date")),
                "thumbnail_url": clean_text(item.get("thumbnail_url") or item.get("thumbnail")),
                "video_url": clean_text(item.get("video_url") or item.get("media_url")),
                "source_page_url": clean_text(item.get("source_page_url")) or page_url,
            }
        )
        if len(normalized) >= max(1, int(limit or 1)):
            break
    log(f"Browser found {len(normalized)} {platform} reels")
    return normalized


def enrich_facebook_reels(driver: Any, items: list[dict[str, Any]], *, pause: float) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for item in items:
        if clean_text(item.get("title")) and clean_text(item.get("thumbnail_url")):
            enriched.append(item)
            continue
        try:
            driver.get(item["reel_url"])
            time.sleep(max(1.0, float(pause or 1.0)))
            meta = driver.execute_script(
                r"""
                const value = (selector, attr='content') => document.querySelector(selector)?.getAttribute(attr) || '';
                return {
                  title: value('meta[property="og:title"], meta[name="og:title"]'),
                  description: value('meta[property="og:description"], meta[name="description"]'),
                  image: value('meta[property="og:image"], meta[name="og:image"]'),
                  pageTitle: document.title || ''
                };
                """
            ) or {}
            title = clean_browser_title(meta.get("description"), platform="facebook", reel_url=item["reel_url"])
            if not title:
                title = clean_browser_title(meta.get("title") or meta.get("pageTitle"), platform="facebook", reel_url=item["reel_url"])
            if title:
                item["title"] = title
            if clean_text(meta.get("image")) and not clean_text(item.get("thumbnail_url")):
                item["thumbnail_url"] = clean_text(meta.get("image"))
        except Exception as exc:
            log(f"Facebook metadata enrich failed for {item.get('reel_url')}: {exc}")
        enriched.append(item)
    return enriched


def best_ytdlp_thumbnail(entry: dict[str, Any]) -> str:
    thumbnails = entry.get("thumbnails")
    if not isinstance(thumbnails, list):
        return clean_text(entry.get("thumbnail"))
    for thumb in thumbnails:
        if isinstance(thumb, dict) and clean_text(thumb.get("url")):
            return clean_text(thumb.get("url"))
    return ""


def fetch_ytdlp_tiktok(*, page_url: str, limit: int) -> list[dict[str, Any]]:
    command = [
        os.sys.executable,
        "-m",
        "yt_dlp",
        "--flat-playlist",
        "--dump-json",
        "--playlist-end",
        str(max(1, int(limit or 1))),
        page_url,
    ]
    log(f"Using yt-dlp TikTok fallback: {page_url}")
    result = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True, timeout=180)
    if result.returncode != 0:
        message = clean_text(result.stderr or result.stdout)
        raise RuntimeError(f"yt-dlp TikTok fallback failed: {message}")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        reel_url = normalize_url(entry.get("webpage_url") or entry.get("url") or entry.get("original_url"))
        if not reel_url or reel_url in seen:
            continue
        seen.add(reel_url)
        normalized.append(
            {
                "platform": "tiktok",
                "reel_url": reel_url,
                "title": clean_browser_title(entry.get("title") or entry.get("description"), platform="tiktok", reel_url=reel_url),
                "upload_date": clean_text(entry.get("upload_date")),
                "thumbnail_url": best_ytdlp_thumbnail(entry),
                "video_url": "",
                "source_page_url": page_url,
                "duration": entry.get("duration"),
                "view_count": entry.get("view_count"),
                "like_count": entry.get("like_count"),
                "comment_count": entry.get("comment_count"),
            }
        )
        if len(normalized) >= max(1, int(limit or 1)):
            break
    log(f"yt-dlp found {len(normalized)} tiktok reels")
    return normalized


def existing_row(storage: Any, *, platform: str, reel_id: str) -> dict[str, Any] | None:
    if platform == "tiktok":
        return storage.get_tiktok_reel(video_id=reel_id)
    return storage.get_facebook_reel(reel_id=reel_id)


def save_reel(storage: Any, *, item: dict[str, Any], reel_id: str, thumbnail: str = "", transcription: str = "", summary: str = "", raw: str, dry_run: bool) -> None:
    if dry_run:
        log(f"[dry-run] Would save {item['platform']} {reel_id}: {item['reel_url']}")
        return
    if item["platform"] == "tiktok":
        storage.upsert_tiktok_reel(
            video_id=reel_id,
            video_url=item["reel_url"],
            thumbnail_url=item.get("thumbnail_url") or None,
            thumbnail_path=thumbnail or item.get("thumbnail_url") or None,
            title=item.get("title") or None,
            summary=summary or None,
            transcription=transcription or None,
            raw_row_json=raw,
            source_xlsx="browser-sync",
            source_row=0,
        )
        return
    storage.upsert_facebook_reel(
        reel_id=reel_id,
        reel_url=item["reel_url"],
        source_page_url=item.get("source_page_url") or DEFAULT_FACEBOOK_URL,
        title=item.get("title") or None,
        upload_date=item.get("upload_date") or None,
        thumbnail_url=thumbnail or item.get("thumbnail_url") or None,
        summary=summary or None,
        transcription=transcription or None,
        raw_row_json=raw,
    )


def process_reel(storage: Any, settings: Any, item: dict[str, Any], args: argparse.Namespace) -> str:
    platform = item["platform"]
    reel_id = reel_id_from_url(item["reel_url"], platform)
    row = existing_row(storage, platform=platform, reel_id=reel_id)
    if row and is_complete(row) and not args.force:
        log(f"Skipping complete existing {platform} reel: {reel_id}")
        return "skipped"

    initial_raw = raw_json(row, **item, thumbnail_status="pending", assembly_status="pending")
    save_reel(storage, item=item, reel_id=reel_id, raw=initial_raw, dry_run=args.dry_run)
    log(f"Saved initial {platform} URL to DB: {item['reel_url']}")

    thumbnail = clean_text((row or {}).get("thumbnail_path") or (row or {}).get("thumbnail_url"))
    thumbnail_status = "existing" if thumbnail else "missing"
    if not args.skip_thumbnails and (args.force or not thumbnail or not thumbnail.startswith("/images/")):
        try:
            thumbnail = download_thumbnail(url=item.get("thumbnail_url") or thumbnail, platform=platform, reel_id=reel_id, dry_run=args.dry_run) or thumbnail
            thumbnail_status = "completed" if thumbnail else "missing_url"
        except Exception as exc:
            thumbnail_status = f"failed: {exc}"
            log(f"Thumbnail failed for {reel_id}: {exc}")

    transcription = clean_text((row or {}).get("transcription"))
    summary = clean_text((row or {}).get("summary"))
    assembly_status = "existing" if transcription else "pending"
    if args.force or not transcription:
        try:
            transcription, summary_from_ai, assembly_status = run_assembly(settings=settings, media_url=item.get("video_url") or item.get("reel_url"), skip=args.skip_assembly)
            summary = summary or summary_from_ai
        except Exception as exc:
            assembly_status = f"failed: {exc}"
            log(f"AssemblyAI failed for {reel_id}: {exc}")

    final_raw = raw_json(row, **item, local_thumbnail=thumbnail, thumbnail_status=thumbnail_status, assembly_status=assembly_status)
    save_reel(storage, item=item, reel_id=reel_id, thumbnail=thumbnail, transcription=transcription, summary=summary, raw=final_raw, dry_run=args.dry_run)
    log(f"Finished {platform} reel {reel_id}: thumbnail={thumbnail_status}, assembly={assembly_status}")
    return "updated" if row else "created"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Facebook and TikTok reels with a local headless browser, then download thumbnails and run AssemblyAI.")
    parser.add_argument("--limit", type=int, default=0, help="Shared limit for both platforms when platform-specific limits are omitted.")
    parser.add_argument("--facebook-limit", type=int, default=0)
    parser.add_argument("--tiktok-limit", type=int, default=0)
    parser.add_argument("--facebook-url", default=DEFAULT_FACEBOOK_URL)
    parser.add_argument("--tiktok-url", default=DEFAULT_TIKTOK_URL)
    parser.add_argument("--skip-facebook", action="store_true")
    parser.add_argument("--skip-tiktok", action="store_true")
    parser.add_argument("--skip-thumbnails", action="store_true")
    parser.add_argument("--skip-assembly", action="store_true")
    parser.add_argument("--force", action="store_true", help="Refresh existing complete reels too.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--browser", choices=["chrome", "firefox"], default=os.environ.get("SYNC_BROWSER", "chrome"))
    parser.add_argument("--browser-binary", default=os.environ.get("SYNC_BROWSER_BINARY", ""))
    parser.add_argument("--driver-path", default=os.environ.get("SYNC_BROWSER_DRIVER", ""))
    parser.add_argument("--skip-tiktok-ytdlp-fallback", action="store_true", help="Disable yt-dlp fallback when TikTok blocks the headless browser.")
    parser.add_argument("--no-headless", dest="headless", action="store_false")
    parser.add_argument("--scroll-rounds", type=int, default=6)
    parser.add_argument("--scroll-pause", type=float, default=2.0)
    parser.set_defaults(headless=True)
    return parser.parse_args()


def main() -> None:
    load_dotenv(ROOT / ".env")
    settings = get_settings()
    args = parse_args()
    facebook_limit = args.facebook_limit or args.limit or DEFAULT_FACEBOOK_LIMIT
    tiktok_limit = args.tiktok_limit or args.limit or DEFAULT_TIKTOK_LIMIT

    try:
        driver = create_driver(args)
    except WebDriverException as exc:
        raise SystemExit(f"Could not start {args.browser} webdriver. Install Chrome/Chromium + chromedriver or Firefox + geckodriver, or pass --browser-binary/--driver-path. Details: {exc}") from exc

    items: list[dict[str, Any]] = []
    try:
        if not args.skip_facebook and facebook_limit > 0:
            facebook_items = fetch_browser_reels(driver, page_url=args.facebook_url, platform="facebook", limit=facebook_limit, rounds=args.scroll_rounds, pause=args.scroll_pause)
            items.extend(enrich_facebook_reels(driver, facebook_items, pause=args.scroll_pause))
        if not args.skip_tiktok and tiktok_limit > 0:
            tiktok_items = fetch_browser_reels(driver, page_url=args.tiktok_url, platform="tiktok", limit=tiktok_limit, rounds=args.scroll_rounds, pause=args.scroll_pause)
            if len(tiktok_items) < tiktok_limit and not args.skip_tiktok_ytdlp_fallback:
                try:
                    tiktok_items = fetch_ytdlp_tiktok(page_url=args.tiktok_url, limit=tiktok_limit)
                except Exception as exc:
                    log(f"TikTok fallback failed: {exc}")
            items.extend(tiktok_items)
    finally:
        driver.quit()

    storage = create_storage(settings)
    stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    try:
        for item in items:
            try:
                result = process_reel(storage, settings, item, args)
                stats[result] = stats.get(result, 0) + 1
            except Exception as exc:
                stats["failed"] += 1
                log(f"Failed item {item.get('reel_url')}: {exc}")
    finally:
        storage.close()
    log(f"Done: {json.dumps(stats, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
