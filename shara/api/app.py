from __future__ import annotations

import logging
import html
import hashlib
import json
import re
import secrets
import threading
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import requests

from config import get_settings
from services.storage import create_storage
from services.facebook_graph import sync_page_reels_via_graph
from services.reel_pipeline import ingest_manus_reel
from services.tiktok_sheet import list_tiktok_sheet_reels


log = logging.getLogger("sharah")
_SHARAH_SOURCE_PAGE_URL = "https://www.facebook.com/shadi.shirri/reels/"
_DEFAULT_POPULAR_TAGS = ["طوب", "برطاشة", "قصارة", "لياسة", "دهان", "شباك", "المنيوم", "تدفئة", "تكييف", "تهوية", "شفاط", "مكيف", "جبصين", "بلاط"]


def _resolve_local_thumbnail(thumbnail: str) -> str:
    value = str(thumbnail or "").strip()
    if not value:
        return ""

    normalized = value.replace('\\', '/').strip()
    parsed = urlparse(normalized)

    if parsed.scheme in {"http", "https"}:
        return normalized

    if normalized.startswith('/images/'):
        return normalized

    candidate_name = normalized.split('/')[-1].split('?', 1)[0].split('#', 1)[0].strip()
    if not candidate_name:
        return normalized

    local_candidate = Path('images') / candidate_name
    if local_candidate.exists() and local_candidate.is_file():
        return f"/images/{candidate_name}"

    return value


def _parse_tags(raw: object) -> list[str]:
    value = str(raw or "").strip()
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass
    return [value]


def _admin_tags(item: dict) -> list[str]:
    return _parse_tags(item.get("admin_tags"))


def _tags_to_json(tags: object) -> str:
    if isinstance(tags, list):
        values = tags
    else:
        values = re.split(r"[,،\n]", str(tags or ""))
    cleaned = []
    seen = set()
    for tag in values:
        value = str(tag or "").strip()
        if not value or value in seen:
            continue
        cleaned.append(value)
        seen.add(value)
    return json.dumps(cleaned, ensure_ascii=False)


def _normalize_popular_tags(value: object) -> list[dict]:
    source = value if isinstance(value, list) else []
    normalized: list[dict] = []
    seen = set()
    for item in source:
        if isinstance(item, dict):
            tag = str(item.get("tag") or item.get("name") or item.get("value") or "").strip()
            hidden = bool(item.get("hidden"))
        else:
            tag = str(item or "").strip()
            hidden = False
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append({"tag": tag, "hidden": hidden})
    return normalized


def _normalize_popular_settings(value: object) -> dict:
    if isinstance(value, dict):
        return {
            "enabled": bool(value.get("enabled", True)),
            "tags": _normalize_popular_tags(value.get("tags")),
        }
    return {"enabled": True, "tags": _normalize_popular_tags(value)}


def _normalize_platform_settings(value: object) -> dict:
    source = value if isinstance(value, dict) else {}
    normalized = {
        "facebook": bool(source.get("facebook", True)),
        "tiktok": bool(source.get("tiktok", False)),
    }
    if not normalized["facebook"] and not normalized["tiktok"]:
        normalized["facebook"] = True
    return normalized


