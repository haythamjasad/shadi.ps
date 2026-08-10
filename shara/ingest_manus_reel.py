#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json

from services.reel_pipeline import ingest_manus_reel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest one Facebook reel using Manus, AssemblyAI, and Claude.")
    parser.add_argument("--page-url", required=True, help="Reels or profile URL to ingest from.")
    parser.add_argument(
        "--platform",
        default="auto",
        choices=["auto", "facebook", "tiktok"],
        help="Platform to scrape (auto-detect by URL by default).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    print("[CLI] Starting Manus ingest", flush=True)
    result = ingest_manus_reel(reel_url=args.page_url, platform=args.platform)
    print("[CLI] Done", flush=True)
    print(json.dumps(result, ensure_ascii=False, indent=2))
