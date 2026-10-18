#!/usr/bin/env python3
"""YouTube Music artist scraper — ytmusicapi for metadata, albums, singles."""

import json
import sys
from typing import Optional

try:
    from ytmusicapi import YTMusic
    _YTM = YTMusic()
    _READY = True
except ImportError:
    _YTM = None
    _READY = False


def _ok(fn, *args, **kwargs):
    if not _READY:
        return None
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        print(f"ytmusicapi error: {e}", file=sys.stderr)
        return None


# ── Thumbnail HD upgrader ─────────────────────────────────────────────────────

def hd(url: str, size: int = 1000) -> str:
    """Upgrade a YouTube thumbnail URL to high resolution."""
    import re
    if not url or '=' not in url:
        return url
    # Match patterns like =w120-h120-l90-rj or =w60-h60-l90-rj
    return re.sub(r'=w\d+-h\d+', f'=w{size}-h{size}', url)


def hi(url: str) -> str:
    """Alias: return HD version."""
    return hd(url)


# ── Artist search ─────────────────────────────────────────────────────────────

def search_artists(query: str, limit: int = 20) -> list[dict]:
    results = _ok(_YTM.search, query, limit=limit * 2, filter="artists")
    if not results:
        return []
    out = []
    seen = set()
    for r in results:
        if r.get("resultType") != "artist":
            continue
        name = r.get("artist") or r.get("name", "")
        cid = r.get("browseId", "")
        if not name or not cid or cid in seen:
            continue
        seen.add(cid)
        thumbs = r.get("thumbnails", [])
        out.append({
            "name": name,
            "channel_id": cid,
            "thumbnail": hi(thumbs[-1].get("url", "")) if thumbs else "",
        })
        if len(out) >= limit:
            break
    return out


# ── Music video finder ────────────────────────────────────────────────────────

def find_music_video(artist: str, title: str, channel_id: str = '') -> str:
    """Try to find the official music video for a track."""
    if not _READY or not title:
        return ''
    try:
        # 1. "official music video"
        results = _ok(_YTM.search, f'{title} {artist} official music video', limit=5, filter='videos')
        if results:
            for r in results:
                vid = r.get('videoId') or r.get('browseId', '')
                if vid and ':' not in vid:
                    return vid
        # 2. "music video" (broader)
        results = _ok(_YTM.search, f'{title} {artist} music video', limit=5, filter='videos')
        if results:
            for r in results:
                vid = r.get('videoId') or r.get('browseId', '')
                if vid and ':' not in vid:
                    return vid
        # 3. Channel-scoped search — forces results from the artist's own channel
        if channel_id:
            results = _ok(_YTM.search, title, limit=8, filter='videos', channel_id=channel_id)
            if results:
                for r in results:
                    vid = r.get('videoId') or r.get('browseId', '')
                    if vid and ':' not in vid:
                        return vid
        # 4. Just title + "MV"
        results = _ok(_YTM.search, f'{title} {artist} MV', limit=5, filter='videos')
        if results:
            for r in results:
                vid = r.get('videoId') or r.get('browseId', '')
                if vid and ':' not in vid:
                    return vid
    except Exception as e:
        print(f"MV search error for '{title}': {e}", file=sys.stderr)
    return ''


# ── Full artist data (tracks + albums + singles) ─────────────────────────────

