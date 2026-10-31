import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Star,
  Check,
  Users,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  MovieItem,
  movieEmbedChain,
  tvEmbedChain,
  animeEmbedChain,
} from '../services/moviesService';
import {
  getMovieDetails,
  getTVDetails,
  getSimilarMovies,
  getSimilarTV,
  TMDBMovie,
  TMDBTVShow,
  getMovieTrailer,
  getTVTrailer,
} from '../services/tmdbService';

// ── Provider definitions (user-requested list) ───────────────────────────────
interface ProviderDef {
  id: string;
  name: string;
  color: string;
  build: (item: MovieItem) => string | null;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'vidrock',
    name: 'VidRock',
    color: 'from-red-600 to-rose-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidrock.to/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidrock.to/embed/tv/${item.tmdbId}/1/1`;
      return `https://vidrock.to/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    color: 'from-blue-600 to-indigo-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidsrc.sh/embed/movie?tmdb=${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidsrc.sh/embed/tv?tmdb=${item.tmdbId}`;
      return `https://vidsrc.sh/embed/anime?id=${item.idMal}`;
    },
  },
  {
    id: 'vidstorm',
    name: 'VidStorm',
    color: 'from-purple-600 to-fuchsia-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidstorm.to/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidstorm.to/embed/tv/${item.tmdbId}/1/1`;
      return `https://vidstorm.to/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'vidzee',
    name: 'VidZee',
    color: 'from-emerald-600 to-teal-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidzee.tv/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidzee.tv/embed/tv/${item.tmdbId}/1/1`;
      return `https://vidzee.tv/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'vidnest',
    name: 'VidNest',
    color: 'from-orange-600 to-amber-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidnest.to/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidnest.to/embed/tv/${item.tmdbId}/1/1`;
      return `https://vidnest.to/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'vidlink',
    name: 'VidLink',
    color: 'from-cyan-600 to-sky-600',
    build: (item) => {
      if (item.type === 'movie') return `https://vidlink.pro/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidlink.pro/tv/${item.tmdbId}/1/1`;
      return `https://vidlink.pro/anime/${item.idMal}`;
    },
  },
  {
    id: 'vidfast',
    name: 'VidFast',
    color: 'from-pink-600 to-rose-700',
    build: (item) => {
      if (item.type === 'movie') return `https://vidfast.vc/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://vidfast.vc/embed/tv/${item.tmdbId}/1/1`;
      return `https://vidfast.vc/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'videasy',
    name: 'Videasy',
    color: 'from-yellow-600 to-amber-700',
    build: (item) => {
      if (item.type === 'movie') return `https://www.videasy.to/embed/movie/${item.tmdbId}`;
      if (item.type === 'tv') return `https://www.videasy.to/embed/tv/${item.tmdbId}/1/1`;
      return `https://www.videasy.to/embed/anime/${item.idMal}`;
    },
  },
  {
    id: 'pstream',
    name: 'PStream',
    color: 'from-teal-600 to-cyan-700',
    build: (item) => {
      if (item.type === 'movie') return `https://embed.pstream.cfd/movie/tmdb-${item.tmdbId}`;
      if (item.type === 'tv') return `https://embed.pstream.cfd/media/tmdb-tv-${item.tmdbId}`;
      return `https://embed.pstream.cfd/anime/anilist-${item.idMal}`;
    },
  },
];

const providerNameMap: Record<string, string> = {};
PROVIDERS.forEach((p) => {
  providerNameMap[p.id] = p.name;
});

interface MovieDetailsViewProps {
  item: MovieItem;
  onBack: () => void;
  onSelectItem: (item: MovieItem) => void;
  watchlistIds: string[];
  onToggleWatchlist: (id: string) => void;
}

