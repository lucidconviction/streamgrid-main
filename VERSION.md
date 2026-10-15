# RdNutz TV Streams — Version History

## v1.0.0 — 2026-10-15

### Brand & Identity
- Rebranded to **"RdNutz TV Streams"** with yellow/orange/slate wordmark
- Logo on left of header with fallback icon
- Sidebar persistent with hamburger toggle; scrolls correctly
- No search in header (only sidebar)
- Anime tab removed from nav, App.tsx view routing, and index.html meta description

### Streaming & Playback
- **Bintv streams fixed** — rewrote proxy plugin to use native `fetch()` instead of Node `https` module (was getting 403 from Cloudflare bot protection)
- All stream sources pulled from APIs: bintvjson (Live Events, Upcoming Events, 24/7 Channels), streamed.pk (matches/all), and IPTV (3 M3U playlists)
- **Screenshots as thumbnails** — `getPlaceholderThumbnail()` generates deterministic gradient SVGs for streams without posters
- Fallback player service (VidFast, P-Stream, MoviesAPI)
- VideoPlayer auto-advance on error; Sources/Mirrors buttons in PlayerView toolbar
- MoviesDirectory uses its own inline iframe player with fallback mirror toolbar
- Cache TTL 5min; poll interval 120s
- Continuous loading bug fixed (stable IDs via `stableId()` helper)
- Background video plays immediately (preload auto, aggressive buffer, low latency)
- Brighter fonts and buttons across body — especially row titles, tabs, and buttons
- Thumbnails bigger on home screen

### Music
- **Music tab redesigned** — artistgrid.cx style grid with 3:4 aspect ratio cards
- **Top 50 Artists** — loads via YouTube Music API, cached in localStorage (5-min TTL)
- **Full-length track playback** — yt-dlp backend (`/api/music/tracks/{artist}`) extracts direct audio URLs from YouTube
- **Floating Music Player** — persists across all views, expands to full modal, plays full tracks (not just 30s previews)
- **Track caching** — artist tracks cached in localStorage with 7-day TTL
- Music search fixed — YouTube Music API parser handles `tabbedSearchResultsRenderer` structure
- Music thumbnails display real working images from YouTube CDN
- Deezer chart API used for Top 50 Artists fallback
- YouTube Music search with artist filter param `EgMQARoCAlE%3D`
- Profile button moved up under nav in sidebar (before Quick Jump)

### UI/UX
- Sidebar scroll prevention — body overflow hidden when sidebar overlay open on mobile
- All directory tabs brightened and sized up
- Toast notifications for user feedback
- FloatingPipPlayer for video — persists when main player closes
- FloatingMusicPlayer for music — same pattern, persists across navigation

### Backend
- yt-dlp (v2026.07.04) installed at `/opt/homebrew/bin/yt-dlp`
- Python music server on port 8765 (`scripts/music_server.py`, `scripts/music_scraper.py`)
- Vite proxy configured for `/api/ytmusic` and `/api/deezer`
- Bintv proxy plugin rewritten for better Cloudflare compatibility
- Dev server on port 3001 (`host: '0.0.0.0'`)

### Key Files
- `src/components/MusicDirectory.tsx` — Music tab with artist grid, search, floating player integration
- `src/components/FloatingMusicPlayer.tsx` — Persistent mini player + expanded modal
- `src/services/musicService.ts` — YouTube Music API + yt-dlp backend + localStorage caching
- `src/services/streamService.ts` — Stream aggregation from all APIs
- `vite.plugins.ts` — Bintv proxy (rewritten)
- `scripts/music_scraper.py` — yt-dlp artist/track scraping
- `scripts/music_server.py` — HTTP server for music API
- `index.html` — Title and meta tags