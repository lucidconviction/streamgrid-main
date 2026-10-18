#!/usr/bin/env python3
"""Music server — ytmusicapi backend with albums, tracks, and YouTube iframe support."""

import json
import os
import subprocess
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRAPER = os.path.join(SCRIPT_DIR, "music_scraper.py")
JAVA_SEARCH_JAR = os.path.join(SCRIPT_DIR, "java_music_search", "build", "libs", "java-music-search-1.0.jar")
JAVA_HOME_PATH = "/usr/local/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home"
VENV_PY = os.path.join(SCRIPT_DIR, "..", ".venv", "bin", "python3")
PY = VENV_PY if os.path.exists(VENV_PY) else sys.executable

_cache = {}
_cache_time = {}
CACHE_TTL = 600  # 10 minutes


def run(args: list[str], timeout: int = 60) -> dict:
    try:
        r = subprocess.run([PY, SCRAPER] + args, capture_output=True, text=True, timeout=timeout)
        if r.returncode == 0 and r.stdout.strip():
            return json.loads(r.stdout)
    except Exception as e:
        return {"error": str(e)}
    return {}


def java_search(query: str, limit: int = 10) -> list[dict]:
    try:
        r = subprocess.run(
            [f"{JAVA_HOME_PATH}/bin/java", "-jar", JAVA_SEARCH_JAR, "search", query, str(limit)],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode == 0 and r.stdout.strip():
            d = json.loads(r.stdout)
            return d.get("artists", [])
    except Exception as e:
        print(f"Java error: {e}", file=sys.stderr)
    return []


def java_top100(limit: int = 100) -> list[dict]:
    try:
        r = subprocess.run(
            [f"{JAVA_HOME_PATH}/bin/java", "-jar", JAVA_SEARCH_JAR, "top100", "", str(limit)],
            capture_output=True, text=True, timeout=60
        )
        if r.returncode == 0 and r.stdout.strip():
            d = json.loads(r.stdout)
            return d.get("artists", [])
    except Exception as e:
        print(f"Java top100 error: {e}", file=sys.stderr)
    return []


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        key = f"{path}?{parsed.query}" if parsed.query else path
        now = time.time()

        if key in _cache and now - _cache_time.get(key, 0) < CACHE_TTL:
            return self.send_json(_cache[key])

        if path == "/api/music/search":
            q = params.get("q", [""])[0]
            if not q:
                return self.send_json({"error": "missing q"}, 400)
            r = java_search(q)
            if not r:
                r = run(["search", q], timeout=60)
            _cache[key] = r; _cache_time[key] = now
            return self.send_json(r)

        elif path == "/api/music/top":
            r = java_top100()
            if not r:
                r = run(["search", "top artists"])[:100]
            _cache[key] = {"artists": r}; _cache_time[key] = now
            return self.send_json({"artists": r})

        elif path == "/api/music/full":
            name = params.get("name", [""])[0]
            limit = int(params.get("limit", ["30"])[0])
            if not name:
                return self.send_json({"error": "missing name"}, 400)
            r = run(["full", name, str(limit)], timeout=90)
            _cache[key] = r; _cache_time[key] = now
            return self.send_json(r)

        elif path == "/api/music/artist-info":
            name = params.get("name", [""])[0]
            if not name:
                return self.send_json({"error": "missing name"}, 400)
            r = run(["search", name])[:1]
            _cache[key] = r[0] if r else {}; _cache_time[key] = now
            return self.send_json(r[0] if r else {})

        elif path == "/api/music/playlist-tracks":
            pid = params.get("id", [""])[0]
            if not pid:
                return self.send_json({"error": "missing id"}, 400)
            r = run(["playlist", pid], timeout=90)
            _cache[key] = r; _cache_time[key] = now
            return self.send_json(r)

        elif path == "/api/music/radio":
            cid = params.get("channel_id", [""])[0]
            limit = int(params.get("limit", ["50"])[0])
            if not cid:
                return self.send_json({"error": "missing channel_id"}, 400)
            r = run(["radio", cid, str(limit)], timeout=90)
            _cache[key] = r; _cache_time[key] = now
            return self.send_json({"tracks": r})

        elif path == "/api/music/popular":
            limit = int(params.get("limit", ["30"])[0])
            r = run(["popular", str(limit)], timeout=90)
            _cache[key] = r; _cache_time[key] = now
            return self.send_json({"tracks": r})

        else:
            return self.send_json({"error": "not found"}, 404)


def run_server(port: int = 8765):
    server = HTTPServer(("0.0.0.0", port), H)
    print(f"Music server on http://0.0.0.0:{port}")
    print("  GET /api/music/search?q=...")
    print("  GET /api/music/full?name=...&limit=30  ← tracks + albums + singles + related")
    print("  GET /api/music/playlist-tracks?id=...  ← tracks from an album playlist")
    server.serve_forever()


if __name__ == "__main__":
    run_server(int(os.environ.get("PORT", 8765)))
