from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional, Protocol


class ReelStorage(Protocol):
    def upsert_facebook_reel(
        self,
        *,
        reel_id: str,
        reel_url: str,
        source_page_url: str,
        title: Optional[str] = None,
        upload_date: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        video_path: Optional[str] = None,
        popularity_score: float = 0.0,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        raw_row_json: Optional[str] = None,
    ) -> None: ...

    def count_facebook_reels(self, *, source_page_url: Optional[str] = None) -> int: ...

    def get_facebook_reel(self, *, reel_id: str) -> Optional[Dict[str, Any]]: ...

    def delete_facebook_reels(self, *, source_page_url: str) -> None: ...

    def delete_facebook_reels_not_in(self, *, source_page_url: str, reel_ids: List[str]) -> int: ...

    def list_facebook_reels(
        self,
        *,
        limit: Optional[int] = 10,
        offset: int = 0,
        source_page_url: Optional[str] = None,
        include_hidden: bool = False,
    ) -> List[Dict[str, Any]]: ...

    def get_tiktok_reel(self, *, video_id: str) -> Optional[Dict[str, Any]]: ...

    def upsert_tiktok_reel(
        self,
        *,
        video_id: str,
        video_url: str,
        thumbnail_url: Optional[str] = None,
        thumbnail_path: Optional[str] = None,
        title: Optional[str] = None,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        tags: Optional[str] = None,
        raw_row_json: Optional[str] = None,
        source_xlsx: Optional[str] = None,
        source_row: int = 0,
    ) -> None: ...

    def list_tiktok_reels(
        self,
        *,
        limit: Optional[int] = 10,
        offset: int = 0,
        include_hidden: bool = False,
    ) -> List[Dict[str, Any]]: ...

    def update_facebook_reel_tags(self, *, reel_id: str, tags: str) -> None: ...

    def update_tiktok_reel_tags(self, *, video_id: str, tags: str) -> None: ...

    def update_facebook_reel_visibility(self, *, reel_id: str, hidden: bool) -> None: ...

    def update_tiktok_reel_visibility(self, *, video_id: str, hidden: bool) -> None: ...

    def close(self) -> None: ...


