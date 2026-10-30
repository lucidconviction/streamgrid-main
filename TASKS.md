
## Done ✅

- [x] Full-bleed hero videos on Home, 24/7, IPTV — validated streams with gradient fallback
- [x] Movie/TV/anime cards show real posters (TMDB + AniList, not placeholders)
- [x] Trailer plays on hover over movie/TV poster cards (YouTube iframe, muted, autoplay)
- [x] Tapping a movie/TV/anime poster card navigates to the detail/description page (MoviesView → MovieDetailsView)
- [x] Fixed IPTV thumbnail flickering — logo.png centered as fallback, screenshot layered on top
- [x] Sports replays API integrated (Highlightly primary + YouTube fallback)
- [x] Mobile-friendly responsive design across all views
- [x] Row order: Live Sports → 24/7 → IPTV → Popular Movies → Popular TV Shows → Trending Anime → Sports sub → Replays

## In Progress

- [ ] Portrait poster frame fix — movie/TV/anime cards still use `aspect-video` (16:9) which crops 2:3 posters
  - StreamCard line 229: `className="relative aspect-video w-full overflow-hidden"` needs portrait ratio for poster-based media
  - Fix: make aspect ratio conditional — `aspect-[2/3]` for cards with `stream.poster`, `aspect-video` for embed streams

## TODO

- [ ] Add "Watchlist" tab to MoviesView (currently only show/hide star on detail page)
- [ ] Persist highlightly key in .env.production on server (currently only in .env.local)
- [x] Removed Sports Replays & Highlights carousel from home screen (kept standalone /replays page)
- [x] Remove Sports Replays & Highlights carousel from home screen (standalone /replays page remains)
