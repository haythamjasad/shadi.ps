from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

from config import ROOT, get_settings
from services.storage import create_storage


DEFAULT_FACEBOOK_URL = "https://www.facebook.com/shadi.shirri/reels/"
DEFAULT_TIKTOK_URL = "https://www.tiktok.com/@shadishirri"
DEFAULT_FACEBOOK_LIMIT = 2
DEFAULT_TIKTOK_LIMIT = 5
MANUS_BASE_URL = "https://api.manus.ai/v2"


def log(message: str) -> None:
    print(f"[Sync] {message}", flush=True)


def clean_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def clean_title(value: object) -> str:
    text = clean_text(value)
    if not text:
        return ""
    parts = [clean_text(part) for part in text.split("|")]
    parts = [part for part in parts if part]
    if len(parts) >= 2:
        cleaned_parts = []
        for part in parts:
            lowered = part.lower()
            if re.search(r"\b\d+(?:\.\d+)?\s*[km]?\s+(views|reactions|likes|comments)\b", lowered):
                continue
            if lowered in {"shadi shirri", "shadi shiri", "شادي شري", "شادي شيري"}:
                continue
            cleaned_parts.append(part)
        if cleaned_parts:
            text = cleaned_parts[0]
    text = re.sub(r"^\s*\d+(?:\.\d+)?\s*[KMkm]?\s+(?:views|reactions|likes|comments)\s*[·،,]\s*", "", text).strip()
    text = re.sub(r"\s*\|\s*(?:Shadi\s+Shirri|Shadi\s+Shiri|شادي\s+شري|شادي\s+شيري)\s*$", "", text, flags=re.IGNORECASE).strip()
    return text


def reel_id_from_url(url: str, platform: str) -> str:
    parsed = urlparse(str(url or "").strip())
    parts = [part for part in str(parsed.path or "").strip("/").split("/") if part]
    markers = ("video", "videos") if platform == "tiktok" else ("reel", "reels", "video", "videos")
    for marker in markers:
        if marker in parts:
            index = parts.index(marker)
            if index + 1 < len(parts):
                return parts[index + 1].split("?", 1)[0].split("#", 1)[0]
    for part in reversed(parts):
        if part and part not in {"share"}:
            return part.split("?", 1)[0].split("#", 1)[0]
    return hashlib.sha1(str(url or "").encode("utf-8", errors="ignore")).hexdigest()


def is_complete(row: dict[str, Any] | None) -> bool:
    if not row:
        return False
    return bool(
        clean_text(row.get("title"))
        and clean_text(row.get("thumbnail_url") or row.get("thumbnail_path"))
        and clean_text(row.get("transcription"))
    )


