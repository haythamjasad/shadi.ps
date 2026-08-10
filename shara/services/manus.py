from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict

import time

import requests


@dataclass(frozen=True)
class ManusReel:
    reel_url: str
    title: str
    upload_date: str
    thumbnail_url: str
    video_url: str
    source_page_url: str


class ManusError(RuntimeError):
    pass


def _log(message: str) -> None:
    print(f"[Manus] {message}", flush=True)


def _pick(payload: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = str(payload.get(key) or "").strip()
        if value:
            return value
    return ""


class ManusClient:
    def __init__(self, *, api_key: str, timeout_seconds: int = 120):
        self.api_key = str(api_key or "").strip()
        self.timeout_seconds = int(timeout_seconds or 0)
        self.base_url = "https://api.manus.ai/v2"

    def _timeout(self) -> int | None:
        return None if self.timeout_seconds <= 0 else self.timeout_seconds

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise ManusError("MANUS_API_KEY is missing.")

        return {
            "Content-Type": "application/json",
            "x-manus-api-key": self.api_key,
        }

    def _create_task(self, *, page_url: str, platform: str = "facebook") -> str:
        platform_name = "TikTok" if str(platform or "").strip().lower() == "tiktok" else "Facebook"
        schema = {
            "type": "object",
            "properties": {
                "reel_url": {"type": "string"},
                "title": {"type": "string"},
                "upload_date": {"type": "string"},
                "thumbnail_url": {"type": "string"},
                "source_page_url": {"type": "string"},
            },
            "required": ["reel_url", "title", "upload_date", "thumbnail_url", "source_page_url"],
            "additionalProperties": False,
        }

        prompt = (
            f"Open this {platform_name} page and identify the newest video only. "
            "Return the reel URL, title, upload date, thumbnail URL, and the source page URL. "
            "Do not store any video file locally.\n\n"
            f"{platform_name} page: {page_url}"
        )

        _log(f"Creating task for page: {page_url}")
        resp = requests.post(
            f"{self.base_url}/task.create",
            headers=self._headers(),
            json={
                "title": f"Scrape latest {platform_name} video",
                "message": {"content": prompt},
                "structured_output_schema": schema,
                "interactive_mode": False,
                "hide_in_task_list": True,
                "share_visibility": "private",
                "agent_profile": "manus-1.6",
            },
            timeout=self._timeout(),
        )
        if resp.status_code >= 400:
            raise ManusError(f"Manus task.create failed: HTTP {resp.status_code} {resp.text}")
        resp.raise_for_status()
        payload = resp.json()
        task_id = str(payload.get("task_id") or "").strip()
        if not task_id:
            raise ManusError("Manus did not return a task_id.")
        _log(f"Task created: {task_id}")
        return task_id

    def _wait_for_result(self, *, task_id: str) -> tuple[Dict[str, Any], list[Dict[str, Any]]]:
        deadline = None if self.timeout_seconds <= 0 else time.time() + self.timeout_seconds
        cursor: str | None = None
        last_status: str | None = None
        while deadline is None or time.time() < deadline:
            detail_resp = requests.get(
                f"{self.base_url}/task.detail",
                headers=self._headers(),
                params={"task_id": task_id},
                timeout=self._timeout(),
            )
            if detail_resp.status_code == 404:
                _log("Task not yet visible in Manus; retrying...")
                time.sleep(3)
                continue
            if detail_resp.status_code >= 400:
                raise ManusError(f"Manus task.detail failed: HTTP {detail_resp.status_code} {detail_resp.text}")
            detail_resp.raise_for_status()
            detail_payload = detail_resp.json()
            task = detail_payload.get("task") or {}
            task_status = str(task.get("status") or "").strip().lower()
            if task_status and task_status != last_status:
                last_status = task_status
                _log(f"Task status: {task_status}")
            if task_status == "error":
                raise ManusError("Manus task failed.")

            params = {"task_id": task_id, "order": "asc", "limit": 50}
            if cursor:
                params["cursor"] = cursor
            resp = requests.get(
                f"{self.base_url}/task.listMessages",
                headers=self._headers(),
                params=params,
                timeout=self._timeout(),
            )
            if resp.status_code == 404:
                _log("Messages not yet available; retrying...")
                time.sleep(3)
                continue
            if resp.status_code >= 400:
                raise ManusError(f"Manus task.listMessages failed: HTTP {resp.status_code} {resp.text}")
            resp.raise_for_status()
            payload = resp.json()
            messages = payload.get("messages") or []
            structured = None
            attachments: list[Dict[str, Any]] = []

            for msg in messages:
                if not isinstance(msg, dict):
                    continue
                if msg.get("type") == "structured_output_result" and isinstance(msg.get("structured_output_result"), dict):
                    structured = msg["structured_output_result"]
                assistant = msg.get("assistant_message") or {}
                if isinstance(assistant, dict):
                    for attachment in assistant.get("attachments") or []:
                        if isinstance(attachment, dict):
                            attachments.append(attachment)
                status = msg.get("status_update") or {}
                if isinstance(status, dict):
                    agent_status = str(status.get("agent_status") or "").strip()
                    if agent_status and agent_status != last_status:
                        last_status = agent_status
                        brief = str(status.get("brief") or "").strip()
                        description = str(status.get("description") or "").strip()
                        _log(f"Status: {agent_status} {brief or description}")
                    if agent_status in {"stopped", "error"} and structured is not None:
                        return structured, attachments

            if structured is not None:
                value = structured.get("value") if isinstance(structured, dict) else {}
                if isinstance(value, dict):
                    _log(f"Structured output received: {json.dumps(value, ensure_ascii=False)}")
                return structured, attachments

            _log("Waiting for Manus to finish...")
            time.sleep(4)

        raise ManusError("Timed out waiting for Manus task completion.")

    def scrape_reel(self, page_url: str, platform: str = "facebook") -> ManusReel:
        platform_name = "TikTok" if str(platform or "").strip().lower() == "tiktok" else "Facebook"
        _log(f"Starting latest-{platform_name.lower()} scrape")
        task_id = self._create_task(page_url=page_url, platform=platform)
        structured, attachments = self._wait_for_result(task_id=task_id)
        if not isinstance(structured, dict):
            raise ManusError("Manus did not return structured output.")

        value = structured.get("value") or {}
        if not isinstance(value, dict):
            value = {}

        video_url = ""
        for attachment in attachments:
            if str(attachment.get("type") or "").lower() == "file":
                video_url = str(attachment.get("url") or "").strip()
                if video_url:
                    _log(f"Video attachment found: {attachment.get('filename') or 'unnamed file'}")
                    break

        scraped = ManusReel(
            reel_url=_pick(value, "reel_url") or str(page_url or "").strip(),
            title=_pick(value, "title"),
            upload_date=_pick(value, "upload_date"),
            thumbnail_url=_pick(value, "thumbnail_url"),
            video_url=video_url,
            source_page_url=_pick(value, "source_page_url") or str(page_url or "").strip(),
        )
        _log(f"Newest reel: {scraped.reel_url}")
        _log(f"Title: {scraped.title}")
        _log(f"Upload date: {scraped.upload_date}")
        return scraped