def _normalize_search_text(value: object) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]", "", text)
    text = text.replace("ـ", "")
    text = re.sub("[إأآٱا]", "ا", text)
    text = text.replace("ة", "ه")
    text = text.replace("ى", "ي")
    text = text.replace("ی", "ي")
    text = text.replace("ؤ", "و")
    text = text.replace("ئ", "ي")
    text = text.replace("ک", "ك")
    text = text.replace("گ", "ك")
    text = re.sub(r"[^\w\u0621-\u064a\u0660-\u0669\u06f0-\u06f9]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _search_tokens(value: object) -> list[str]:
    return [term for term in _normalize_search_text(value).split() if term]


def _search_terms(query: str) -> list[str]:
    return _search_tokens(query)


def _canonical_tag(value: object) -> str:
    tokens = _search_tokens(value)
    canonical_tokens = [token[2:] if token.startswith("ال") and len(token) > 4 else token for token in tokens]
    return " ".join(canonical_tokens).strip()


def _strip_arabic_prefixes(term: str) -> set[str]:
    variants = {term}
    queue = [term]
    while queue:
        current = queue.pop()
        candidates: list[str] = []
        if current.startswith("ال") and len(current) > 4:
            candidates.append(current[2:])
        if current[:1] in {"و", "ف"} and len(current) > 3:
            candidates.append(current[1:])
        if current[:1] in {"ب", "ك", "ل"} and len(current) > 5 and current[1:].startswith("ال"):
            candidates.append(current[1:])
        for candidate in candidates:
            if len(candidate) < 2 or candidate in variants:
                continue
            variants.add(candidate)
            queue.append(candidate)
    return variants


def _strip_arabic_suffixes(term: str) -> set[str]:
    variants = {term}
    suffixes = ("تان", "تين", "ات", "ون", "ين", "ان", "ها", "هم", "نا", "ة", "ه")
    queue = [term]
    while queue:
        current = queue.pop()
        for suffix in suffixes:
            if not current.endswith(suffix) or len(current) <= len(suffix) + 1:
                continue
            candidate = current[: -len(suffix)]
            if len(candidate) < 2 or candidate in variants:
                continue
            variants.add(candidate)
            queue.append(candidate)
    return variants


def _term_variants(term: str) -> set[str]:
    base_terms = _strip_arabic_prefixes(term)
    variants: set[str] = set(base_terms)
    for base in list(base_terms):
        suffix_variants = _strip_arabic_suffixes(base)
        variants.update(suffix_variants)
        for value in list(suffix_variants):
            if value.endswith("ة"):
                variants.add(f"{value[:-1]}ه")
                variants.add(value[:-1])
            if value.endswith("ه"):
                variants.add(f"{value[:-1]}ة")
                variants.add(value[:-1])
            if len(value) >= 2 and not value.endswith(("ة", "ه")):
                variants.add(f"{value}ة")
                variants.add(f"{value}ه")
                variants.add(f"{value}ات")
                variants.add(f"{value}تين")
                variants.add(f"{value}تان")
            if value.startswith("براطي") and len(value) > 5:
                variants.add(f"برط{value[5:]}")
            if value.startswith("برط") and len(value) > 3:
                variants.add(f"براطي{value[3:]}")
            if value in {"برطاش", "برطاشة", "برطاشه"}:
                variants.update({"برطاش", "برطاشة", "برطاشه", "براطيش"})
            if value == "براطيش":
                variants.update({"براطيش", "برطاش", "برطاشة", "برطاشه"})
    return {variant for variant in variants if len(variant) >= 2}


def _value_matches_term(value_terms: list[str], term: str) -> bool:
    variants = _term_variants(term)
    return any(variants & _term_variants(value_term) for value_term in value_terms)


def _field_search_score(query: str, value: object, weight: int) -> int:
    query_terms = _search_terms(query)
    value_terms = _search_tokens(value)
    if not query_terms or not value_terms:
        return 0

    score = 0
    for term in query_terms:
        if _value_matches_term(value_terms, term):
            score += weight
    return score


def _tag_matches_query(tag: object, query: str) -> bool:
    tag_text = _normalize_search_text(tag)
    query_text = _normalize_search_text(query)
    if not query_text:
        return True
    if not tag_text:
        return False
    return tag_text == query_text or _canonical_tag(tag_text) == _canonical_tag(query_text)


def _search_tag_values(item: dict) -> list[str]:
    tags: list[str] = []
    # Public search must match only the visible/admin-managed reel tags.
    # Imported source tags can exist in the DB without being shown on the card.
    for tag in _admin_tags(item):
        value = str(tag or "").strip()
        if value:
            tags.append(value)
    return tags


def _raw_search_values(value: object) -> list[str]:
    keys = {
        "title",
        "summary",
        "summery",
        "description",
        "transcription",
        "transcript",
        "transaction",
        "tags",
        "keywords",
    }

    def walk(current: object, key: str = "") -> list[str]:
        if isinstance(current, dict):
            values: list[str] = []
            for child_key, child_value in current.items():
                values.extend(walk(child_value, str(child_key or "").strip().lower()))
            return values
        if isinstance(current, list):
            values: list[str] = []
            for item in current:
                values.extend(walk(item, key))
            return values
        if key in keys:
            text = str(current or "").strip()
            return [text] if text else []
        return []

    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        return walk(json.loads(raw))
    except Exception:
        return []


def _search_field_values(item: dict) -> dict[str, str]:
    raw_values = _raw_search_values(item.get("raw_row_json"))
    return {
        "title": str(item.get("title") or ""),
        "summary": " ".join(str(item.get(key) or "") for key in ("summary", "summery", "description")),
        "transcription": " ".join(str(item.get(key) or "") for key in ("transcription", "transcript", "transaction")),
        "tags": " ".join([*_admin_tags(item), *_parse_tags(item.get("tags")), *_parse_tags(item.get("source_tags"))]),
        "raw": " ".join(raw_values),
    }


def _search_score(item: dict, query: str) -> int:
    fields = _search_field_values(item)
    return (
        _field_search_score(query, fields["title"], 4)
        + _field_search_score(query, fields["tags"], 3)
        + _field_search_score(query, fields["summary"], 2)
        + _field_search_score(query, fields["transcription"], 2)
        + _field_search_score(query, fields["raw"], 1)
    )


def _matches_search_text(item: dict, query: str) -> bool:
    terms = _search_terms(query)
    if not terms:
        return True
    value_terms = _search_tokens(" ".join(_search_field_values(item).values()))
    return all(_value_matches_term(value_terms, term) for term in terms)


def _matches_tag_search_text(item: dict, query: str) -> bool:
    query_text = str(query or "").strip()
    if not query_text:
        return True
    return any(_tag_matches_query(tag, query_text) for tag in _search_tag_values(item))


def _tag_search_score(item: dict, query: str) -> int:
    query_text = str(query or "").strip()
    if not query_text:
        return 0
    for tag in _search_tag_values(item):
        if _normalize_search_text(tag) == _normalize_search_text(query_text):
            return 6
    for tag in _search_tag_values(item):
        if _tag_matches_query(tag, query_text):
            return 3
    return 0


def _public_reel(item: dict, *, include_search_text: bool = False) -> dict:
    public = dict(item)
    public["tags"] = _admin_tags(item)
    public["hidden"] = bool(item.get("is_hidden") or item.get("hidden"))
    if include_search_text:
        public["searchText"] = _normalize_search_text(" ".join(_search_field_values(item).values()))
    return public


def _download_image_bytes(target: str) -> tuple[bytes, str]:
    response = requests.get(
        target,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://www.facebook.com/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        timeout=20,
    )
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "image/jpeg")
    return response.content, content_type