def parse_raw(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {}
    try:
        raw = json.loads(str(row.get("raw_row_json") or "{}"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def raw_json(row: dict[str, Any] | None, **updates: Any) -> str:
    raw = parse_raw(row)
    raw.update({key: value for key, value in updates.items() if value is not None})
    raw["sync_source"] = "sync_reels_manus"
    raw["sync_updated_at"] = int(time.time())
    return json.dumps(raw, ensure_ascii=False)


def parse_reels_json(value: object) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        if isinstance(parsed, dict) and isinstance(parsed.get("reels"), list):
            return [item for item in parsed["reels"] if isinstance(item, dict)]
    except Exception:
        pass
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]
        except Exception:
            pass
    return []


def assistant_text_from_message(msg: dict[str, Any]) -> str:
    values: list[str] = []
    for key in ("text", "content", "message"):
        if msg.get(key):
            values.append(str(msg.get(key)))
    assistant = msg.get("assistant_message")
    if isinstance(assistant, dict):
        for key in ("text", "content", "message"):
            if assistant.get(key):
                values.append(str(assistant.get(key)))
        for block in assistant.get("content") or []:
            if isinstance(block, dict) and block.get("text"):
                values.append(str(block.get("text")))
    return "\n".join(values)


def fallback_reels_from_text(text: str, platform: str) -> list[dict[str, Any]]:
    reels = parse_reels_json(text)
    if reels:
        return reels
    if platform == "tiktok":
        pattern = r"https?://(?:www\.)?tiktok\.com/@[^\s\"'<>]+/video/\d+"
    else:
        pattern = r"https?://(?:www\.)?facebook\.com/(?:reel|watch|share/reel)/[^\s\"'<>]+"
    seen = set()
    fallback = []
    for url in re.findall(pattern, text):
        clean_url = url.rstrip(".,;)]}")
        if clean_url in seen:
            continue
        seen.add(clean_url)
        fallback.append({"reel_url": clean_url, "title": "", "upload_date": "", "thumbnail_url": "", "video_url": "", "source_page_url": ""})
    return fallback


def manus_headers(api_key: str) -> dict[str, str]:
    if not api_key:
        raise RuntimeError("MANUS_API_KEY is missing.")
    return {"Content-Type": "application/json", "x-manus-api-key": api_key}


def create_manus_task(*, api_key: str, page_url: str, platform: str, limit: int, timeout: int) -> str:
    platform_name = "TikTok" if platform == "tiktok" else "Facebook"
    schema = {
        "type": "object",
        "properties": {
            "reels_json": {"type": "string"}
        },
        "required": ["reels_json"],
        "additionalProperties": False,
    }
    prompt = (
        f"Open this {platform_name} page and return exactly the newest {limit} videos/reels when available. "
        "For each item return reel_url, title, upload_date, thumbnail_url, source_page_url, "
        "and video_url only if you can find a direct downloadable media URL. "
        "Do not download or store files. Do not return an empty array if reel links are visible. "
        "Put the result in reels_json as a valid JSON array string. "
        "Example reels_json value: "
        "[{\"reel_url\":\"https://...\",\"title\":\"...\",\"upload_date\":\"...\",\"thumbnail_url\":\"...\",\"video_url\":\"\",\"source_page_url\":\"https://...\"}].\n\n"
        f"{platform_name} page: {page_url}"
    )
    log(f"Creating Manus task for {platform_name}: {page_url} limit={limit}")
    resp = requests.post(
        f"{MANUS_BASE_URL}/task.create",
        headers=manus_headers(api_key),
        json={
            "title": f"Scrape {limit} {platform_name} reels",
            "message": {"content": prompt},
            "structured_output_schema": schema,
            "interactive_mode": False,
            "hide_in_task_list": True,
            "share_visibility": "private",
            "agent_profile": "manus-1.6",
        },
        timeout=None if timeout <= 0 else timeout,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Manus task.create failed: HTTP {resp.status_code} {resp.text}")
    task_id = clean_text(resp.json().get("task_id"))
    if not task_id:
        raise RuntimeError("Manus did not return task_id.")
    log(f"Manus task created: {task_id}")
    return task_id


def wait_manus_result(*, api_key: str, task_id: str, platform: str, timeout: int) -> list[dict[str, Any]]:
    deadline = None if timeout <= 0 else time.time() + timeout
    last_status = ""
    while deadline is None or time.time() < deadline:
        detail = requests.get(
            f"{MANUS_BASE_URL}/task.detail",
            headers=manus_headers(api_key),
            params={"task_id": task_id},
            timeout=None if timeout <= 0 else timeout,
        )
        if detail.status_code >= 400 and detail.status_code != 404:
            raise RuntimeError(f"Manus task.detail failed: HTTP {detail.status_code} {detail.text}")
        if detail.status_code != 404:
            status = clean_text((detail.json().get("task") or {}).get("status")).lower()
            if status and status != last_status:
                last_status = status
                log(f"Manus task status: {status}")
            if status == "error":
                raise RuntimeError("Manus task failed.")

        messages = requests.get(
            f"{MANUS_BASE_URL}/task.listMessages",
            headers=manus_headers(api_key),
            params={"task_id": task_id, "order": "asc", "limit": 50},
            timeout=None if timeout <= 0 else timeout,
        )
        if messages.status_code >= 400 and messages.status_code != 404:
            raise RuntimeError(f"Manus task.listMessages failed: HTTP {messages.status_code} {messages.text}")
        fallback_text = ""
        if messages.status_code != 404:
            for msg in messages.json().get("messages") or []:
                if not isinstance(msg, dict):
                    continue
                fallback_text += "\n" + assistant_text_from_message(msg)
                structured = msg.get("structured_output_result")
                if isinstance(structured, dict):
                    value = structured.get("value") or {}
                    reels = value.get("reels") if isinstance(value, dict) else None
                    if not isinstance(reels, list) and isinstance(value, dict):
                        reels = parse_reels_json(value.get("reels_json"))
                    if isinstance(reels, list) and reels:
                        return [item for item in reels if isinstance(item, dict)]
            fallback_reels = fallback_reels_from_text(fallback_text, platform)
            if fallback_reels:
                log(f"Recovered {len(fallback_reels)} {platform} reels from Manus message text")
                return fallback_reels
            if last_status == "stopped":
                return []
        log("Waiting for Manus result...")
        time.sleep(4)
    raise RuntimeError("Timed out waiting for Manus task.")


def fetch_manus_reels(*, api_key: str, page_url: str, platform: str, limit: int, timeout: int) -> list[dict[str, Any]]:
    task_id = create_manus_task(api_key=api_key, page_url=page_url, platform=platform, limit=limit, timeout=timeout)
    items = wait_manus_result(api_key=api_key, task_id=task_id, platform=platform, timeout=timeout)
    normalized = []
    for item in items[: max(1, int(limit or 1))]:
        reel_url = clean_text(item.get("reel_url") or item.get("url"))
        if not reel_url:
            continue
        normalized.append(
            {
                "platform": platform,
                "reel_url": reel_url,
                "title": clean_title(item.get("title")),
                "upload_date": clean_text(item.get("upload_date") or item.get("date")),
                "thumbnail_url": clean_text(item.get("thumbnail_url") or item.get("thumbnail")),
                "video_url": clean_text(item.get("video_url") or item.get("media_url")),
                "source_page_url": clean_text(item.get("source_page_url")) or page_url,
            }
        )
    log(f"Manus returned {len(normalized)} {platform} reels")
    return normalized


def thumbnail_extension(content_type: str, fallback_url: str) -> str:
    guessed = mimetypes.guess_extension(str(content_type or "").split(";", 1)[0].strip())
    if guessed and guessed not in {".bin", ".txt", ".jpe"}:
        return guessed
    suffix = Path(str(fallback_url or "").split("?", 1)[0]).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ".jpg"


def download_thumbnail(*, url: str, platform: str, reel_id: str, dry_run: bool = False) -> str:
    source = clean_text(url)
    if not source:
        return ""
    if source.startswith("/images/"):
        return source
    if source.startswith("images/"):
        return f"/{source.lstrip('/')}"
    parsed = urlparse(source)
    if parsed.scheme not in {"http", "https"}:
        return ""
    target_dir = ROOT / "images" / "reel_thumbnails"
    target_dir.mkdir(parents=True, exist_ok=True)
    response = requests.get(
        source,
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.facebook.com/", "Accept": "image/*,*/*;q=0.8"},
        timeout=45,
    )
    response.raise_for_status()
    ext = thumbnail_extension(response.headers.get("Content-Type", ""), source)
    target = target_dir / f"{platform}_{reel_id}{ext}"
    if dry_run:
        log(f"[dry-run] Would save thumbnail: {target}")
        return f"/images/reel_thumbnails/{target.name}"
    target.write_bytes(response.content)
    log(f"Saved thumbnail: {target}")
    return f"/images/reel_thumbnails/{target.name}"


def create_assembly_transcript(*, api_key: str, media_url: str, timeout: int) -> str:
    resp = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={"authorization": api_key, "content-type": "application/json"},
        json={
            "audio_url": media_url,
            "speech_model": "universal-2",
            "speech_models": ["universal-2"],
            "summarization": True,
            "summary_model": "informative",
            "summary_type": "bullets",
        },
        timeout=None if timeout <= 0 else timeout,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"AssemblyAI transcript create failed: HTTP {resp.status_code} {resp.text}")
    transcript_id = clean_text(resp.json().get("id"))
    if not transcript_id:
        raise RuntimeError("AssemblyAI did not return transcript id.")
    return transcript_id


def wait_assembly_transcript(*, api_key: str, transcript_id: str, timeout: int, poll_interval: float) -> dict[str, Any]:
    deadline = time.time() + max(60, int(timeout or 900))
    while time.time() < deadline:
        resp = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers={"authorization": api_key},
            timeout=None if timeout <= 0 else timeout,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"AssemblyAI transcript poll failed: HTTP {resp.status_code} {resp.text}")
        payload = resp.json()
        status = clean_text(payload.get("status")).lower()
        if status == "completed":
            return payload
        if status == "error":
            raise RuntimeError(clean_text(payload.get("error")) or "AssemblyAI transcript failed.")
        log(f"AssemblyAI status: {status or 'queued'}")
        time.sleep(max(1.0, float(poll_interval or 3.0)))
    raise RuntimeError("Timed out waiting for AssemblyAI transcript.")


def run_assembly(*, settings: Any, media_url: str, skip: bool) -> tuple[str, str, str]:
    if skip:
        return "", "", "skipped"
    api_key = clean_text(settings.assembly_ai_api_key)
    if not api_key:
        return "", "", "missing_api_key"
    if not clean_text(media_url):
        return "", "", "missing_media_url"
    transcript_id = create_assembly_transcript(api_key=api_key, media_url=media_url, timeout=settings.assembly_ai_timeout_seconds)
    payload = wait_assembly_transcript(
        api_key=api_key,
        transcript_id=transcript_id,
        timeout=settings.assembly_ai_timeout_seconds,
        poll_interval=settings.assembly_ai_poll_interval_seconds,
    )
    return clean_text(payload.get("text")), clean_text(payload.get("summary")), "completed"


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
            source_xlsx="manus-sync",
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


def existing_row(storage: Any, *, platform: str, reel_id: str) -> dict[str, Any] | None:
    if platform == "tiktok":
        return storage.get_tiktok_reel(video_id=reel_id)
    return storage.get_facebook_reel(reel_id=reel_id)


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

    final_raw = raw_json(
        row,
        **item,
        local_thumbnail=thumbnail,
        thumbnail_status=thumbnail_status,
        assembly_status=assembly_status,
    )
    save_reel(storage, item=item, reel_id=reel_id, thumbnail=thumbnail, transcription=transcription, summary=summary, raw=final_raw, dry_run=args.dry_run)
    log(f"Finished {platform} reel {reel_id}: thumbnail={thumbnail_status}, assembly={assembly_status}")
    return "updated" if row else "created"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Facebook and TikTok reels through Manus, then download thumbnails and run AssemblyAI.")
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
    return parser.parse_args()


def main() -> None:
    load_dotenv(ROOT / ".env")
    settings = get_settings()
    args = parse_args()
    facebook_limit = args.facebook_limit or args.limit or DEFAULT_FACEBOOK_LIMIT
    tiktok_limit = args.tiktok_limit or args.limit or DEFAULT_TIKTOK_LIMIT
    if not settings.manus_api_key:
        raise SystemExit("MANUS_API_KEY is missing.")

    items: list[dict[str, Any]] = []
    if not args.skip_facebook and facebook_limit > 0:
        items.extend(fetch_manus_reels(api_key=settings.manus_api_key, page_url=args.facebook_url, platform="facebook", limit=facebook_limit, timeout=settings.manus_timeout_seconds))
    if not args.skip_tiktok and tiktok_limit > 0:
        items.extend(fetch_manus_reels(api_key=settings.manus_api_key, page_url=args.tiktok_url, platform="tiktok", limit=tiktok_limit, timeout=settings.manus_timeout_seconds))

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