class MySQLStorage:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        connect_timeout_seconds: int = 10,
    ):
        import pymysql
        import pymysql.cursors

        if not database or not user:
            raise ValueError("MYSQL_DATABASE and MYSQL_USER are required for MySQL storage")

        self._lock = threading.RLock()
        self._conn = pymysql.connect(
            host=host,
            port=int(port or 3306),
            user=user,
            password=password,
            database=database,
            connect_timeout=max(1, int(connect_timeout_seconds or 10)),
            charset="utf8mb4",
            autocommit=True,
            cursorclass=pymysql.cursors.DictCursor,
        )
        self.init_db()

    def init_db(self) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS facebook_reels (
                  reel_id VARCHAR(191) PRIMARY KEY,
                  reel_url TEXT NOT NULL,
                  title TEXT,
                  summary LONGTEXT,
                  transcript LONGTEXT,
                  transcription LONGTEXT,
                  raw_row_json LONGTEXT,
                  upload_date VARCHAR(64),
                  thumbnail_url TEXT,
                  popularity_score DOUBLE NOT NULL DEFAULT 0,
                  tags LONGTEXT,
                  admin_tags LONGTEXT,
                  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
                  source_page_url TEXT NOT NULL,
                  created_at DOUBLE NOT NULL,
                  updated_at DOUBLE NOT NULL,
                  INDEX idx_source_page_url (source_page_url(191)),
                  INDEX idx_upload_date (upload_date)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                """
            )
            self._ensure_facebook_reels_columns(cur)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tiktok_reels (
                  video_id VARCHAR(191) PRIMARY KEY,
                  video_url TEXT NOT NULL,
                  thumbnail_url TEXT,
                  thumbnail_path TEXT,
                  title TEXT,
                  summary LONGTEXT,
                  transcription LONGTEXT,
                  tags LONGTEXT,
                  admin_tags LONGTEXT,
                  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
                  raw_row_json LONGTEXT,
                  source_xlsx TEXT,
                  source_row INT NOT NULL,
                  created_at DOUBLE NOT NULL,
                  updated_at DOUBLE NOT NULL,
                  INDEX idx_source_row (source_row)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                """
            )
            self._ensure_tiktok_reels_columns(cur)
            self._conn.commit()

    def _ensure_facebook_reels_columns(self, cur) -> None:
        cur.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'facebook_reels'
            """
        )
        existing = {str(row.get("COLUMN_NAME") or "") for row in cur.fetchall()}

        additions = [
            ("title", "TEXT"),
            ("summary", "LONGTEXT"),
            ("transcript", "LONGTEXT"),
            ("transcription", "LONGTEXT"),
            ("raw_row_json", "LONGTEXT"),
            ("upload_date", "VARCHAR(64)"),
            ("thumbnail_url", "TEXT"),
            ("popularity_score", "DOUBLE NOT NULL DEFAULT 0"),
            ("tags", "LONGTEXT"),
            ("admin_tags", "LONGTEXT"),
            ("is_hidden", "TINYINT(1) NOT NULL DEFAULT 0"),
            ("source_page_url", "TEXT NOT NULL DEFAULT ''"),
            ("created_at", "DOUBLE NOT NULL DEFAULT 0"),
            ("updated_at", "DOUBLE NOT NULL DEFAULT 0"),
        ]

        for column, ddl in additions:
            if column in existing:
                continue
            cur.execute(f"ALTER TABLE facebook_reels ADD COLUMN {column} {ddl}")
            existing.add(column)

        if "keywords" in existing and "tags" in existing:
            cur.execute("UPDATE facebook_reels SET tags = keywords WHERE (tags IS NULL OR tags = '') AND keywords IS NOT NULL")

    def _ensure_tiktok_reels_columns(self, cur) -> None:
        cur.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tiktok_reels'
            """
        )
        existing = {str(row.get("COLUMN_NAME") or "") for row in cur.fetchall()}
        if "tags" not in existing:
            cur.execute("ALTER TABLE tiktok_reels ADD COLUMN tags LONGTEXT")
            existing.add("tags")
        if "summary" not in existing:
            cur.execute("ALTER TABLE tiktok_reels ADD COLUMN summary LONGTEXT")
            existing.add("summary")
        if "transcription" not in existing:
            cur.execute("ALTER TABLE tiktok_reels ADD COLUMN transcription LONGTEXT")
            existing.add("transcription")
        if "admin_tags" not in existing:
            cur.execute("ALTER TABLE tiktok_reels ADD COLUMN admin_tags LONGTEXT")
            existing.add("admin_tags")
        if "is_hidden" not in existing:
            cur.execute("ALTER TABLE tiktok_reels ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0")
            existing.add("is_hidden")
        if "keywords" in existing:
            cur.execute("UPDATE tiktok_reels SET tags = keywords WHERE (tags IS NULL OR tags = '') AND keywords IS NOT NULL")

    def upsert_facebook_reel(
        self,
        *,
        reel_id: str,
        reel_url: str,
        source_page_url: str,
        title: Optional[str] = None,
        upload_date: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        video_path: Optional[str] = None,
        popularity_score: float = 0.0,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        raw_row_json: Optional[str] = None,
    ) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                INSERT INTO facebook_reels (reel_id, reel_url, title, summary, transcript, transcription, raw_row_json, upload_date, thumbnail_url, popularity_score, source_page_url, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  reel_url = VALUES(reel_url),
                  title = COALESCE(VALUES(title), title),
                  summary = COALESCE(VALUES(summary), summary),
                  transcript = COALESCE(VALUES(transcript), transcript),
                  transcription = COALESCE(VALUES(transcription), transcription),
                  raw_row_json = COALESCE(VALUES(raw_row_json), raw_row_json),
                  upload_date = COALESCE(VALUES(upload_date), upload_date),
                  thumbnail_url = COALESCE(VALUES(thumbnail_url), thumbnail_url),
                  popularity_score = COALESCE(VALUES(popularity_score), popularity_score),
                  source_page_url = VALUES(source_page_url),
                  updated_at = VALUES(updated_at)
                """,
                (reel_id, reel_url, title, summary, transcription, transcription, raw_row_json, upload_date, thumbnail_url, float(popularity_score or 0), source_page_url, now, now),
            )
            self._conn.commit()

    def update_facebook_reel_tags(self, *, reel_id: str, tags: str) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE facebook_reels
                SET admin_tags = %s, updated_at = %s
                WHERE reel_id = %s
                """,
                (tags, now, reel_id),
            )
            self._conn.commit()

    def update_tiktok_reel_tags(self, *, video_id: str, tags: str) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE tiktok_reels
                SET admin_tags = %s, updated_at = %s
                WHERE video_id = %s
                """,
                (tags, now, video_id),
            )
            self._conn.commit()

    def update_facebook_reel_visibility(self, *, reel_id: str, hidden: bool) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE facebook_reels
                SET is_hidden = %s, updated_at = %s
                WHERE reel_id = %s
                """,
                (1 if hidden else 0, now, reel_id),
            )
            self._conn.commit()

    def update_tiktok_reel_visibility(self, *, video_id: str, hidden: bool) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE tiktok_reels
                SET is_hidden = %s, updated_at = %s
                WHERE video_id = %s
                """,
                (1 if hidden else 0, now, video_id),
            )
            self._conn.commit()

    def count_facebook_reels(self, *, source_page_url: Optional[str] = None) -> int:
        with self._lock:
            cur = self._conn.cursor()
            if source_page_url:
                cur.execute("SELECT COUNT(*) AS c FROM facebook_reels WHERE source_page_url = %s", (source_page_url,))
            else:
                cur.execute("SELECT COUNT(*) AS c FROM facebook_reels")
            row = cur.fetchone()
            return int(row["c"] if row else 0)

    def get_facebook_reel(self, *, reel_id: str) -> Optional[Dict[str, Any]]:
        reel_id = str(reel_id or "").strip()
        if not reel_id:
            return None

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                SELECT reel_id, reel_url, title, summary, transcription, raw_row_json, upload_date, thumbnail_url, popularity_score, tags, admin_tags, is_hidden, source_page_url, created_at, updated_at
                FROM facebook_reels
                WHERE reel_id = %s
                LIMIT 1
                """,
                (reel_id,),
            )
            return cur.fetchone()

    def delete_facebook_reels(self, *, source_page_url: str) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("DELETE FROM facebook_reels WHERE source_page_url = %s", (source_page_url,))
            self._conn.commit()

    def delete_facebook_reels_not_in(self, *, source_page_url: str, reel_ids: List[str]) -> int:
        ids = [str(reel_id or "").strip() for reel_id in reel_ids if str(reel_id or "").strip()]
        with self._lock:
            cur = self._conn.cursor()
            if ids:
                placeholders = ", ".join(["%s"] * len(ids))
                cur.execute(
                    f"DELETE FROM facebook_reels WHERE source_page_url = %s AND reel_id NOT IN ({placeholders})",
                    tuple([source_page_url, *ids]),
                )
            else:
                cur.execute("DELETE FROM facebook_reels WHERE source_page_url = %s", (source_page_url,))
            deleted = int(cur.rowcount or 0)
            self._conn.commit()
            return deleted

    def list_facebook_reels(
        self,
        *,
        limit: Optional[int] = 10,
        offset: int = 0,
        source_page_url: Optional[str] = None,
        include_hidden: bool = False,
    ) -> List[Dict[str, Any]]:
        offset = max(0, int(offset or 0))
        params: list[Any] = []
        where_parts = []
        if source_page_url:
            where_parts.append("source_page_url = %s")
            params.append(source_page_url)
        if not include_hidden:
            where_parts.append("COALESCE(is_hidden, 0) = 0")
        where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

        sql = f"""
            SELECT reel_id, reel_url, title, summary, transcription, raw_row_json, upload_date, thumbnail_url, popularity_score, tags, admin_tags, is_hidden, source_page_url, created_at, updated_at
            FROM facebook_reels
            {where}
            ORDER BY created_at DESC, updated_at DESC
        """
        if limit is not None:
            sql += " LIMIT %s OFFSET %s"
            params.extend([max(1, int(limit)), offset])

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(sql, tuple(params))
            return list(cur.fetchall())

    def list_tiktok_reels(
        self,
        *,
        limit: Optional[int] = 10,
        offset: int = 0,
        include_hidden: bool = False,
    ) -> List[Dict[str, Any]]:
        offset = max(0, int(offset or 0))
        params: list[Any] = []

        where = "" if include_hidden else "WHERE COALESCE(is_hidden, 0) = 0"

        sql = f"""
            SELECT video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags, admin_tags, is_hidden, raw_row_json, source_xlsx, source_row, created_at, updated_at
            FROM tiktok_reels
            {where}
            ORDER BY source_row ASC, updated_at DESC
        """
        if limit is not None:
            sql += " LIMIT %s OFFSET %s"
            params.extend([max(1, int(limit)), offset])

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(sql, tuple(params))
            return list(cur.fetchall())

    def get_tiktok_reel(self, *, video_id: str) -> Optional[Dict[str, Any]]:
        video_id = str(video_id or "").strip()
        if not video_id:
            return None

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                SELECT video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags, admin_tags, is_hidden, raw_row_json, source_xlsx, source_row, created_at, updated_at
                FROM tiktok_reels
                WHERE video_id = %s
                LIMIT 1
                """,
                (video_id,),
            )
            return cur.fetchone()

    def upsert_tiktok_reel(
        self,
        *,
        video_id: str,
        video_url: str,
        thumbnail_url: Optional[str] = None,
        thumbnail_path: Optional[str] = None,
        title: Optional[str] = None,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        tags: Optional[str] = None,
        raw_row_json: Optional[str] = None,
        source_xlsx: Optional[str] = None,
        source_row: int = 0,
    ) -> None:
        now = time.time()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                INSERT INTO tiktok_reels (
                  video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags,
                  raw_row_json, source_xlsx, source_row, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  video_url = VALUES(video_url),
                  thumbnail_url = COALESCE(VALUES(thumbnail_url), thumbnail_url),
                  thumbnail_path = COALESCE(VALUES(thumbnail_path), thumbnail_path),
                  title = COALESCE(VALUES(title), title),
                  summary = COALESCE(VALUES(summary), summary),
                  transcription = COALESCE(VALUES(transcription), transcription),
                  tags = COALESCE(VALUES(tags), tags),
                  raw_row_json = COALESCE(VALUES(raw_row_json), raw_row_json),
                  source_xlsx = COALESCE(VALUES(source_xlsx), source_xlsx),
                  source_row = VALUES(source_row),
                  updated_at = VALUES(updated_at)
                """,
                (
                    video_id,
                    video_url,
                    thumbnail_url,
                    thumbnail_path,
                    title,
                    summary,
                    transcription,
                    tags,
                    raw_row_json,
                    source_xlsx,
                    int(source_row or 0),
                    now,
                    now,
                ),
            )
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()


