#!/usr/bin/env python3
"""FX public receipts scraper.

Pulls oEmbed for public x.com / twitter.com status URLs and writes JSON
the site can ingest. No login. No cookies. No engagement automation.

Usage:
  python scraper/fx_receipts.py https://x.com/user/status/123
  python scraper/fx_receipts.py --file scraper/urls.txt --out scraper/out/receipts.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

OEMBED = "https://publish.twitter.com/oembed"
STATUS_RE = re.compile(
    r"^https://(www\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/status/\d+",
    re.I,
)
HANDLE_RE = re.compile(r"https://(www\.)?(x|twitter)\.com/([A-Za-z0-9_]{1,15})/", re.I)


def normalize(url: str) -> str:
    url = url.strip()
    if not url or url.startswith("#"):
        return ""
    parsed = urlparse(url)
    host = parsed.netloc.lower().replace("www.", "")
    if host == "twitter.com":
        host = "x.com"
    if host != "x.com":
        return ""
    clean = f"https://x.com{parsed.path}".rstrip("/")
    return clean if STATUS_RE.match(clean) else ""


def oembed(url: str) -> dict:
    res = requests.get(
        OEMBED,
        params={"url": url, "omit_script": "true", "dnt": "true"},
        timeout=20,
        headers={"User-Agent": "fx.nyptid.com receipts/1.0"},
    )
    res.raise_for_status()
    data = res.json()
    handle_match = HANDLE_RE.search(data.get("author_url") or url)
    handle = handle_match.group(3) if handle_match else ""
    html = data.get("html") or ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return {
        "url": url,
        "handle": handle,
        "author": data.get("author_name") or handle,
        "author_url": data.get("author_url") or (f"https://x.com/{handle}" if handle else ""),
        "html": html,
        "text": text,
        "provider": data.get("provider_name") or "X",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def load_urls(args: argparse.Namespace) -> list[str]:
    urls = [normalize(u) for u in args.urls]
    if args.file:
        for line in Path(args.file).read_text(encoding="utf-8").splitlines():
            urls.append(normalize(line))
    seen = set()
    out = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            out.append(url)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape public X post receipts via oEmbed.")
    parser.add_argument("urls", nargs="*", help="x.com status URLs")
    parser.add_argument("--file", help="Text file, one URL per line")
    parser.add_argument("--out", default="scraper/out/receipts.json")
    args = parser.parse_args()

    urls = load_urls(args)
    if not urls:
        print("No valid x.com/status URLs.", file=sys.stderr)
        return 1

    receipts = []
    errors = []
    for url in urls:
        try:
            receipts.append(oembed(url))
            print(f"ok  {url}")
        except Exception as exc:  # noqa: BLE001 — CLI scraper, report and continue
            errors.append({"url": url, "error": str(exc)})
            print(f"err {url}  {exc}", file=sys.stderr)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "fx.nyptid.com scraper",
        "count": len(receipts),
        "receipts": receipts,
        "errors": errors,
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {out_path} ({len(receipts)} receipts, {len(errors)} errors)")
    return 0 if receipts else 2


if __name__ == "__main__":
    raise SystemExit(main())
