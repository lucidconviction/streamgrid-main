#!/usr/bin/env python3
"""Simple HTTP server for YouTube Music artist scraping."""

import json
import os
import subprocess
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRAPER = os.path.join(SCRIPT_DIR, "music_scraper.py")

# In-memory cache
_cache = {}
_cache_time = {}
CACHE_TTL = 300  # 5 minutes

# Local storage cache keys
LOCAL_CACHE_KEY_TOP50 = "rdnutz_music_top50"
LOCAL_CACHE_KEY_TRACKS_PREFIX = "rdnutz_music_tracks_"
CACHE_TTL_LOCAL = 3600 * 24 * 7  # 7 days for localStorage-style persistence


def run_scraper(args: list[str]) -> dict:
    """Run the scraper script and return JSON results."""
    cmd = ["python3", SCRAPER] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        return {"error": str(e)}
    return {}


class MusicHandler(BaseHTTPRequestHandler):
    """HTTP handler for music API endpoints."""

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def send_json(self, data: dict, status: int = 200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        cache_key = f"{path}?{parsed.query}" if parsed.query else path
        now = time.time()

        # Check server cache
        if cache_key in _cache and (now - _cache_time.get(cache_key, 0)) < CACHE_TTL:
            return self.send_json(_cache[cache_key])

        if path == "/api/music/search":
            query = params.get("q", [""])[0]
            if not query:
                return self.send_json({"error": "Missing query parameter 'q'"}, 400)
            results = run_scraper(["search", query])
            _cache[cache_key] = results
            _cache_time[cache_key] = now
            return self.send_json(results)

        elif path == "/api/music/popular":
            results = run_scraper(["popular"])
            _cache[cache_key] = results
            _cache_time[cache_key] = now
            return self.send_json(results)

        elif path.startswith("/api/music/artist/"):
            artist_name = path[len("/api/music/artist/"):]
            if not artist_name:
                return self.send_json({"error": "Missing artist name"}, 400)
            info = run_scraper(["info", artist_name])
            _cache[cache_key] = info
            _cache_time[cache_key] = now
            return self.send_json(info)

        elif path.startswith("/api/music/tracks/"):
            artist_name = path[len("/api/music/tracks/"):]
            if not artist_name:
                return self.send_json({"error": "Missing artist name"}, 400)
            result = run_scraper(["tracks", artist_name])
            _cache[cache_key] = result
            _cache_time[cache_key] = now
            return self.send_json(result)

        else:
            return self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return self.send_json({"error": "Invalid JSON"}, 400)

        if path == "/api/music/search":
            query = data.get("q", "")
            if not query:
                return self.send_json({"error": "Missing query parameter 'q'"}, 400)
            results = run_scraper(["search", query])
            return self.send_json(results)

        elif path == "/api/music/popular":
            results = run_scraper(["popular"])
            return self.send_json(results)

        elif path.startswith("/api/music/artist/"):
            artist_name = path[len("/api/music/artist/"):]
            if not artist_name:
                return self.send_json({"error": "Missing artist name"}, 400)
            info = run_scraper(["info", artist_name])
            return self.send_json(info)

        elif path.startswith("/api/music/tracks/"):
            artist_name = path[len("/api/music/tracks/"):]
            if not artist_name:
                return self.send_json({"error": "Missing artist name"}, 400)
            result = run_scraper(["tracks", artist_name])
            return self.send_json(result)

        else:
            return self.send_json({"error": "Not found"}, 404)


def run_server(port: int = 8765):
    """Run the HTTP server."""
    server = HTTPServer(("0.0.0.0", port), MusicHandler)
    print(f"Music scraper server running on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    run_server(port)