def _thumb_cache_key(url: str, reel_url: str) -> str:
    raw = f"{url}|{reel_url}".encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()


def _host_matches(host: str, allowed: str) -> bool:
    host = str(host or "").lower().strip(".")
    allowed = str(allowed or "").lower().strip(".")
    return host == allowed or host.endswith(f".{allowed}")


def _is_facebook_host(host: str) -> bool:
    return _host_matches(host, "facebook.com")


def _is_facebook_image_host(host: str) -> bool:
    return _is_facebook_host(host) or _host_matches(host, "fbcdn.net")


def _thumb_cache_paths(cache_dir: Path, key: str) -> tuple[Path, Path]:
    return cache_dir / f"{key}.bin", cache_dir / f"{key}.json"


def _read_thumb_cache(cache_dir: Path, key: str) -> tuple[Path, str] | None:
    data_path, meta_path = _thumb_cache_paths(cache_dir, key)
    if not data_path.exists() or not meta_path.exists():
        return None

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    media_type = str(meta.get("media_type") or "image/jpeg")
    return data_path, media_type


def _write_thumb_cache(cache_dir: Path, key: str, content: bytes, media_type: str) -> tuple[Path, str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    data_path, meta_path = _thumb_cache_paths(cache_dir, key)
    data_path.write_bytes(content)
    meta_path.write_text(json.dumps({"media_type": media_type}, ensure_ascii=False), encoding="utf-8")
    return data_path, media_type


def _extract_og_image_from_reel_page(reel_url: str) -> str:
    response = requests.get(
        reel_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml",
        },
        timeout=20,
    )
    response.raise_for_status()
    page_html = response.text

    marker = 'property="og:image" content="'
    start = page_html.find(marker)
    if start == -1:
        return ""
    start += len(marker)
    end = page_html.find('"', start)
    if end == -1:
        return ""
    return html.unescape(page_html[start:end].strip())


def _extract_og_meta_from_reel_page(reel_url: str) -> dict:
    try:
        response = requests.get(
            reel_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "text/html,application/xhtml+xml",
            },
            timeout=20,
        )
        response.raise_for_status()
    except Exception:
        return {}

    page_html = response.text

    def read_meta(*names: str) -> str:
        for name in names:
            pattern = rf'<meta\s+(?:property|name)=["\']{re.escape(name)}["\']\s+content=["\']([^"\']*)["\']'
            match = re.search(pattern, page_html, flags=re.IGNORECASE)
            if match:
                return html.unescape(match.group(1).strip())
        return ""

    return {
        "title": read_meta("og:title", "twitter:title"),
        "thumbnail": read_meta("og:image", "twitter:image"),
    }


def _detect_reel_platform(reel_url: str, platform: str | None = None) -> str:
    explicit = str(platform or "").strip().lower()
    if explicit in {"facebook", "tiktok"}:
        return explicit
    host = urlparse(str(reel_url or "")).netloc.lower()
    if "tiktok.com" in host:
        return "tiktok"
    if "facebook.com" in host or "fb.watch" in host:
        return "facebook"
    raise HTTPException(status_code=400, detail="Only Facebook and TikTok reel URLs are supported.")


def _reel_id_from_url(reel_url: str) -> str:
    parsed = urlparse(str(reel_url or "").strip())
    path = unquote(str(parsed.path or "")).strip("/")
    parts = [part for part in path.split("/") if part]

    for marker in ("reel", "reels", "video", "videos"):
        if marker in parts:
            index = parts.index(marker)
            if index + 1 < len(parts):
                return parts[index + 1].split("?", 1)[0].split("#", 1)[0]

    for part in reversed(parts):
        if part and part not in {"share"}:
            return part.split("?", 1)[0].split("#", 1)[0]

    return hashlib.sha1(str(reel_url or "").encode("utf-8", errors="ignore")).hexdigest()


def _db_row_to_reel(row: dict) -> dict:
    return {
        "id": row["reel_id"],
        "title": row.get("title") or "",
        "summary": row.get("summary") or "",
        "transcription": row.get("transcription") or "",
        "topic": "عام",
        "thumbnail": _resolve_local_thumbnail(row.get("thumbnail_url") or ""),
        "facebookReelUrl": row["reel_url"],
        "uploadDate": row.get("upload_date"),
        "createdAt": row.get("created_at"),
        "popularityScore": row.get("popularity_score") or 0,
        "admin_tags": row.get("admin_tags"),
        "source_tags": row.get("tags"),
        "tags": _parse_tags(row.get("admin_tags")),
        "is_hidden": bool(row.get("is_hidden")),
        "raw_row_json": row.get("raw_row_json"),
    }


