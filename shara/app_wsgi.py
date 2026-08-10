from __future__ import annotations

import asyncio
import logging
import sys
import traceback
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

log = logging.getLogger("sharah.wsgi")

try:
    from api.app import app as asgi_app
    _IMPORT_ERROR = None
except Exception:
    asgi_app = None
    _IMPORT_ERROR = traceback.format_exc()
    log.exception("Application failed to import")


class WSGIAdapter:
    def __init__(self, app: Any):
        self.app = app

    def __call__(self, environ, start_response):
        origin = str(environ.get("HTTP_ORIGIN") or "").strip()
        cors_headers = self._cors_headers(origin)

        if environ.get("REQUEST_METHOD") == "OPTIONS":
            start_response(
                "204 No Content",
                [
                    *cors_headers,
                    ("Content-Length", "0"),
                ],
            )
            return [b""]

        if self.app is None:
            body = b"Application failed to start.\n"
            start_response(
                "500 Internal Server Error",
                [
                    *cors_headers,
                    ("Content-Type", "text/plain; charset=utf-8"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        body = self._read_body(environ)
        scope = self._build_scope(environ)
        response_status = "500 Internal Server Error"
        response_headers = []
        response_chunks = []
        request_sent = False

        async def receive():
            nonlocal request_sent
            if request_sent:
                return {"type": "http.disconnect"}
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            nonlocal response_status, response_headers
            if message["type"] == "http.response.start":
                response_status = f'{message["status"]} {self._reason_phrase(message["status"])}'
                response_headers = [
                    (key.decode("latin-1"), value.decode("latin-1"))
                    for key, value in message.get("headers", [])
                ]
            elif message["type"] == "http.response.body":
                response_chunks.append(message.get("body", b""))

        try:
            asyncio.run(self.app(scope, receive, send))
        except Exception:
            err = traceback.format_exc()
            log.error("Unhandled ASGI exception:\n%s", err)
            body = b"Internal Server Error\n"
            start_response(
                "500 Internal Server Error",
                [
                    *cors_headers,
                    ("Content-Type", "text/plain; charset=utf-8"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        if not response_chunks:
            response_chunks.append(b"")
        start_response(response_status, self._merge_cors_headers(response_headers, cors_headers))
        return [b"".join(response_chunks)]

    @staticmethod
    def _cors_headers(origin):
        allowed = {
            "https://admin.shadi.ps",
            "https://shara.shadi.ps",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://192.168.1.52:5174",
        }
        allow_origin = origin if origin in allowed else "*"
        return [
            ("Access-Control-Allow-Origin", allow_origin),
            ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
            ("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token, Authorization"),
            ("Access-Control-Max-Age", "86400"),
            ("Vary", "Origin"),
        ]

    @staticmethod
    def _merge_cors_headers(response_headers, cors_headers):
        existing = {str(name).lower() for name, _value in response_headers}
        merged = list(response_headers)
        for header in cors_headers:
            if header[0].lower() not in existing:
                merged.append(header)
        return merged

    @staticmethod
    def _read_body(environ):
        raw_length = environ.get("CONTENT_LENGTH", "")
        try:
            length = int(raw_length) if raw_length else 0
        except ValueError:
            length = 0
        return environ["wsgi.input"].read(length) if length else b""

    @staticmethod
    def _build_scope(environ):
        headers = []
        for key, value in environ.items():
            if key == "CONTENT_TYPE" and value:
                headers.append((b"content-type", value.encode("latin-1")))
            elif key == "CONTENT_LENGTH" and value:
                headers.append((b"content-length", value.encode("latin-1")))
            elif key.startswith("HTTP_") and value:
                header = key[5:].replace("_", "-").lower().encode("latin-1")
                headers.append((header, value.encode("latin-1")))

        server_port = environ.get("SERVER_PORT") or "80"
        return {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": environ.get("SERVER_PROTOCOL", "HTTP/1.1").split("/", 1)[-1],
            "method": environ.get("REQUEST_METHOD", "GET"),
            "scheme": environ.get("wsgi.url_scheme", "http"),
            "path": environ.get("PATH_INFO", "") or "/",
            "raw_path": (environ.get("PATH_INFO", "") or "/").encode("utf-8"),
            "query_string": environ.get("QUERY_STRING", "").encode("latin-1"),
            "headers": headers,
            "server": (environ.get("SERVER_NAME", "localhost"), int(server_port) if server_port.isdigit() else 80),
            "client": (environ.get("REMOTE_ADDR", "127.0.0.1"), 0),
            "root_path": "",
        }

    @staticmethod
    def _reason_phrase(status_code):
        return {
            200: "OK",
            201: "Created",
            204: "No Content",
            301: "Moved Permanently",
            302: "Found",
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            422: "Unprocessable Entity",
            500: "Internal Server Error",
        }.get(status_code, "OK")


application = WSGIAdapter(asgi_app)
