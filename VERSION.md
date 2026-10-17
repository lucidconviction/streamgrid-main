# RdNutz TV Streams — Version History

## v1.2.1 — 2026-10-17

### Multiview UI Redesign
- **Layout selector → dropdown** — replaced flat button row with compact dropdown (8 options: 1 Focus, 2 Dual, 3 Triple, 4 Quad, 5 Big Center, 5 Focus, 6 Wide, 6 Tall)
- **Preset selector → dropdown** — replaced horizontal scrollable buttons with dropdown menu; added "Save Current Layout" action inside dropdown
- **Removed per-slot volume buttons** from multiview header bar — only global Unmute/Mute All toggle remains
- **Removed "6 Grid" layout option** — consolidated into 6 Wide / 6 Tall

---

## v1.2.0 — 2026-10-17

### Multiview Grid Improvements
- **Dropdown menus for layouts and presets** — replaced flat button bars with collapsible dropdowns for cleaner UI
- **Removed volume controls** from multiview player slots — simplified slot control bar
- **Removed 6-grid layout** (`six` option) — layout dropdown now shows: 1 Focus, 2 Dual, 3 Triple, 4 Quad, 5 Big Center, 5 Focus, 6 Wide, 6 Tall

### Header Cleanup
- **Removed mute/unmute toggle** from HeroBanner — video stays permanently muted (background playback)
- Removed `Volume2`/`VolumeX` imports from HeroBanner
- Removed `isMuted` state and `toggleMute` callback

### IPTV Screenshot Improvements
- **More reliable HLS.js configuration** — relaxed buffer settings for better frame capture
- **Increased timeout** from 4s to 8s for screenshot capture
- **Better error handling** — added logging for failed captures, recoverable errors continue polling

---

## v1.1.0 — 2026-10-15

### Screenshot Thumbnail Caching
- **1-hour localStorage cache** for image.thum.io screenshot URLs (`rdnutz_screenshot_thumbs`)
- Cached URLs persist across page reloads, refresh after 1-hour TTL expiry
- `purgeExpiredScreenshots()` runs on mount + every 10 minutes to keep storage small
- Streams without posters now get cached live screenshots instead of blank/gradient fallback

### Nett Smutt Age Verification
- **Blurry overlay** (`backdrop-blur-3xl`) shown when opening Nett Smutt tab
- Adult content warning with explicit 18+ age verification (Yes/No buttons)
- Verification persists in sessionStorage — only asks once per browser session
- Denied users navigate away from the tab

### Nett Smutt XXX Emblem
- Replaced `Flame` icon with custom **XXX circle-cross emblem** throughout SmuttDirectory
- Used in header logo, loading state, and empty state

### Music: Top 50 Artists of the Year
- Replaced duplicate-heavy list with 50 unique curated artists of the year
- Includes: Taylor Swift, Chappell Roan, Sabrina Carpenter, Kendrick Lamar, Benson Boone, Shaboozey, Tyla, Rema, Chase Atlantic, Metro Boomin, etc.

### Stream Card UI
- **Multiview + Watch buttons made smaller** — half the previous size
- **Play button added between them** — royal blue circle with white Play icon
- Play button calls `onPlay()` → navigates to the player page for the stream
- Layout: Multiview | Play | Watch

### Bug Fixes
- Screenshot API now correctly handles proxied bintv URLs (skips local proxy URLs)
- Hero banner uses `bgVideoUrl` for autoplay when available (original stream URL, not proxied)
- All bintv, streamed, and westream streams set `bgVideoUrl` from original embed URL

---

## v1.0.0 — 2026-10-15

### Brand & Identity
- Rebranded to **"RdNutz TV Streams"** with yellow/orange/slate wordmark
- Logo on left of header with fallback icon
- Sidebar persistent with hamburger toggle; scrolls correctly
- No search in header (only sidebar)
- Anime tab removed from nav, App.tsx view routing, and index.html meta description

### Streaming & Playback
- **Bintv streams fixed** — rewrote proxy plugin to use native `fetch()` instead of Node `https` module (was getting 403 from Cloudflare bot protection)
- **Bintv URL routing** — all bintv streams now route through `/api/bintv-proxy` to bypass Cloudflare (ehgembxe.cfd returns 403 directly)
- **Westream integration** — added westream.su as new live sports source (`/matches/all` endpoint, 200+ matches)
- All stream sources pulled from APIs: bintvjson (Live Events, Upcoming Events, 24/7 Channels), streamed.pk (matches/all), westream.su (matches/all), and IPTV (3 M3M3U playlists)
- **Screenshots as thumbnails** — uses image.thum.io API to capture live screenshots of embed pages for streams without posters
- Fallback player service (VidFast, P-Stream, MoviesAPI)
- VideoPlayer auto-advance on error; Sources/Mirrors buttons in PlayerView toolbar
- MoviesDirectory uses its own inline iframe player with fallback mirror toolbar
- Cache TTL 5min; poll interval 120s
- Continuous loading bug fixed (stable IDs via `stableId()` helper)
- Background video plays immediately (preload auto, aggressive buffer, low latency)
- Brighter fonts and buttons across body — especially row titles, tabs, and buttons
- **Home screen thumbnails 30% bigger** — StreamCarousel cards: w-44→w-56, sm:w-48→sm:w-64

### Music
- **Music tab redesigned** — artistgrid.cx style grid with 3:4 aspect ratio cards
- **Top 50 Artists fixed** — runs all queries in parallel with `Promise.allSettled` (was timing out sequentially)
- **Full-length track playback** — yt-dlp backend (`/api/music/tracks/{artist}`) extracts direct audio URLs from YouTube
- **Floating Music Player** — persists across all views via sessionStorage, expands to full modal, plays full tracks (not just 30s previews)
- **Track caching** — artist tracks cached in localStorage with 7-day TTL
- Music search fixed — YouTube Music API parser handles `tabbedSearchResultsRenderer` structure
- Music thumbnails display real working images from YouTube CDN
- Deezer chart API used for Top 50 Artists fallback
- YouTube Music search with artist filter param `EgMQARoCAlE%3D`
- Profile button moved up under nav in sidebar (before Quick Jump)

### UI/UX
- **Sidebar scroll prevention** — body overflow hidden when sidebar overlay open on mobile
- **Multiview button on stream cards** — always visible centered under title, blue when in multiview, ghost style when not
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