def _tiktok_db_row_to_reel(row: dict) -> dict:
    thumbnail = row.get("thumbnail_path") or row.get("thumbnail_url") or ""
    created_at = 0
    video_id = str(row.get("video_id") or "")
    try:
        if video_id.isdigit():
            created_at = float(int(video_id) >> 32)
    except Exception:
        created_at = 0

    return {
        "id": row["video_id"],
        "platform": "tiktok",
        "title": row.get("title") or "",
        "summary": row.get("summary") or "",
        "transcription": row.get("transcription") or "",
        "topic": "عام",
        "thumbnail": _resolve_local_thumbnail(thumbnail),
        "facebookReelUrl": row.get("video_url") or "",
        "uploadDate": None,
        "createdAt": created_at,
        "popularityScore": 0,
        "admin_tags": row.get("admin_tags"),
        "source_tags": row.get("tags"),
        "tags": _parse_tags(row.get("admin_tags")),
        "is_hidden": bool(row.get("is_hidden")),
        "raw_row_json": row.get("raw_row_json"),
        "duration": "",
    }


def _extract_tiktok_payload(page_html: str) -> dict:
    patterns = [
        r'<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
        r'<script[^>]+id="SIGI_STATE"[^>]*>(.*?)</script>',
    ]
    for pattern in patterns:
        match = re.search(pattern, page_html, flags=re.DOTALL | re.IGNORECASE)
        if not match:
            continue
        raw = html.unescape((match.group(1) or "").strip())
        if not raw:
            continue
        try:
            return json.loads(raw)
        except Exception:
            continue
    return {}


def _looks_like_tiktok_item(obj: dict) -> bool:
    return (
        isinstance(obj, dict)
        and str(obj.get("id") or "").isdigit()
        and isinstance(obj.get("video") or {}, dict)
    )


def _collect_tiktok_items(payload: dict) -> list[dict]:
    found: dict[str, dict] = {}

    def walk(node):
        if isinstance(node, dict):
            if _looks_like_tiktok_item(node):
                item_id = str(node.get("id") or "")
                if item_id:
                    found[item_id] = node
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for entry in node:
                walk(entry)

    walk(payload)
    return list(found.values())


def _tiktok_item_to_reel(item: dict, username: str) -> dict:
    item_id = str(item.get("id") or "")
    desc = str(item.get("desc") or "").strip()
    video = item.get("video") or {}
    thumb = (
        str(video.get("cover") or "").strip()
        or str(video.get("dynamicCover") or "").strip()
        or str(video.get("originCover") or "").strip()
    )
    create_ts = item.get("createTime")
    upload_date = None
    if str(create_ts or "").isdigit():
        try:
            from datetime import datetime, timezone

            upload_date = datetime.fromtimestamp(int(create_ts), tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        except Exception:
            upload_date = None

    return {
        "id": item_id,
        "title": desc,
        "topic": "عام",
        "thumbnail": thumb,
        "facebookReelUrl": f"https://www.tiktok.com/@{username}/video/{item_id}" if item_id else f"https://www.tiktok.com/@{username}",
        "uploadDate": upload_date,
        "popularityScore": 0,
        "platform": "tiktok",
        "tags": [],
    }


def _fetch_tiktok_creator_reels(username: str, limit: int = 100) -> list[dict]:
    profile_url = f"https://www.tiktok.com/@{username}"
    response = requests.get(
        profile_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml",
        },
        timeout=20,
    )
    response.raise_for_status()

    payload = _extract_tiktok_payload(response.text)
    if not payload:
        return []

    items = _collect_tiktok_items(payload)
    reels = [_tiktok_item_to_reel(item, username) for item in items]
    reels = [r for r in reels if r.get("id") and r.get("thumbnail")]
    reels.sort(key=lambda r: str(r.get("uploadDate") or ""), reverse=True)
    return reels[: max(1, min(int(limit or 100), 300))]


