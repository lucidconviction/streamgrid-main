# StreamGrid — Feature Task List

## Done ✅

- [x] Full-bleed hero videos on Home, 24/7, IPTV — validated streams with gradient fallback
- [x] Movie/TV/anime cards show real posters (TMDB + AniList, not placeholders)
- [x] Fixed IPTV thumbnail flickering — logo.png centered as fallback, screenshot layered on top
- [x] Sports replays API integrated (Highlightly primary + YouTube fallback)
- [x] Mobile-friendly responsive design across all views
- [x] Row order: Live Sports → 24/7 → IPTV → Popular Movies → Popular TV Shows → Trending Anime → Sports sub
- [x] Hero videos bigger (clamp 360px–75vh–860px) and full-bleed on all pages
- [x] Hero stream validation via HEAD check before rendering video
- [x] Poster cards (Movies/TV) frameless with portrait 9:16 aspect ratio
- [x] All other cards (Anime, IPTV, Sports, 24/7) stay 16:9 bordered
- [x] Sidebar defaults to closed
- [x] Trailer hover removed from thumbnail cards — live embed preview plays on hover instead

## In Progress

- [ ] Add "Watchlist" tab to MoviesView (currently only show/hide star on detail page)
- [ ] Persist highlightly key in .env.production on server (currently only in .env.local)