class SQLiteStorage:
    def __init__(self, *, path: str = "data/app_state.db"):
        import sqlite3

        self._lock = threading.RLock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self.init_db()

    def init_db(self) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS facebook_reels (
                  reel_id TEXT PRIMARY KEY,
                  reel_url TEXT NOT NULL,
                  title TEXT,
                  summary TEXT,
                  transcript TEXT,
                  transcription TEXT,
                  upload_date TEXT,
                  thumbnail_url TEXT,
                  popularity_score REAL NOT NULL DEFAULT 0,
                  tags TEXT,
                  admin_tags TEXT,
                  is_hidden INTEGER NOT NULL DEFAULT 0,
                  raw_row_json TEXT,
                  source_page_url TEXT NOT NULL DEFAULT '',
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tiktok_reels (
                  video_id TEXT PRIMARY KEY,
                  video_url TEXT NOT NULL,
                  thumbnail_url TEXT,
                  thumbnail_path TEXT,
                  title TEXT,
                  summary TEXT,
                  transcription TEXT,
                  tags TEXT,
                  admin_tags TEXT,
                  is_hidden INTEGER NOT NULL DEFAULT 0,
                  raw_row_json TEXT,
                  source_xlsx TEXT,
                  source_row INTEGER NOT NULL DEFAULT 0,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                )
                """
            )
            cur.execute("PRAGMA table_info(facebook_reels)")
            existing = {str(row[1] or "") for row in cur.fetchall()}
            additions = [
                ("summary", "TEXT"),
                ("transcript", "TEXT"),
                ("transcription", "TEXT"),
                ("tags", "TEXT"),
                ("admin_tags", "TEXT"),
                ("is_hidden", "INTEGER NOT NULL DEFAULT 0"),
                ("raw_row_json", "TEXT"),
                ("popularity_score", "REAL NOT NULL DEFAULT 0"),
            ]
            for column, ddl in additions:
                if column not in existing:
                    cur.execute(f"ALTER TABLE facebook_reels ADD COLUMN {column} {ddl}")
                    existing.add(column)
            if "keywords" in existing and "tags" in existing:
                cur.execute("UPDATE facebook_reels SET tags = keywords WHERE (tags IS NULL OR tags = '') AND keywords IS NOT NULL")
            if "transcript" in existing and "transcription" in existing:
                cur.execute("UPDATE facebook_reels SET transcription = transcript WHERE (transcription IS NULL OR transcription = '') AND transcript IS NOT NULL")
            cur.execute("PRAGMA table_info(tiktok_reels)")
            existing_tiktok = {str(row[1] or "") for row in cur.fetchall()}
            tiktok_additions = [
                ("thumbnail_url", "TEXT"),
                ("thumbnail_path", "TEXT"),
                ("title", "TEXT"),
                ("summary", "TEXT"),
                ("transcription", "TEXT"),
                ("tags", "TEXT"),
                ("admin_tags", "TEXT"),
                ("is_hidden", "INTEGER NOT NULL DEFAULT 0"),
                ("raw_row_json", "TEXT"),
                ("source_xlsx", "TEXT"),
                ("source_row", "INTEGER NOT NULL DEFAULT 0"),
                ("created_at", "REAL NOT NULL DEFAULT 0"),
                ("updated_at", "REAL NOT NULL DEFAULT 0"),
            ]
            for column, ddl in tiktok_additions:
                if column not in existing_tiktok:
                    cur.execute(f"ALTER TABLE tiktok_reels ADD COLUMN {column} {ddl}")
                    existing_tiktok.add(column)
            if "keywords" in existing_tiktok and "tags" in existing_tiktok:
                cur.execute("UPDATE tiktok_reels SET tags = keywords WHERE (tags IS NULL OR tags = '') AND keywords IS NOT NULL")
            self._conn.commit()

    @staticmethod
    def _row(row) -> Dict[str, Any]:
        return dict(row) if row is not None else {}

    def upsert_facebook_reel(
        self,
        *,
        reel_id: str,
        reel_url: str,
        source_page_url: str,
        title: Optional[str] = None,
        upload_date: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        video_path: Optional[str] = None,
        popularity_score: float = 0.0,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        raw_row_json: Optional[str] = None,
    ) -> None:
        now = time.time()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO facebook_reels (reel_id, reel_url, title, summary, transcript, transcription, raw_row_json, upload_date, thumbnail_url, popularity_score, source_page_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(reel_id) DO UPDATE SET
                  reel_url = excluded.reel_url,
                  title = COALESCE(excluded.title, facebook_reels.title),
                  summary = COALESCE(excluded.summary, facebook_reels.summary),
                  transcript = COALESCE(excluded.transcript, facebook_reels.transcript),
                  transcription = COALESCE(excluded.transcription, facebook_reels.transcription),
                  raw_row_json = COALESCE(excluded.raw_row_json, facebook_reels.raw_row_json),
                  upload_date = COALESCE(excluded.upload_date, facebook_reels.upload_date),
                  thumbnail_url = COALESCE(excluded.thumbnail_url, facebook_reels.thumbnail_url),
                  popularity_score = COALESCE(excluded.popularity_score, facebook_reels.popularity_score),
                  source_page_url = excluded.source_page_url,
                  updated_at = excluded.updated_at
                """,
                (reel_id, reel_url, title, summary, transcription, transcription, raw_row_json, upload_date, thumbnail_url, float(popularity_score or 0), source_page_url, now, now),
            )
            self._conn.commit()

    def count_facebook_reels(self, *, source_page_url: Optional[str] = None) -> int:
        with self._lock:
            if source_page_url:
                row = self._conn.execute("SELECT COUNT(*) AS c FROM facebook_reels WHERE source_page_url = ?", (source_page_url,)).fetchone()
            else:
                row = self._conn.execute("SELECT COUNT(*) AS c FROM facebook_reels").fetchone()
            return int(row["c"] if row else 0)

    def get_facebook_reel(self, *, reel_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT reel_id, reel_url, title, summary, transcription, raw_row_json, upload_date, thumbnail_url,
                       popularity_score, tags, admin_tags, is_hidden, source_page_url, created_at, updated_at
                FROM facebook_reels
                WHERE reel_id = ?
                LIMIT 1
                """,
                (reel_id,),
            ).fetchone()
            return self._row(row) if row else None

    def delete_facebook_reels(self, *, source_page_url: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM facebook_reels WHERE source_page_url = ?", (source_page_url,))
            self._conn.commit()

    def delete_facebook_reels_not_in(self, *, source_page_url: str, reel_ids: List[str]) -> int:
        ids = [str(reel_id or "").strip() for reel_id in reel_ids if str(reel_id or "").strip()]
        with self._lock:
            if ids:
                placeholders = ", ".join(["?"] * len(ids))
                cur = self._conn.execute(
                    f"DELETE FROM facebook_reels WHERE source_page_url = ? AND reel_id NOT IN ({placeholders})",
                    tuple([source_page_url, *ids]),
                )
            else:
                cur = self._conn.execute("DELETE FROM facebook_reels WHERE source_page_url = ?", (source_page_url,))
            self._conn.commit()
            return int(cur.rowcount or 0)

    def list_facebook_reels(
        self,
        *,
        limit: Optional[int] = 10,
        offset: int = 0,
        source_page_url: Optional[str] = None,
        include_hidden: bool = False,
    ) -> List[Dict[str, Any]]:
        params: list[Any] = []
        where_parts = []
        if source_page_url:
            where_parts.append("source_page_url = ?")
            params.append(source_page_url)
        if not include_hidden:
            where_parts.append("COALESCE(is_hidden, 0) = 0")
        where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"""
            SELECT reel_id, reel_url, title, summary, transcription, raw_row_json, upload_date, thumbnail_url,
                   popularity_score, tags, admin_tags, is_hidden, source_page_url, created_at, updated_at
            FROM facebook_reels
            {where}
            ORDER BY created_at DESC, updated_at DESC
        """
        if limit is not None:
            sql += " LIMIT ? OFFSET ?"
            params.extend([max(1, int(limit)), max(0, int(offset or 0))])
        with self._lock:
            return [self._row(row) for row in self._conn.execute(sql, tuple(params)).fetchall()]

    def get_tiktok_reel(self, *, video_id: str) -> Optional[Dict[str, Any]]:
        video_id = str(video_id or "").strip()
        if not video_id:
            return None
        with self._lock:
            row = self._conn.execute(
                """
                SELECT video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags,
                       admin_tags, is_hidden, raw_row_json, source_xlsx, source_row, created_at, updated_at
                FROM tiktok_reels
                WHERE video_id = ?
                LIMIT 1
                """,
                (video_id,),
            ).fetchone()
            return self._row(row) if row else None

    def upsert_tiktok_reel(
        self,
        *,
        video_id: str,
        video_url: str,
        thumbnail_url: Optional[str] = None,
        thumbnail_path: Optional[str] = None,
        title: Optional[str] = None,
        summary: Optional[str] = None,
        transcription: Optional[str] = None,
        tags: Optional[str] = None,
        raw_row_json: Optional[str] = None,
        source_xlsx: Optional[str] = None,
        source_row: int = 0,
    ) -> None:
        now = time.time()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO tiktok_reels (
                  video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags,
                  raw_row_json, source_xlsx, source_row, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                  video_url = excluded.video_url,
                  thumbnail_url = COALESCE(excluded.thumbnail_url, tiktok_reels.thumbnail_url),
                  thumbnail_path = COALESCE(excluded.thumbnail_path, tiktok_reels.thumbnail_path),
                  title = COALESCE(excluded.title, tiktok_reels.title),
                  summary = COALESCE(excluded.summary, tiktok_reels.summary),
                  transcription = COALESCE(excluded.transcription, tiktok_reels.transcription),
                  tags = COALESCE(excluded.tags, tiktok_reels.tags),
                  raw_row_json = COALESCE(excluded.raw_row_json, tiktok_reels.raw_row_json),
                  source_xlsx = COALESCE(excluded.source_xlsx, tiktok_reels.source_xlsx),
                  source_row = excluded.source_row,
                  updated_at = excluded.updated_at
                """,
                (
                    video_id,
                    video_url,
                    thumbnail_url,
                    thumbnail_path,
                    title,
                    summary,
                    transcription,
                    tags,
                    raw_row_json,
                    source_xlsx,
                    int(source_row or 0),
                    now,
                    now,
                ),
            )
            self._conn.commit()

    def list_tiktok_reels(self, *, limit: Optional[int] = 10, offset: int = 0, include_hidden: bool = False) -> List[Dict[str, Any]]:
        offset = max(0, int(offset or 0))
        params: list[Any] = []
        where = "" if include_hidden else "WHERE COALESCE(is_hidden, 0) = 0"
        sql = f"""
            SELECT video_id, video_url, thumbnail_url, thumbnail_path, title, summary, transcription, tags,
                   admin_tags, is_hidden, raw_row_json, source_xlsx, source_row, created_at, updated_at
            FROM tiktok_reels
            {where}
            ORDER BY source_row ASC, updated_at DESC
        """
        if limit is not None:
            sql += " LIMIT ? OFFSET ?"
            params.extend([max(1, int(limit)), offset])
        with self._lock:
            return [self._row(row) for row in self._conn.execute(sql, tuple(params)).fetchall()]

    def update_facebook_reel_tags(self, *, reel_id: str, tags: str) -> None:
        with self._lock:
            self._conn.execute("UPDATE facebook_reels SET admin_tags = ?, updated_at = ? WHERE reel_id = ?", (tags, time.time(), reel_id))
            self._conn.commit()

    def update_tiktok_reel_tags(self, *, video_id: str, tags: str) -> None:
        with self._lock:
            self._conn.execute("UPDATE tiktok_reels SET admin_tags = ?, updated_at = ? WHERE video_id = ?", (tags, time.time(), video_id))
            self._conn.commit()

    def update_facebook_reel_visibility(self, *, reel_id: str, hidden: bool) -> None:
        with self._lock:
            self._conn.execute("UPDATE facebook_reels SET is_hidden = ?, updated_at = ? WHERE reel_id = ?", (1 if hidden else 0, time.time(), reel_id))
            self._conn.commit()

    def update_tiktok_reel_visibility(self, *, video_id: str, hidden: bool) -> None:
        with self._lock:
            self._conn.execute("UPDATE tiktok_reels SET is_hidden = ?, updated_at = ? WHERE video_id = ?", (1 if hidden else 0, time.time(), video_id))
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def create_storage(settings: Any) -> ReelStorage:
    if not settings.mysql_database or not settings.mysql_user:
        return SQLiteStorage()
    return MySQLStorage(
        host=settings.mysql_host,
        port=settings.mysql_port,
        database=settings.mysql_database,
        user=settings.mysql_user,
        password=settings.mysql_password,
        connect_timeout_seconds=getattr(settings, "mysql_connect_timeout_seconds", 10),
    )
