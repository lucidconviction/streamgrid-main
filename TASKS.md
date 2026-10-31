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
- [x] Play button on movie/TV poster cards navigates to content description page (MovieDetailsView)
- [x] Hover preview disabled on movie/TV poster cards
- [x] Movies & Shows tab opens on 'Movies' by default
- [x] Genre-based browse sections added to Movies & Shows page:
  - Movies: 21 sections (popular, now playing, top rated, upcoming, trending + 14 genres)
  - TV Shows: 18 sections (popular, on air, top rated, trending, airing today + 13 genres)
  - Anime: 15 sections (trending, popular + 11 genres)
- [x] TMDB discover functions added for genre filtering (getTMDBDiscoverMovies / getTMDBDiscoverTV)
- [x] fetchMovies / fetchTVShows / fetchAnime extended with genre support
- [x] AniList anime queries extended to include genre field for client-side filtering
- [x] TASKS.md updated
- [x] Renamed Quick Search button to Saved Search in header
- [x] Converted provider grid to dropdown menu in MovieDetailsView (movie/TV/anime detail pages)

## In Progress

- [ ] Add "Watchlist" tab to MoviesView (currently only show/hide star on detail page)
- [ ] Persist highlightly key in .env.production on server (currently only in .env.local)
