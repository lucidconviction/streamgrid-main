/**
 * Replay page JS — standalone client-side logic (see sports-replays-api.md §Frontend).
 *
 * Uses the app's own /api/replays/* proxy endpoints so no API keys are exposed.
 * Falls back to the YouTube search endpoint when Highlightly returns empty.
 */
(() => {
  // ── State ───────────────────────────────────────────────────────────────
  let currentSport = 'nba';
  let currentPage = 1;
  let currentQuery = '';
  const RESULTS_PER_PAGE = 20;

  // ── Sport config (mirrors replaysService.ts SPORTS) ───────────────────
  const SPORTS = [
    { id: 'nba',      label: 'NBA',       icon: '🏀', hl: 'basketball' },
    { id: 'nfl',      label: 'NFL',       icon: '🏈', hl: 'american-football' },
    { id: 'mlb',      label: 'MLB',       icon: '⚾', hl: 'baseball' },
    { id: 'nhl',      label: 'NHL',       icon: '🏒', hl: 'nhl' },
    { id: 'soccer',   label: 'Soccer',    icon: '⚽', hl: 'football' },
    { id: 'ncaaf',    label: 'Col. FB',   icon: '🏈', hl: 'american-football' },
    { id: 'ncaab',    label: 'Col. BB',   icon: '🏀', hl: 'basketball' },
    { id: 'f1',       label: 'F1',        icon: '🏎️', hl: null },
    { id: 'ufc',      label: 'UFC',       icon: '🥊', hl: 'martial-arts' },
    { id: 'tennis',   label: 'Tennis',    icon: '🎾', hl: null },
    { id: 'wwe',      label: 'WWE',       icon: '🤼', hl: null },
    { id: 'golf',     label: 'Golf',      icon: '🏌️', hl: null },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const formatDate = (iso) => iso ? iso.slice(0, 10) : '';
  const today = formatDate(new Date().toISOString());
  $('#date-picker').value = today;

  function buildEmbedUrl(h) {
    if (h.embedUrl) return h.embedUrl;
    if (h.url) return h.url;
    if (h.videoId) return `https://www.youtube.com/embed/${h.videoId}`;
    return '';
  }

  function formatDuration(s) {
    if (!s || s < 60) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m < 60) return `${m}:${String(sec).padStart(2, '0')}`;
    const h2 = Math.floor(m / 60);
    const rm = m % 60;
    return `${h2}:${String(rm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── Render tabs ────────────────────────────────────────────────────────
  function renderTabs() {
    const nav = $('#sport-tabs');
    nav.innerHTML = SPORTS.map((s) =>
      `<button class="sport-tab${s.id === currentSport ? ' active' : ''}" data-sport="${s.id}">
        ${s.icon} ${s.label}
      </button>`
    ).join('');
    nav.addEventListener('click', (e) => {
      const tab = e.target.closest('.sport-tab');
      if (!tab) return;
      currentSport = tab.dataset.sport;
      currentPage = 1;
      currentQuery = '';
      $('#search-input').value = '';
      renderTabs();
      loadReplays();
    });
  }

  // ── Fetch from Highlightly via our proxy ───────────────────────────────
  async function fetchHighlights(sport, date, limit) {
    const hl = SPORTS.find((s) => s.id === sport)?.hl;
    if (!hl) return null;
    try {
      const res = await fetch(`/api/replays/${hl}?date=${date}&limit=${limit}`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) return json;
    } catch { /* fall through */ }
    return null;
  }

  // ── Fetch via YouTube search fallback ──────────────────────────────────
  async function fetchYouTubeFallback(sport, query) {
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&limit=${RESULTS_PER_PAGE}`);
      const json = await res.json();
      return (json.results || []).map((r) => ({
        id: r.videoId,
        videoId: r.videoId,
        title: r.title,
        thumbnail: r.thumbnails?.[r.thumbnails.length - 1]?.url || r.thumbnails?.[0]?.url || '',
        duration: r.durationSeconds || 0,
        views: r.viewCount || 0,
        uploader: r.uploaderName || '',
        uploadDate: r.uploadDate || today,
        source: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${r.videoId}`,
        category: 'highlights',
      }));
    } catch {
      return [];
    }
  }

  // ── Load replays ───────────────────────────────────────────────────────
  async function loadReplays() {
    const container = $('#replays-container');
    container.innerHTML = '<div class="loading"><span class="spinner"></span> Loading replays…</div>';

    const date = $('#date-picker').value || today;
    const sport = SPORTS.find((s) => s.id === currentSport);
    const hl = sport?.hl;

    let highlights = null;
    if (hl) {
      highlights = await fetchHighlights(hl, date, RESULTS_PER_PAGE);
    }

    let items = [];
    let source = 'highlightly';

    if (highlights && highlights.data && highlights.data.length > 0) {
      items = highlights.data.map((h) => ({
        id: String(h.id),
        title: h.title,
        thumbnail: h.imgUrl || '',
        duration: 0,
        views: 0,
        uploader: h.channel || h.source || 'Highlightly',
        uploadDate: (h.match?.date || date).slice(0, 10),
        source: 'highlightly',
        embedUrl: h.embedUrl || h.url || '',
        home: h.match?.homeTeam?.displayName || '',
        away: h.match?.awayTeam?.displayName || '',
        score: h.match?.state?.score?.current || '',
        category: h.category || 'match-highlights',
      }));
    } else {
      // Fallback: YouTube search for the sport's queries.
      const searchQueries = {
        nba: ['NBA full game highlights', 'NBA game recap', 'NBA best plays'],
        nfl: ['NFL full game highlights', 'NFL game recap condensed', 'NFL top plays'],
        mlb: ['MLB full game highlights', 'MLB game recap', 'MLB top plays'],
        nhl: ['NHL full game highlights', 'NHL game recap', 'NHL top plays'],
        soccer: ['Soccer full match highlights', 'Premier League highlights', 'Champions League highlights'],
        ncaaf: ['College Football full game highlights', 'CFP highlights'],
        ncaab: ['March Madness full game highlights', 'NCAA basketball highlights'],
        f1: ['F1 race highlights', 'Formula 1 race recap'],
        ufc: ['UFC full fight highlights', 'UFC knockout compilation'],
        tennis: ['Tennis match highlights', 'Wimbledon highlights'],
        wwe: ['WWE Raw highlights', 'WWE SmackDown highlights'],
        golf: ['PGA Tour highlights', 'Masters Tournament highlights'],
      };
      const qs = (searchQueries[currentSport] || ['sports highlights']).slice(0, 3);
      const allResults = [];
      await Promise.all(
        qs.map((q) => fetchYouTubeFallback(currentSport, `${q} ${date.slice(0, 7)}`).then((r) => allResults.push(...r))),
      );
      const seen = new Set();
      items = allResults.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      }).slice(0, RESULTS_PER_PAGE);
      source = 'youtube';
    }

    // Apply optional text search.
    if (currentQuery) {
      items = items.filter((h) =>
        h.title.toLowerCase().includes(currentQuery.toLowerCase()) ||
        h.home?.toLowerCase().includes(currentQuery.toLowerCase()) ||
        h.away?.toLowerCase().includes(currentQuery.toLowerCase())
      );
    }

    renderGrid(items, source, date, highlights);
  }

  // ── Render grid ─────────────────────────────────────────────────────────
  function renderGrid(items, source, date, highlights) {
    const container = $('#replays-container');

    if (items.length === 0) {
      container.innerHTML = `<div class="replay-fallback">
        No replays found for <strong>${source}</strong> on ${date}.
        <code>Search: ${currentQuery || SPORTS.find(s => s.id === currentSport)?.label || currentSport} highlights</code>
      </div>`;
      return;
    }

    // Pagination slice.
    const start = (currentPage - 1) * RESULTS_PER_PAGE;
    const pageItems = items.slice(start, start + RESULTS_PER_PAGE);
    const totalPages = Math.ceil(items.length / RESULTS_PER_PAGE);

    let html = '<div class="replays-grid">';
    for (const h of pageItems) {
      const duration = formatDuration(h.duration || 0);
      html += `<div class="replay-card" data-embed="${h.embedUrl}" data-title="${escapeHtml(h.title)}" data-source="${h.source}">
        <div class="replay-thumb">
          ${h.thumbnail ? `<img src="${escapeHtml(h.thumbnail)}" alt="${escapeHtml(h.title)}" loading="lazy">` : ''}
          <div class="replay-play">▶</div>
          ${duration ? `<span class="replay-duration">${duration}</span>` : ''}
          <span class="replay-source">${h.source === 'highlightly' ? 'HL' : 'YT'}</span>
        </div>
        <div class="replay-info">
          <div class="replay-title">${escapeHtml(h.title)}</div>
          <div class="replay-meta">
            <span class="replay-channel">${escapeHtml(h.uploader)}</span>
            ${h.category ? `<span class="replay-cat">${escapeHtml(h.category)}</span>` : ''}
          </div>
          ${h.home ? `<div class="replay-score">${escapeHtml(h.home)} vs ${escapeHtml(h.away)} ${h.score ? '— ' + escapeHtml(h.score) : ''}</div>` : ''}
        </div>
      </div>`;
    }
    html += '</div>';

    // Pagination controls.
    if (totalPages > 1) {
      let pag = '<div class="pagination">';
      for (let i = 1; i <= totalPages; i++) {
        pag += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
      }
      pag += '</div>';
      html += pag;
    }

    container.innerHTML = html;

    // Click handlers.
    container.querySelectorAll('.replay-card').forEach((card) => {
      card.addEventListener('click', () => openModal(card));
    });
    container.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        loadReplays();
      });
    });
  }

  // ── Modal player ───────────────────────────────────────────────────────
  function openModal(card) {
    const modal = $('#player-modal');
    const iframe = $('#player-iframe');
    const title = $('#player-title');
    const meta = $('#player-meta-line');
    const status = $('#fallback-status');

    const embedUrl = card.dataset.embed;
    const titleText = card.dataset.title;

    iframe.src = embedUrl || '';
    title.textContent = titleText || 'Replay';
    meta.textContent = card.dataset.source === 'highlightly' ? 'Highlightly • Verified source' : 'YouTube • Official channel';
    status.textContent = '';
    status.className = 'fallback-status loading';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('#player-modal');
    const iframe = $('#player-iframe');
    modal.hidden = true;
    iframe.src = '';
    document.body.style.overflow = '';
  }

  // Close on backdrop click or ESC.
  $('#player-modal').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Search input ────────────────────────────────────────────────────────
  $('#search-input').addEventListener('input', (e) => {
    currentQuery = e.target.value.trim();
    currentPage = 1;
    loadReplays();
  });

  // ── Date picker ─────────────────────────────────────────────────────────
  $('#date-picker').addEventListener('change', () => {
    currentPage = 1;
    currentQuery = '';
    $('#search-input').value = '';
    loadReplays();
  });

  // ── Refresh ─────────────────────────────────────────────────────────────
  $('#refresh-btn').addEventListener('click', () => {
    loadReplays();
  });

  // ── Init ────────────────────────────────────────────────────────────────
  renderTabs();
  loadReplays();
})();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