def create_app() -> FastAPI:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    settings = get_settings()
    app = FastAPI(title="Sharrah", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://admin.shadi.ps",
            "https://shara.shadi.ps",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://192.168.1.52:5174",
        ],
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5174$",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Admin-Token", "Authorization"],
    )

    base_dir = Path(__file__).resolve().parent
    templates = Jinja2Templates(directory=str(base_dir / "templates"))
    (base_dir.parent / "videos").mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(base_dir / "static")), name="static")
    app.mount("/images", StaticFiles(directory=str(base_dir.parent / "images")), name="images")
    app.mount("/videos", StaticFiles(directory=str(base_dir.parent / "videos")), name="videos")

    static_dir = base_dir / "static"
    images_dir = base_dir.parent / "images"
    videos_dir = base_dir.parent / "videos"

    def _serve_local_file(root: Path, relative_path: str) -> FileResponse:
        target = (root / relative_path).resolve()
        if root.resolve() not in target.parents and target != root.resolve():
            raise HTTPException(status_code=404, detail="Not Found")
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(str(target))

    @app.get("/static/{file_path:path}")
    async def static_file(file_path: str):
        return _serve_local_file(static_dir, file_path)

    @app.get("/sharah/static/{file_path:path}")
    async def sharah_static_file(file_path: str):
        return _serve_local_file(static_dir, file_path)

    @app.get("/images/{file_path:path}")
    async def image_file(file_path: str):
        return _serve_local_file(images_dir, file_path)

    @app.get("/sharah/images/{file_path:path}")
    async def sharah_image_file(file_path: str):
        return _serve_local_file(images_dir, file_path)

    @app.get("/videos/{file_path:path}")
    async def video_file(file_path: str):
        return _serve_local_file(videos_dir, file_path)

    @app.get("/sharah/videos/{file_path:path}")
    async def sharah_video_file(file_path: str):
        return _serve_local_file(videos_dir, file_path)

    storage_lock = threading.RLock()
    storage_instance = None

    def get_app_storage():
        nonlocal storage_instance
        with storage_lock:
            if storage_instance is None:
                storage_instance = create_storage(settings)
            return storage_instance

    def require_admin(request: Request) -> None:
        expected = str(settings.sharah_admin_token or "").strip()
        if not expected:
            raise HTTPException(status_code=403, detail="SHARAH_ADMIN_TOKEN is not configured.")
        provided = str(request.headers.get("X-Admin-Token") or request.query_params.get("admin_token") or "").strip()
        if not provided or not secrets.compare_digest(provided, expected):
            raise HTTPException(status_code=403, detail="Invalid admin token.")

    popular_tags_path = base_dir.parent / "data" / "popular_tags.json"
    admin_tags_path = base_dir.parent / "data" / "admin_tags.json"
    platform_settings_path = base_dir.parent / "data" / "platform_settings.json"

    def read_popular_settings(*, include_hidden: bool = False) -> dict:
        if popular_tags_path.exists():
            try:
                settings_data = _normalize_popular_settings(json.loads(popular_tags_path.read_text(encoding="utf-8")))
            except Exception:
                settings_data = {"enabled": True, "tags": []}
        else:
            settings_data = {"enabled": True, "tags": []}
        tags = settings_data["tags"] if include_hidden else [item for item in settings_data["tags"] if not item.get("hidden")]
        return {"enabled": bool(settings_data.get("enabled", True)), "tags": tags}

    def write_popular_settings(value: object) -> dict:
        normalized = _normalize_popular_settings(value)
        popular_tags_path.parent.mkdir(parents=True, exist_ok=True)
        popular_tags_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        return normalized

    def read_platform_settings() -> dict:
        if platform_settings_path.exists():
            try:
                return _normalize_platform_settings(json.loads(platform_settings_path.read_text(encoding="utf-8")))
            except Exception:
                pass
        return _normalize_platform_settings({})

    def write_platform_settings(value: object) -> dict:
        normalized = _normalize_platform_settings(value)
        platform_settings_path.parent.mkdir(parents=True, exist_ok=True)
        platform_settings_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        return normalized

    def read_admin_tags() -> list[str]:
        if not admin_tags_path.exists():
            return []
        try:
            return _parse_tags(json.dumps(json.loads(admin_tags_path.read_text(encoding="utf-8")), ensure_ascii=False))
        except Exception:
            return []

    def write_admin_tags(tags: object) -> list[str]:
        normalized = _parse_tags(_tags_to_json(tags))
        admin_tags_path.parent.mkdir(parents=True, exist_ok=True)
        admin_tags_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
        return normalized

    thumb_cache_dir = Path("data/thumb_cache")

    def list_display_reels(*, limit: int | None = 100, offset: int = 0, include_hidden: bool = False) -> list[dict]:
        storage = get_app_storage()
        rows = storage.list_facebook_reels(limit=limit, offset=offset, source_page_url=_SHARAH_SOURCE_PAGE_URL, include_hidden=include_hidden)
        if not rows:
            rows = storage.list_facebook_reels(limit=limit, offset=offset, include_hidden=include_hidden)
        return [_db_row_to_reel(r) for r in rows]

    @app.get("/health")
    async def health() -> dict:
        return {"ok": True}

    @app.get("/favicon.ico")
    async def favicon() -> FileResponse:
        # Reuse an existing local image so browsers stop probing a missing icon.
        return FileResponse(str(base_dir.parent / "images" / "circle_logo_footer.png"))

    @app.get("/")
    async def root(request: Request):
        return templates.TemplateResponse("sharah.html", {"request": request})

    @app.get("/terms-and-policies")
    async def terms_and_policies(request: Request):
        return templates.TemplateResponse("policies.html", {"request": request})

    @app.get("/sharah/admin", response_class=HTMLResponse)
    async def sharah_admin(request: Request):
        return templates.TemplateResponse("admin.html", {"request": request})

    @app.get("/v01/api/sharah/reels")
    @app.get("/api/sharah/reels")
    async def sharah_reels(request: Request, limit: int | None = 100, offset: int = 0, q: str = "", include_hidden: bool = False) -> list[dict]:
        if include_hidden:
            require_admin(request)
        limit_n = None if limit is None else max(1, int(limit))
        query = str(q or "").strip()
        reels = list_display_reels(limit=None if query else limit_n, offset=0 if query else offset, include_hidden=include_hidden)
        if query:
            reels = [r for r in reels if _matches_tag_search_text(r, query)]
            reels.sort(key=lambda r: (_tag_search_score(r, query), r.get("createdAt") or 0), reverse=True)
            if limit_n is not None:
                reels = reels[:limit_n]
        return [_public_reel(r, include_search_text=bool(query)) for r in reels]

    @app.get("/v01/api/sharah/popular-tags")
    @app.get("/api/sharah/popular-tags")
    async def sharah_popular_tags(request: Request, include_hidden: bool = False) -> dict:
        if include_hidden:
            require_admin(request)
        return read_popular_settings(include_hidden=include_hidden)

    @app.post("/v01/api/sharah/popular-tags")
    @app.post("/api/sharah/popular-tags")
    async def sharah_update_popular_tags(request: Request) -> dict:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        return write_popular_settings(payload)

    @app.get("/v01/api/sharah/platform-settings")
    @app.get("/api/sharah/platform-settings")
    async def sharah_platform_settings() -> dict:
        return read_platform_settings()

    @app.post("/v01/api/sharah/platform-settings")
    @app.post("/api/sharah/platform-settings")
    async def sharah_update_platform_settings(request: Request) -> dict:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        return write_platform_settings(payload)

    @app.get("/v01/api/sharah/admin-tags")
    @app.get("/api/sharah/admin-tags")
    async def sharah_admin_tags(request: Request) -> list[str]:
        require_admin(request)
        return read_admin_tags()

    @app.post("/v01/api/sharah/admin-tags")
    @app.post("/api/sharah/admin-tags")
    async def sharah_update_admin_tags(request: Request) -> list[str]:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        tags = payload.get("tags") if isinstance(payload, dict) else payload
        return write_admin_tags(tags)

    @app.get("/v01/api/sharah/reels/tiktok")
    @app.get("/api/sharah/reels/tiktok")
    async def sharah_tiktok_reels(request: Request, username: str = "shadishirri", limit: int = 100, q: str = "", include_hidden: bool = False) -> list[dict]:
        if include_hidden:
            require_admin(request)
        errors: list[str] = []
        query = str(q or "").strip()
        try:
            storage = get_app_storage()
            db_rows = storage.list_tiktok_reels(limit=limit, offset=0, include_hidden=include_hidden)
            if db_rows:
                reels = [_tiktok_db_row_to_reel(r) for r in db_rows]
                if query:
                    reels = [r for r in reels if _matches_tag_search_text(r, query)]
                return [_public_reel(r, include_search_text=bool(query)) for r in reels]
        except Exception as exc:
            errors.append(f"database: {exc}")
            log.warning("TikTok DB load failed: %s", exc)

        try:
            sheet_reels = list_tiktok_sheet_reels(sheet_path=settings.tiktok_sheet_path, limit=limit)
            if sheet_reels:
                if query:
                    sheet_reels = [r for r in sheet_reels if _matches_tag_search_text(r, query)]
                return [_public_reel(r, include_search_text=bool(query)) for r in sheet_reels]
        except Exception as exc:
            errors.append(f"sheet: {exc}")
            log.warning("TikTok sheet load failed: %s", exc)

        try:
            reels = _fetch_tiktok_creator_reels(username=username.strip().lstrip("@") or "shadishirri", limit=limit)
            if query:
                reels = [r for r in reels if _matches_tag_search_text(r, query)]
            return [_public_reel(r, include_search_text=bool(query)) for r in reels]
        except Exception as exc:
            errors.append(f"remote: {exc}")
            log.warning("TikTok remote load failed: %s", exc)
            raise HTTPException(status_code=503, detail="Could not load TikTok reels.") from exc

    @app.get("/v01/api/sharah/reels/search")
    @app.get("/api/sharah/reels/search")
    async def sharah_search_reels(q: str, limit: int = 100) -> list[dict]:
        query = (q or "").strip()
        if not query:
            return [_public_reel(r) for r in list_display_reels(limit=max(1, int(limit or 100)), offset=0)]

        reels = list_display_reels(limit=None, offset=0)
        ranked = [r for r in reels if _matches_tag_search_text(r, query)]
        ranked.sort(key=lambda r: (_tag_search_score(r, query), r.get("createdAt") or 0), reverse=True)
        ranked = ranked[: max(1, int(limit or 100))]
        return [_public_reel(r, include_search_text=True) for r in ranked]

    @app.post("/v01/api/sharah/reels/{platform}/{reel_id}/tags")
    @app.post("/api/sharah/reels/{platform}/{reel_id}/tags")
    async def sharah_update_reel_tags(request: Request, platform: str, reel_id: str) -> dict:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        tags_json = _tags_to_json(payload.get("tags") if isinstance(payload, dict) else payload)
        storage = get_app_storage()
        normalized_platform = str(platform or "").strip().lower()
        if normalized_platform == "facebook":
            storage.update_facebook_reel_tags(reel_id=reel_id, tags=tags_json)
        elif normalized_platform == "tiktok":
            storage.update_tiktok_reel_tags(video_id=reel_id, tags=tags_json)
        else:
            raise HTTPException(status_code=400, detail="Unsupported platform.")
        return {"id": reel_id, "platform": normalized_platform, "tags": _parse_tags(tags_json)}

    @app.post("/v01/api/sharah/reels/{platform}/{reel_id}/visibility")
    @app.post("/api/sharah/reels/{platform}/{reel_id}/visibility")
    async def sharah_update_reel_visibility(request: Request, platform: str, reel_id: str) -> dict:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        hidden = bool((payload or {}).get("hidden"))
        storage = get_app_storage()
        normalized_platform = str(platform or "").strip().lower()
        if normalized_platform == "facebook":
            storage.update_facebook_reel_visibility(reel_id=reel_id, hidden=hidden)
            row = storage.get_facebook_reel(reel_id=reel_id)
            if not row:
                raise HTTPException(status_code=404, detail="Reel not found.")
            return _public_reel(_db_row_to_reel(row))
        if normalized_platform == "tiktok":
            storage.update_tiktok_reel_visibility(video_id=reel_id, hidden=hidden)
            row = storage.get_tiktok_reel(video_id=reel_id)
            if not row:
                raise HTTPException(status_code=404, detail="Reel not found.")
            return _public_reel(_tiktok_db_row_to_reel(row))
        raise HTTPException(status_code=400, detail="Unsupported platform.")

    @app.post("/v01/api/sharah/reels/add-url")
    @app.post("/api/sharah/reels/add-url")
    async def sharah_add_reel_url(request: Request) -> dict:
        require_admin(request)
        try:
            payload = await request.json()
        except Exception:
            payload = {}

        reel_url = str((payload or {}).get("url") or (payload or {}).get("reelUrl") or "").strip()
        if not reel_url:
            raise HTTPException(status_code=400, detail="Reel URL is required.")

        parsed = urlparse(reel_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(status_code=400, detail="Enter a valid reel URL.")

        platform = _detect_reel_platform(reel_url, (payload or {}).get("platform"))
        reel_id = _reel_id_from_url(reel_url)
        if not reel_id:
            raise HTTPException(status_code=400, detail="Could not identify reel ID from URL.")

        meta = _extract_og_meta_from_reel_page(reel_url)
        title = str((payload or {}).get("title") or meta.get("title") or "").strip()
        thumbnail = str((payload or {}).get("thumbnail") or meta.get("thumbnail") or "").strip()
        tags_json = _tags_to_json((payload or {}).get("tags") or [])

        storage = get_app_storage()
        if platform == "tiktok":
            storage.upsert_tiktok_reel(
                video_id=reel_id,
                video_url=reel_url,
                thumbnail_url=thumbnail or None,
                thumbnail_path=thumbnail or None,
                title=title or None,
                tags=None,
                raw_row_json=json.dumps({"reel_url": reel_url, "platform": "tiktok", "title": title, "thumbnail_url": thumbnail}, ensure_ascii=False),
                source_xlsx="admin-url",
                source_row=0,
            )
            if tags_json != "[]":
                storage.update_tiktok_reel_tags(video_id=reel_id, tags=tags_json)
            row = storage.get_tiktok_reel(video_id=reel_id) or {}
            return _public_reel(_tiktok_db_row_to_reel(row))

        storage.upsert_facebook_reel(
            reel_id=reel_id,
            reel_url=reel_url,
            source_page_url=_SHARAH_SOURCE_PAGE_URL,
            title=title or None,
            upload_date=None,
            thumbnail_url=thumbnail or None,
            video_path=None,
        )
        if tags_json != "[]":
            storage.update_facebook_reel_tags(reel_id=reel_id, tags=tags_json)
        row = storage.get_facebook_reel(reel_id=reel_id) or {}
        return _public_reel(_db_row_to_reel(row))

    @app.post("/v01/api/sharah/reels/ingest-manus")
    @app.post("/api/sharah/reels/ingest-manus")
    async def sharah_ingest_reel_manus(request: Request, page_url: str, platform: str = "auto") -> dict:
        require_admin(request)
        if not settings.manus_api_key:
            raise HTTPException(status_code=400, detail="Missing MANUS_API_KEY in environment.")
        try:
            return ingest_manus_reel(reel_url=page_url, platform=platform)
        except Exception as e:
            log.warning("Manus ingest failed: %s", e)
            raise HTTPException(status_code=400, detail="Could not ingest reel with Manus") from e

    @app.post("/v01/api/sharah/reels/sync-graph")
    @app.post("/api/sharah/reels/sync-graph")
    async def sharah_sync_reels_graph(request: Request, max_items: int | None = None, reset: bool = False) -> dict:
        require_admin(request)
        """
        Sync reels/videos via Facebook Graph API (recommended).
        Requires FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN in .env.
        """
        if not settings.fb_page_id or not settings.fb_page_access_token:
            raise HTTPException(status_code=400, detail="Missing FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN in environment.")

        try:
            storage = get_app_storage()
            if reset:
                storage.delete_facebook_reels(source_page_url=_SHARAH_SOURCE_PAGE_URL)
            res = sync_page_reels_via_graph(
                storage=storage,
                source_page_url=_SHARAH_SOURCE_PAGE_URL,
                page_id=settings.fb_page_id,
                page_access_token=settings.fb_page_access_token,
                graph_api_version=settings.fb_graph_api_version,
                max_items=max_items,
            )
        except Exception as e:
            log.warning("Graph sync failed: %s", e)
            storage = get_app_storage()
            return {
                "stored": 0,
                "db_total": storage.count_facebook_reels(source_page_url=_SHARAH_SOURCE_PAGE_URL),
                "error": "Could not sync from Facebook Graph API",
            }

        storage = get_app_storage()
        res["db_total"] = storage.count_facebook_reels(source_page_url=_SHARAH_SOURCE_PAGE_URL)
        return res

    @app.get("/v01/api/sharah/reels/from-db")
    @app.get("/api/sharah/reels/from-db")
    async def sharah_reels_from_db(limit: int | None = 100, offset: int = 0) -> list[dict]:
        limit_n = None if limit is None else max(1, int(limit))
        storage = get_app_storage()
        rows = storage.list_facebook_reels(limit=limit_n, offset=offset, source_page_url=_SHARAH_SOURCE_PAGE_URL)
        if not rows:
            rows = storage.list_facebook_reels(limit=limit_n, offset=offset)
        return [
                {
                    "id": r["reel_id"],
                    "facebookReelUrl": r["reel_url"],
                    "title": r.get("title"),
                    "uploadDate": r.get("upload_date"),
                    "thumbnail": r.get("thumbnail_url"),
                    "sourcePageUrl": r.get("source_page_url"),
                    "admin_tags": r.get("admin_tags"),
                    "tags": _parse_tags(r.get("admin_tags")),
                }
            for r in rows
        ]

    @app.get("/v01/api/sharah/thumb")
    @app.get("/api/sharah/thumb")
    async def sharah_proxy_thumbnail(url: str, reelUrl: str | None = None):
        target = unquote(str(url or "")).strip()
        fallback_reel_url = unquote(str(reelUrl or "")).strip()
        if not target:
            raise HTTPException(status_code=400, detail="Missing thumbnail URL")

        cache_key = _thumb_cache_key(target, fallback_reel_url)
        cached = _read_thumb_cache(thumb_cache_dir, cache_key)
        if cached:
            data_path, media_type = cached
            return FileResponse(
                path=str(data_path),
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=86400"},
            )

        parsed = urlparse(target)
        if parsed.scheme not in {"http", "https"}:
            raise HTTPException(status_code=400, detail="Invalid thumbnail URL")

        host = (parsed.hostname or "").lower()
        if not _is_facebook_image_host(host):
            raise HTTPException(status_code=400, detail="Unsupported thumbnail host")

        try:
            body, content_type = _download_image_bytes(target)
            data_path, media_type = _write_thumb_cache(thumb_cache_dir, cache_key, body, content_type)
            return FileResponse(
                path=str(data_path),
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=86400"},
            )
        except Exception:
            parsed_reel = urlparse(fallback_reel_url) if fallback_reel_url else None
            if not parsed_reel or parsed_reel.scheme not in {"http", "https"}:
                raise HTTPException(status_code=502, detail="Failed to load thumbnail")

            reel_host = (parsed_reel.hostname or "").lower()
            if not _is_facebook_host(reel_host):
                raise HTTPException(status_code=502, detail="Failed to load thumbnail")

            try:
                fresh_image_url = _extract_og_image_from_reel_page(fallback_reel_url)
                if not fresh_image_url:
                    raise HTTPException(status_code=502, detail="Failed to load thumbnail")
                body, content_type = _download_image_bytes(fresh_image_url)
                data_path, media_type = _write_thumb_cache(thumb_cache_dir, cache_key, body, content_type)
                return FileResponse(
                    path=str(data_path),
                    media_type=media_type,
                    headers={"Cache-Control": "public, max-age=86400"},
                )
            except Exception:
                raise HTTPException(status_code=502, detail="Failed to load thumbnail")

    @app.post("/v01/api/sharah/reels/cache-thumbnails")
    @app.post("/api/sharah/reels/cache-thumbnails")
    async def sharah_cache_thumbnails(request: Request, limit: int = 200) -> dict:
        require_admin(request)
        reels = list_display_reels(limit=max(1, min(int(limit or 200), 1000)), offset=0)
        cached_count = 0
        failed_count = 0

        for reel in reels:
            target = str(reel.get("thumbnail") or "").strip()
            reel_url = str(reel.get("facebookReelUrl") or "").strip()
            if not target:
                continue

            key = _thumb_cache_key(target, reel_url)
            if _read_thumb_cache(thumb_cache_dir, key):
                continue

            try:
                body, content_type = _download_image_bytes(target)
                _write_thumb_cache(thumb_cache_dir, key, body, content_type)
                cached_count += 1
                continue
            except Exception:
                pass

            try:
                if reel_url:
                    fresh = _extract_og_image_from_reel_page(reel_url)
                    if fresh:
                        body, content_type = _download_image_bytes(fresh)
                        _write_thumb_cache(thumb_cache_dir, key, body, content_type)
                        cached_count += 1
                        continue
            except Exception:
                pass

            failed_count += 1

        return {
            "cached": cached_count,
            "failed": failed_count,
            "cacheDir": str(thumb_cache_dir),
        }

    return app


app = create_app()