export const MovieDetailsView: React.FC<MovieDetailsViewProps> = ({
  item,
  onBack,
  onSelectItem,
  watchlistIds,
  onToggleWatchlist,
}) => {
  const [details, setDetails] = useState<any>(null);
  const [similar, setSimilar] = useState<MovieItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0].id);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [embedKey, setEmbedKey] = useState(0);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerError, setTrailerError] = useState<string | null>(null);

  const isAnime = item.type === 'anime';
  const inWatchlist = watchlistIds.includes(item.id);

  // Reset on item change — default source is VidRock
  useEffect(() => {
    setActiveProvider(PROVIDERS[0].id);
    setFallbackUrl(null);
    setFallbackIndex(-1);
    setShowFullOverview(false);
    setEmbedKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item.id]);

  // Load rich details
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetails(null);
      try {
        if (item.type === 'movie' && item.tmdbId) {
          const d = await getMovieDetails(item.tmdbId);
          if (!cancelled) setDetails(d);
        } else if (item.type === 'tv' && item.tmdbId) {
          const d = await getTVDetails(item.tmdbId);
          if (!cancelled) setDetails(d);
        }
      } catch (err) {
        console.error('Failed to load details:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.type, item.tmdbId]);

  // Fetch trailer key for this item
  useEffect(() => {
    setTrailerKey(null);
    setTrailerError(null);
    if (item.tmdbId && (item.type === 'movie' || item.type === 'tv')) {
      const fn = item.type === 'movie' ? getMovieTrailer : getTVTrailer;
      fn(item.tmdbId).then((t) => {
        if (t?.key) setTrailerKey(t.key);
        else setTrailerError('No trailer found');
      }).catch(() => setTrailerError('Failed to load trailer'));
    }
  }, [item.id, item.type, item.tmdbId]);

  // Load similar items
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSimilar([]);
      setSimilarLoading(true);
      try {
        if (item.type === 'movie' && item.tmdbId) {
          const results: TMDBMovie[] = await getSimilarMovies(item.tmdbId);
          if (!cancelled) {
            setSimilar(
              results.map((m) => ({
                id: `tmdb-movie-${m.id}`,
                title: m.title,
                year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : undefined,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
                backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w500${m.backdrop_path}` : undefined,
                overview: m.overview,
                rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
                type: 'movie' as const,
                tmdbId: m.id,
              })),
            );
          }
        } else if (item.type === 'tv' && item.tmdbId) {
          const results: TMDBTVShow[] = await getSimilarTV(item.tmdbId);
          if (!cancelled) {
            setSimilar(
              results.map((m) => ({
                id: `tmdb-tv-${m.id}`,
                title: m.name,
                year: m.first_air_date ? parseInt(m.first_air_date.slice(0, 4), 10) : undefined,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
                backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w500${m.backdrop_path}` : undefined,
                overview: m.overview,
                rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
                type: 'tv' as const,
                tmdbId: m.id,
              })),
            );
          }
        }
      } catch (err) {
        console.error('Failed to load similar:', err);
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.type, item.tmdbId]);

  const providerUrl = useMemo(() => {
    const provider = PROVIDERS.find((p) => p.id === activeProvider);
    return provider ? provider.build(item) : null;
  }, [activeProvider, item]);

  // Effective player URL: chosen provider, or the fallback override
  const activeUrl = fallbackUrl || providerUrl;
  const activeProviderName = fallbackUrl ? 'Auto Fallback' : providerNameMap[activeProvider];

  // Verified fallback chains (used by "try next source")
  const fallbackChain = useMemo(() => {
    if (item.type === 'movie' && item.tmdbId) return movieEmbedChain(item.tmdbId, item.imdbId);
    if (item.type === 'tv' && item.tmdbId) return tvEmbedChain(item.tmdbId, item.imdbId);
    if (isAnime && item.idMal) return animeEmbedChain(item.idMal);
    return [];
  }, [item, isAnime]);

  const [fallbackIndex, setFallbackIndex] = useState(-1);

  function handleTryNextSource() {
    if (fallbackChain.length === 0) return;
    // If current URL is in the chain, advance from its position. Otherwise start from 0.
    const currentIdx = fallbackIndex >= 0 && fallbackIndex < fallbackChain.length
      ? fallbackIndex
      : fallbackChain.indexOf(activeUrl!);
    const nextIdx = (currentIdx + 1) % fallbackChain.length;
    setFallbackIndex(nextIdx);
    setFallbackUrl(fallbackChain[nextIdx]);
    setEmbedKey((k) => k + 1);
  }

  const genres: string[] = useMemo(() => {
    if (!details?.genres) return [];
    return (details.genres || []).map((g: any) => g.name);
  }, [details]);

  const cast: { name: string; character: string; profile: string | null }[] = useMemo(() => {
    if (!details?.credits?.cast) return [];
    return (details.credits.cast || []).slice(0, 8).map((c: any) => ({
      name: c.name,
      character: c.character || '',
      profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));
  }, [details]);

  const runtime = useMemo(() => {
    if (item.type === 'tv') {
      const rts: number[] = details?.episode_run_time || [];
      return rts.length ? `${rts[0]} min/ep` : undefined;
    }
    const rt: number | undefined = details?.runtime;
    if (!rt) return undefined;
    const h = Math.floor(rt / 60);
    const m = rt % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }, [details, item.type]);

  const title = details?.title || details?.name || item.title;
  const overview = details?.overview || item.overview || '';
  const tagline = details?.tagline;
  const rating = details?.vote_average ? Math.round(details.vote_average * 10) / 10 : item.rating;
  const rawYear = details?.release_date || details?.first_air_date || item.year;
  const year = rawYear ? String(rawYear).slice(0, 4) : undefined;
  const seasons: number | undefined = details?.number_of_seasons;
  const episodes: number | undefined = details?.number_of_episodes;
  const companies: string[] = useMemo(
    () => ((details?.production_companies || []) as any[]).map((c) => c.name).slice(0, 3),
    [details],
  );

  return (
    <div className="relative min-h-full bg-[#0a0f1c]">
      {/* Backdrop hero */}
      <div className="relative w-full h-56 sm:h-72 md:h-80 overflow-hidden">
        {details?.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w1280${details.backdrop_path}`}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : item.backdrop ? (
          <img src={item.backdrop} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/60 to-transparent" />
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 rounded-lg text-sm text-white transition-colors backdrop-blur"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {/* Watchlist button */}
        <button
          onClick={() => onToggleWatchlist(item.id)}
          className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border backdrop-blur transition-colors ${
            inWatchlist
              ? 'bg-amber-500/90 border-amber-400 text-black'
              : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
          }`}
        >
          <Star className={`w-4 h-4 ${inWatchlist ? 'fill-black' : ''}`} />
          {inWatchlist ? 'Watchlisted' : 'Watchlist'}
        </button>
      </div>

      <div className="px-4 sm:px-8 pb-10 -mt-24 relative">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
          {/* Poster */}
          <img
            src={
              item.poster ||
              (details?.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined)
            }
            alt={title}
            className="w-28 sm:w-40 rounded-xl shadow-2xl shadow-black/60 border border-white/10"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">{title}</h1>
            {tagline && <p className="mt-1 text-sm italic text-slate-400">“{tagline}”</p>}

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {rating && (
                <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-md text-yellow-400 font-bold">
                  <Star className="w-3 h-3 fill-yellow-400" /> {rating}
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 border border-slate-700 rounded-md text-slate-300">
                  <Calendar className="w-3 h-3" /> {year}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 border border-slate-700 rounded-md text-slate-300">
                  <Clock className="w-3 h-3" /> {runtime}
                </span>
              )}
              {seasons !== undefined && (
                <span className="px-2 py-1 bg-slate-800/80 border border-slate-700 rounded-md text-slate-300">
                  {seasons} Seasons{episodes ? ` · ${episodes} Episodes` : ''}
                </span>
              )}
              {details?.status && (
                <span className="px-2 py-1 bg-slate-800/80 border border-slate-700 rounded-md text-slate-300">
                  {details.status}
                </span>
              )}
              {genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded-md text-purple-300"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Overview */}
            {overview && (
              <p
                className={`mt-3 text-sm text-slate-300 leading-relaxed ${
                  showFullOverview ? '' : 'line-clamp-3'
                }`}
              >
                {overview}
              </p>
            )}
            {overview && overview.length > 200 && (
              <button
                onClick={() => setShowFullOverview(!showFullOverview)}
                className="mt-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {showFullOverview ? 'Show less' : 'Read more'}
                {showFullOverview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {/* Companies */}
            {companies.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-400">Production:</span> {companies.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* ── Watch section: choose source ─────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Play className="w-5 h-5 text-purple-400 fill-purple-400" />
              Watch
            </h2>
            <button
              onClick={() => setShowTrailer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-lg text-xs font-semibold text-red-300 transition-colors"
              title="Play official trailer"
            >
              <Play className="w-3.5 h-3.5" />
              Trailer
            </button>
            <button
              onClick={handleTryNextSource}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 rounded-lg text-xs font-semibold text-amber-300 transition-colors"
              title="If the current source doesn't load, jump to the next verified source"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Try next source
            </button>
          </div>

          {/* Provider picker */}

          {/* Provider dropdown */}
          <div className="relative mb-4">
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-sm font-semibold text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className={"w-2 h-2 rounded-full bg-gradient-to-r " + (PROVIDERS.find(pr => pr.id === activeProvider)?.color || 'from-slate-500 to-slate-600')}></span>
                {fallbackUrl ? 'Auto Fallback' : PROVIDERS.find(pr => pr.id === activeProvider)?.name || 'Source'}
              </span>
              <ChevronDown className={"w-4 h-4 text-slate-400 transition-transform " + (showProviderDropdown ? 'rotate-180' : '')} />
            </button>
            {showProviderDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                {PROVIDERS.map((provider) => {
                  const isActive = activeProvider === provider.id && !fallbackUrl;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setActiveProvider(provider.id);
                        setFallbackUrl(null);
                        setFallbackIndex(-1);
                        setEmbedKey((k) => k + 1);
                        setShowProviderDropdown(false);
                      }}
                      className={"w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/80 " + (isActive ? 'bg-slate-800/60' : '')}
                    >
                      <span className={"w-3 h-3 rounded-full bg-gradient-to-r " + provider.color}></span>
                      <span className={"flex-1 text-sm font-medium " + (isActive ? 'text-white' : 'text-slate-300')}>
                        {provider.name}
                      </span>
                      {isActive && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
{/* Player */}
          <div className="mt-4">
            {activeUrl ? (
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/50">
                <iframe
                  key={`${activeProvider}-${fallbackUrl ? 'fb' : 'prov'}-${embedKey}`}
                  src={activeUrl}
                  title={title}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                />
              </div>
            ) : (
              <div className="w-full aspect-video flex items-center justify-center bg-slate-900/60 border border-slate-800 rounded-xl text-slate-500 text-sm">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                No source available for this item
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              Playing via <span className="font-semibold text-slate-300">{activeProviderName}</span> —
              pick another source above if it does not load, or use "Try next source".
            </p>
          </div>
        </div>

        {/* ── Cast ─────────────────────────────────────────────────────────── */}
        {cast.length > 0 && (
          <div className="mt-10">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-3">
              <Users className="w-5 h-5 text-blue-400" />
              Top Cast
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {cast.map((c) => (
                <div key={c.name} className="flex flex-col items-center text-center">
                  {c.profile ? (
                    <img
                      src={c.profile}
                      alt={c.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-slate-700"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                      {c.name[0]}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] font-semibold text-white leading-tight line-clamp-1">{c.name}</p>
                  {c.character && (
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">{c.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── More Like This ───────────────────────────────────────────────── */}
        <div className="mt-10">
          <h2 className="text-lg font-bold text-white mb-3">More Like This</h2>
          {similarLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading...
            </div>
          ) : similar.length === 0 ? (
            <p className="text-sm text-slate-500">No similar titles found.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {similar.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectItem(s)}
                  className="group text-left rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 overflow-hidden transition-all hover:-translate-y-1"
                >
                  <div className="relative aspect-[2/3] bg-slate-800 overflow-hidden">
                    {s.poster ? (
                      <img
                        src={s.poster}
                        alt={s.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs p-2">
                        {s.title.slice(0, 20)}
                      </div>
                    )}
                    {s.rating && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400">
                        ⭐ {s.rating}
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-white line-clamp-1 group-hover:text-purple-300">
                      {s.title}
                    </p>
                    {s.year && <p className="text-[10px] text-slate-500">{s.year}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
  {/* Trailer Modal */}
  {showTrailer && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowTrailer(false)} />
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-red-500">▶</span> {item.title} — Trailer
          </h3>
          <button
            onClick={() => setShowTrailer(false)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          {trailerLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Loading trailer...</p>
            </div>
          ) : trailerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-sm">{trailerError}</p>
              <button
                onClick={() => {
                  setTrailerError(null);
                  setTrailerLoading(true);
                  if (item.tmdbId) {
                    const fn = item.type === 'movie' ? getMovieTrailer : getTVTrailer;
                    fn(item.tmdbId).then((t) => {
                      setTrailerLoading(false);
                      if (t?.key) setTrailerKey(t.key);
                      else setTrailerError('No trailer found');
                    }).catch(() => { setTrailerLoading(false); setTrailerError('Failed to load trailer'); });
                  }
                }}
                className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : trailerKey ? (
            <iframe
              src={"https://www.youtube.com/embed/" + trailerKey + "?autoplay=1&rel=0"}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={item.title + " trailer"}
            />
          ) : null}
        </div>
      </div>
    </div>
  )}
    </div>
  );
};
