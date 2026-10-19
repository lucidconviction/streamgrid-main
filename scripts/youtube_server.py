#!/usr/bin/env python3
"""YouTube Stream Hub backend — wraps NewPipeExtractor Java CLI."""

import json
import os
import subprocess
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JAVA_EXTRACTOR_JAR = os.path.join(SCRIPT_DIR, "java_youtube", "build", "libs", "java-youtube-extractor-1.0.jar")
JAVA_HOME_PATH = "/usr/local/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home"

_cache = {}
_cache_time = {}
CACHE_TTL = 120  # 2 minutes


def run_java(args: list[str], timeout: int = 30) -> dict:
    try:
        r = subprocess.run(
            [f"{JAVA_HOME_PATH}/bin/java", "-jar", JAVA_EXTRACTOR_JAR] + args,
            capture_output=True, text=True, timeout=timeout
        )
        if r.returncode == 0 and r.stdout.strip():
            d = json.loads(r.stdout)
            if "error" in d:
                return {"error": d["error"]}
            return d
        return {"error": r.stderr or "Java process failed"}
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    except Exception as e:
        return {"error": str(e)}


def _normalize_items(d: dict) -> dict:
    """Normalize a response that uses `results` (search) to the `items` shape used elsewhere."""
    if not isinstance(d, dict) or "error" in d:
        return d
    if "items" not in d and "results" in d:
        d["items"] = d.pop("results")
    return d


def run_java_or_fallback(args: list[str], fallback_args: list[str],
                          timeout: int = 30) -> dict:
    """Run the Java CLI; if it fails, try a fallback command."""
    result = run_java(args, timeout=timeout)
    if "error" in result and fallback_args:
        return run_java(fallback_args, timeout=timeout)
    return result


def cached(key: str, factory):
    now = time.time()
    if key in _cache and now - _cache_time[key] < CACHE_TTL:
        return _cache[key]
    result = factory()
    _cache[key] = result
    _cache_time[key] = now
    return result


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress logs

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/youtube/stream":
            q = parse_qs(parsed.query)
            video_id = q.get("id", [None])[0]
            if not video_id:
                self._send_json({"error": "missing id"}, 400)
                return
            self._send_json(cached(f"stream:{video_id}", lambda: run_java(["stream", video_id])))
        elif parsed.path == "/api/youtube/channel":
            q = parse_qs(parsed.query)
            channel_id = q.get("id", [None])[0]
            if not channel_id:
                self._send_json({"error": "missing id"}, 400)
                return
            self._send_json(cached(f"channel:{channel_id}", lambda: run_java(["channel", channel_id])))
        elif parsed.path == "/api/youtube/playlist":
            q = parse_qs(parsed.query)
            playlist_id = q.get("id", [None])[0]
            if not playlist_id:
                self._send_json({"error": "missing id"}, 400)
                return
            self._send_json(cached(f"playlist:{playlist_id}", lambda: run_java(["playlist", playlist_id])))
        elif parsed.path == "/api/youtube/search":
            q = parse_qs(parsed.query)
            query = q.get("q", [""])[0]
            limit = q.get("limit", ["10"])[0]
            if not query:
                self._send_json({"error": "missing q"}, 400)
                return
            cache_key = f"search:{query}:{limit}"
            self._send_json(cached(cache_key, lambda: run_java(["search", query, limit])))
        elif parsed.path == "/api/youtube/trending":
            self._send_json(cached("trending", lambda: _normalize_items(run_java_or_fallback(
                ["trending"], ["search", "trending", "20"], timeout=45))))
        elif parsed.path == "/api/youtube/live":
            self._send_json(cached("live", lambda: run_java(["live"])))
        elif parsed.path == "/api/youtube/comments":
            q = parse_qs(parsed.query)
            video_id = q.get("id", [None])[0]
            limit = q.get("limit", ["20"])[0]
            if not video_id:
                self._send_json({"error": "missing id"}, 400)
                return
            self._send_json(cached(f"comments:{video_id}", lambda: run_java(["comments", video_id, limit])))
        else:
            self._send_json({"error": "not found"}, 404)


if __name__ == "__main__":
    port = int(os.environ.get("YOUTUBE_API_PORT", "8766"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"YouTube API server listening on :{port}", flush=True)
    server.serve_forever()
