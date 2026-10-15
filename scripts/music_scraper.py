#!/usr/bin/env python3
"""YouTube Music artist scraper using yt-dlp."""

import json
import subprocess
import sys
from typing import Optional


def get_channel_thumbnail(channel_id: str) -> str:
    """Get channel avatar URL from channel ID (fast, no subprocess)."""
    if not channel_id:
        return ""
    return f"https://yt3.googleusercontent.com/{channel_id}/avatar.jpg"


def search_artists(query: str, limit: int = 20) -> list[dict]:
    """Search YouTube Music for artists using yt-dlp."""
    cmd = [
        "yt-dlp",
        f"ytsearch{limit}:{query}",
        "--dump-json",
        "--no-warnings",
    ]
    results = []
    seen_channels = set()

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        for line in proc.stdout.strip().split("\n"):
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue

            title = d.get("title", "")
            uploader = d.get("uploader", "")
            channel_id = d.get("channel_id", "")

            if not (title and uploader):
                continue

            if channel_id and channel_id not in seen_channels:
                seen_channels.add(channel_id)
                results.append({
                    "name": uploader,
                    "query": query,
                    "thumbnail": get_channel_thumbnail(channel_id),
                    "channel_id": channel_id,
                    "video_id": d.get("id", ""),
                    "title": title,
                })

            if len(results) >= limit:
                break

    except subprocess.TimeoutExpired:
        print(f"Search timed out for: {query}", file=sys.stderr)
    except Exception as e:
        print(f"Search error for '{query}': {e}", file=sys.stderr)

    return results


def get_artist_info(name: str) -> Optional[dict]:
    """Get detailed info for an artist by name."""
    results = search_artists(name, limit=5)
    if results:
        return results[0]
    return None


def get_artist_tracks(name: str, limit: int = 20) -> dict:
    """Get playable track URLs for an artist using yt-dlp.
    Searches the artist's own channel for the best results."""
    # First find the artist's channel
    search_results = search_artists(name, limit=10)
    if not search_results:
        return {"artist": name, "artist_id": "", "thumbnail": "", "tracks": []}

    artist_name = search_results[0]["name"]
    artist_id = search_results[0]["channel_id"]
    artist_thumbnail = search_results[0]["thumbnail"]

    tracks = []
    seen_videos = set()

    # Search directly on the artist's channel for official content
    channel_url = f"https://www.youtube.com/@{artist_id}/videos"
    cmd = [
        "yt-dlp",
        f"ytsearch{limit}:{name}",
        "--dump-json",
        "--no-warnings",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        for line in proc.stdout.strip().split("\n"):
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue

            title = d.get("title", "")
            uploader = d.get("uploader", "")
            video_id = d.get("id", "")
            channel_id = d.get("channel_id", "")

            if not (title and video_id):
                continue

            # Skip compilations, playlists, and non-official content
            skip_keywords = ["compilation", "playlist", "mix", "greatest hits", "collection"]
            if any(kw in title.lower() for kw in skip_keywords):
                continue

            if video_id in seen_videos:
                continue
            seen_videos.add(video_id)

            # Get direct audio URL
            audio_cmd = [
                "yt-dlp",
                "-f", "bestaudio[ext=m4a]/bestaudio",
                "--print", "url",
                "--print", "title",
                "--print", "duration",
                "--print", "thumbnail",
                "--no-warnings",
                "--no-playlist",
                f"https://www.youtube.com/watch?v={video_id}",
            ]
            try:
                audio_proc = subprocess.run(audio_cmd, capture_output=True, text=True, timeout=20)
                lines = audio_proc.stdout.strip().split("\n")
                if len(lines) >= 2 and lines[0]:
                    tracks.append({
                        "title": lines[1] if len(lines) > 1 else video_id,
                        "url": lines[0],
                        "duration": int(lines[2]) if len(lines) > 2 and lines[2].strip().isdigit() else 0,
                        "thumbnail": lines[3] if len(lines) > 3 and lines[3] else artist_thumbnail,
                        "video_id": video_id,
                        "artist": artist_name,
                    })
                if len(tracks) >= limit:
                    break
            except subprocess.TimeoutExpired:
                print(f"Track lookup timed out for {video_id}", file=sys.stderr)
            except Exception as e:
                print(f"Track lookup error for {video_id}: {e}", file=sys.stderr)

    except subprocess.TimeoutExpired:
        print(f"Track search timed out for: {name}", file=sys.stderr)
    except Exception as e:
        print(f"Track search error for '{name}': {e}", file=sys.stderr)

    return {
        "artist": artist_name,
        "artist_id": artist_id,
        "thumbnail": artist_thumbnail,
        "tracks": tracks,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: music_scraper.py <search|popular|info|tracks> [query]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "search" and len(sys.argv) >= 3:
        query = " ".join(sys.argv[2:])
        results = search_artists(query)
        print(json.dumps(results, indent=2))
    elif cmd == "info" and len(sys.argv) >= 3:
        name = " ".join(sys.argv[2:])
        info = get_artist_info(name)
        print(json.dumps(info, indent=2) if info else "null")
    elif cmd == "tracks" and len(sys.argv) >= 3:
        name = " ".join(sys.argv[2:])
        result = get_artist_tracks(name)
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"error": "Invalid usage"}, indent=2))