def get_full_artist(name: str, track_limit: int = 30) -> dict:
    """Get complete artist page: top songs, albums, singles, videos."""
    # 1. Find artist
    results = search_artists(name, limit=3)
    if not results:
        return {"artist": name, "error": "artist_not_found"}

    artist_name = results[0]["name"]
    channel_id = results[0]["channel_id"]
    artist_thumb = results[0]["thumbnail"]

    # 2. Get full artist page
    page = _ok(_YTM.get_artist, channel_id)
    if not page:
        return {"artist": artist_name, "error": "no_page"}

    thumbs = page.get("thumbnails") or []
    artist_thumb = hi(thumbs[-1].get("url", "")) if thumbs else ""

    # ── Top songs (prefer music videos) ──
    raw_songs = (page.get("songs") or {}).get("results", [])
    tracks = []
    seen_vids = set()
    for s in raw_songs:
        vid = s.get("videoId")
        if not vid or vid in seen_vids:
            continue
        seen_vids.add(vid)
        dur = s.get("duration_seconds") or _parse_dur(s.get("duration", ""))
        thumb = hi(s.get("thumbnails", [{}])[-1].get("url", ""))
        song_title = s.get("title", "")
        # Try to find the official music video version
        mv_id = find_music_video(artist_name, song_title, channel_id)
        final_vid = mv_id or vid
        tracks.append({
            "title": song_title,
            "video_id": final_vid,
            "duration": dur,
            "thumbnail": thumb,
            "artist": artist_name,
            "album": (s.get("album") or {}).get("name", "") if s.get("album") else "",
            "isExplicit": s.get("isExplicit", False),
            "views": s.get("views", ""),
        })
        if len(tracks) >= track_limit:
            break

    # ── Albums ──
    raw_albums = (page.get("albums") or {}).get("results", [])
    albums = []
    for a in raw_albums[:12]:
        thumbs = a.get("thumbnails", [])
        albums.append({
            "title": a.get("title", ""),
            "year": a.get("year", ""),
            "playlist_id": a.get("audioPlaylistId", ""),
            "browse_id": a.get("browseId", ""),
            "thumbnail": hi(thumbs[-1].get("url", "")) if thumbs else "",
        })

    # ── Singles ──
    raw_singles = (page.get("singles") or {}).get("results", [])
    singles = []
    for s in raw_singles[:12]:
        thumbs = s.get("thumbnails", [])
        singles.append({
            "title": s.get("title", ""),
            "year": s.get("year", ""),
            "playlist_id": s.get("audioPlaylistId", ""),
            "browse_id": s.get("browseId", ""),
            "thumbnail": hi(thumbs[-1].get("url", "")) if thumbs else "",
        })

    # ── Related artists ──
    raw_related = (page.get("related") or {}).get("results", [])
    related = []
    for r in raw_related[:10]:
        if not r:
            continue
        related.append({
            "name": r.get("name") or r.get("title", ""),
            "channel_id": r.get("browseId", ""),
            "thumbnail": hi(r.get("thumbnails", [{}])[-1].get("url", "")) if r.get("thumbnails") else "",
        })

    return {
        "artist": artist_name,
        "channel_id": channel_id,
        "thumbnail": artist_thumb,
        "subscribers": page.get("subscribers", ""),
        "monthly_listeners": page.get("monthlyListeners", ""),
        "description": (page.get("descriptionRuns") or [{}])[0].get("text", "")[:200] if page.get("descriptionRuns") else "",
        "tracks": tracks,
        "albums": albums,
        "singles": singles,
        "related": related,
    }


def _parse_dur(s: str) -> int:
    if not s:
        return 0
    try:
        if ":" in s:
            p = s.split(":")
            return int(p[0]) * 60 + int(p[1])
        return int(s)
    except (ValueError, IndexError):
        return 0


# ── Album/playlist tracks ────────────────────────────────────────────────────

def get_playlist_tracks(playlist_id: str) -> dict:
    """Get all tracks from an album/singles playlist."""
    try:
        pl = _YTM.get_playlist(playlist_id)
        tracks = []
        seen = set()
        for t in pl.get("tracks", []):
            vid = t.get("videoId")
            if not vid or vid in seen:
                continue
            seen.add(vid)
            dur = t.get("duration_seconds") or _parse_dur(t.get("duration", ""))
            artist_name = (t.get("artists") or [{}])[0].get("name", "") if t.get("artists") else ""
            album_name = (t.get("album") or {}).get("name", "") if t.get("album") else ""
            mv_id = find_music_video(artist_name, t.get("title", ""))
            final_vid = mv_id or vid
            tracks.append({
                "title": t.get("title", ""),
                "video_id": final_vid,
                "duration": dur,
                "thumbnail": hi(t.get("thumbnails", [{}])[-1].get("url", "")),
                "artist": artist_name,
                "album": album_name,
                "isExplicit": t.get("isExplicit", False),
            })
            if len(tracks) >= 50:
                break
        thumbs = pl.get("thumbnails") or []
        return {
            "title": pl.get("title", ""),
            "year": pl.get("year", ""),
            "thumbnail": hi(thumbs[-1].get("url", "")) if thumbs else "",
            "tracks": tracks,
        }
    except Exception as e:
        print(f"Playlist error: {e}", file=sys.stderr)
        return {"error": str(e)}


# ── Radio / auto-mix ───────────────────────────────────────────────────────────

def get_radio_tracks(channel_id: str, limit: int = 50) -> list[dict]:
    """Get similar tracks from related artists for auto-mix/radio mode."""
    if not channel_id or not _READY:
        return []
    try:
        page = _ok(_YTM.get_artist, channel_id)
        if not page:
            return []
        raw_related = (page.get("related") or {}).get("results", [])
        if not raw_related:
            return []
        seen_vids = set()
        tracks = []
        for rel in raw_related[:8]:
            rel_name = rel.get("name") or rel.get("title", "")
            rel_channel = rel.get("browseId", "")
            if not rel_channel:
                continue
            rel_page = _ok(_YTM.get_artist, rel_channel)
            if not rel_page:
                continue
            for s in (rel_page.get("songs") or {}).get("results", [])[:5]:
                vid = s.get("videoId")
                if not vid or vid in seen_vids:
                    continue
                seen_vids.add(vid)
                dur = s.get("duration_seconds") or _parse_dur(s.get("duration", ""))
                thumb = hi(s.get("thumbnails", [{}])[-1].get("url", ""))
                song_title = s.get("title", "")
                # Try to find the official music video version
                mv_id = find_music_video(rel_name, song_title, rel_channel)
                final_vid = mv_id or vid
                tracks.append({
                    "title": song_title,
                    "video_id": final_vid,
                    "duration": dur,
                    "thumbnail": thumb,
                    "artist": rel_name,
                })
                if len(tracks) >= limit:
                    return tracks
        return tracks
    except Exception as e:
        print(f"Radio error: {e}", file=sys.stderr)
        return []


def get_popular_tracks(limit: int = 30) -> list[dict]:
    """Get popular tracks from top-searched artists."""
    queries = [
        "Taylor Swift", "Bad Bunny", "Drake", "The Weeknd", "Ariana Grande",
        "Billie Eilish", "Post Malone", "Dua Lipa", "Ed Sheeran", "Kendrick Lamar",
        "Beyoncé", "Harry Styles", "Olivia Rodrigo", "Travis Scott", "SZA",
        "Morgan Wallen", "Zach Bryan", "Sabrina Carpenter", "Chappell Roan",
    ]
    seen_vids = set()
    tracks = []
    for q in queries:
        results = search_artists(q, 1)
        if not results:
            continue
        ch = results[0].get("channel_id", "")
        if not ch:
            continue
        page = _ok(_YTM.get_artist, ch)
        if not page:
            continue
        for s in (page.get("songs") or {}).get("results", [])[:2]:
            vid = s.get("videoId")
            if not vid or vid in seen_vids:
                continue
            seen_vids.add(vid)
            dur = s.get("duration_seconds") or _parse_dur(s.get("duration", ""))
            thumb = hi(s.get("thumbnails", [{}])[-1].get("url", ""))
            song_title = s.get("title", "")
            # Try to find the official music video version
            mv_id = find_music_video(results[0].get("name", ""), song_title, ch)
            final_vid = mv_id or vid
            tracks.append({
                "title": song_title,
                "video_id": final_vid,
                "duration": dur,
                "thumbnail": thumb,
                "artist": results[0].get("name", ""),
            })
            if len(tracks) >= limit:
                return tracks
    return tracks


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: music_scraper.py <search|full|playlist|radio|popular> [args]"}, indent=2))
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "search" and len(sys.argv) >= 3:
        print(json.dumps(search_artists(" ".join(sys.argv[2:]), limit=20), indent=2))
    elif cmd == "full" and len(sys.argv) >= 3:
        name = " ".join(sys.argv[2:])
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        print(json.dumps(get_full_artist(name, limit), indent=2))
    elif cmd == "playlist" and len(sys.argv) >= 3:
        pid = sys.argv[2]
        print(json.dumps(get_playlist_tracks(pid), indent=2))
    elif cmd == "radio" and len(sys.argv) >= 3:
        cid = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 50
        print(json.dumps(get_radio_tracks(cid, limit), indent=2))
    elif cmd == "popular":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        print(json.dumps(get_popular_tracks(limit), indent=2))
    else:
        print(json.dumps({"error": "Invalid usage"}, indent=2))
