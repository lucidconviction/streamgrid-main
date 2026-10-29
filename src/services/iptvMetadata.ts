// ── IPTV M3U group-title metadata extraction ────────────────────────────────
//
// Group titles in the M3U SRC files follow the pattern:
//   <provider>|<region> | <genre>
// e.g. "flowutc.com|AM | CA | SPORTS", "phantomzoo.online|UK | MOVIES"
// Separators may use non-breaking spaces (\u00A0) instead of regular spaces.
//
// This module normalizes those into a country code and a genre key so the
// IPTV hub can offer real multi-select filters over 39k channels.

export interface IptvMeta {
  /** Normalized country/region code, e.g. "US", "CA", "UK", "ARAB", "OTHER" */
  country: string;
  /** Human readable label for the country chip, e.g. "US", "Canada", "Arab" */
  countryLabel: string;
  /** Normalized genre key, e.g. "sports", "movies", "general" */
  genre: string;
  /** Human readable label for the genre chip */
  genreLabel: string;
}

// ── Country tokens ──────────────────────────────────────────────────────────
// Exact token (lower-cased, trimmed) → { code, label }
const SPECIFIC_COUNTRIES: Record<string, { code: string; label: string }> = {
  us: { code: 'US', label: 'US' },
  usa: { code: 'US', label: 'US' },
  'united states': { code: 'US', label: 'US' },
  ca: { code: 'CA', label: 'Canada' },
  canada: { code: 'CA', label: 'Canada' },
  'québec': { code: 'CA', label: 'Canada' },
  quebec: { code: 'CA', label: 'Canada' },
  qc: { code: 'CA', label: 'Canada' },
  uk: { code: 'UK', label: 'UK' },
  'united kingdom': { code: 'UK', label: 'UK' },
  england: { code: 'UK', label: 'UK' },
  scotland: { code: 'UK', label: 'UK' },
  wales: { code: 'UK', label: 'UK' },
  'northern ireland': { code: 'UK', label: 'UK' },
  au: { code: 'AU', label: 'Australia' },
  australia: { code: 'AU', label: 'Australia' },
  nz: { code: 'NZ', label: 'New Zealand' },
  'new zealand': { code: 'NZ', label: 'New Zealand' },
  ie: { code: 'IE', label: 'Ireland' },
  ireland: { code: 'IE', label: 'Ireland' },
  de: { code: 'DE', label: 'Germany' },
  germany: { code: 'DE', label: 'Germany' },
  fr: { code: 'FR', label: 'France' },
  france: { code: 'FR', label: 'France' },
  es: { code: 'ES', label: 'Spain' },
  spain: { code: 'ES', label: 'Spain' },
  it: { code: 'IT', label: 'Italy' },
  italy: { code: 'IT', label: 'Italy' },
  pt: { code: 'PT', label: 'Portugal' },
  portugal: { code: 'PT', label: 'Portugal' },
  pl: { code: 'PL', label: 'Poland' },
  poland: { code: 'PL', label: 'Poland' },
  tr: { code: 'TR', label: 'Turkey' },
  turkey: { code: 'TR', label: 'Turkey' },
  br: { code: 'BR', label: 'Brazil' },
  brazil: { code: 'BR', label: 'Brazil' },
  mx: { code: 'MX', label: 'Mexico' },
  mexico: { code: 'MX', label: 'Mexico' },
  ar: { code: 'AR', label: 'Argentina' },
  argentina: { code: 'AR', label: 'Argentina' },
  cl: { code: 'CL', label: 'Chile' },
  chile: { code: 'CL', label: 'Chile' },
  co: { code: 'CO', label: 'Colombia' },
  colombia: { code: 'CO', label: 'Colombia' },
  pe: { code: 'PE', label: 'Peru' },
  peru: { code: 'PE', label: 'Peru' },
  in: { code: 'IN', label: 'India' },
  india: { code: 'IN', label: 'India' },
  pk: { code: 'PK', label: 'Pakistan' },
  pakistan: { code: 'PK', label: 'Pakistan' },
  ir: { code: 'IR', label: 'Iran' },
  iran: { code: 'IR', label: 'Iran' },
  kr: { code: 'KR', label: 'South Korea' },
  korea: { code: 'KR', label: 'South Korea' },
  sg: { code: 'SG', label: 'Singapore' },
  singapore: { code: 'SG', label: 'Singapore' },
  my: { code: 'MY', label: 'Malaysia' },
  malaysia: { code: 'MY', label: 'Malaysia' },
  za: { code: 'ZA', label: 'South Africa' },
  'south africa': { code: 'ZA', label: 'South Africa' },
  ng: { code: 'NG', label: 'Nigeria' },
  nigeria: { code: 'NG', label: 'Nigeria' },
  ke: { code: 'KE', label: 'Kenya' },
  kenya: { code: 'KE', label: 'Kenya' },
  ug: { code: 'UG', label: 'Uganda' },
  uganda: { code: 'UG', label: 'Uganda' },
  ml: { code: 'ML', label: 'Mali' },
  mali: { code: 'ML', label: 'Mali' },
  sn: { code: 'SN', label: 'Senegal' },
  senegal: { code: 'SN', label: 'Senegal' },
  so: { code: 'SO', label: 'Somalia' },
  somalia: { code: 'SO', label: 'Somalia' },
  ru: { code: 'RU', label: 'Russia' },
  russia: { code: 'RU', label: 'Russia' },
  nl: { code: 'NL', label: 'Netherlands' },
  netherlands: { code: 'NL', label: 'Netherlands' },
  be: { code: 'BE', label: 'Belgium' },
  belgium: { code: 'BE', label: 'Belgium' },
  se: { code: 'SE', label: 'Sweden' },
  sweden: { code: 'SE', label: 'Sweden' },
  no: { code: 'NO', label: 'Norway' },
  norway: { code: 'NO', label: 'Norway' },
  dk: { code: 'DK', label: 'Denmark' },
  denmark: { code: 'DK', label: 'Denmark' },
  fi: { code: 'FI', label: 'Finland' },
  finland: { code: 'FI', label: 'Finland' },
  at: { code: 'AT', label: 'Austria' },
  austria: { code: 'AT', label: 'Austria' },
  ch: { code: 'CH', label: 'Switzerland' },
  switzerland: { code: 'CH', label: 'Switzerland' },
  gr: { code: 'GR', label: 'Greece' },
  greece: { code: 'GR', label: 'Greece' },
  hu: { code: 'HU', label: 'Hungary' },
  hungary: { code: 'HU', label: 'Hungary' },
  ro: { code: 'RO', label: 'Romania' },
  romania: { code: 'RO', label: 'Romania' },
  rs: { code: 'RS', label: 'Serbia' },
  serbia: { code: 'RS', label: 'Serbia' },
  sr: { code: 'RS', label: 'Serbia' },
  hr: { code: 'HR', label: 'Croatia' },
  croatia: { code: 'HR', label: 'Croatia' },
  mne: { code: 'ME', label: 'Montenegro' },
  cz: { code: 'CZ', label: 'Czechia' },
  'cz & slovak': { code: 'CZ', label: 'Czechia' },
  czech: { code: 'CZ', label: 'Czechia' },
  sk: { code: 'SK', label: 'Slovakia' },
  slovak: { code: 'SK', label: 'Slovakia' },
  slovakia: { code: 'SK', label: 'Slovakia' },
  bg: { code: 'BG', label: 'Bulgaria' },
  bulgaria: { code: 'BG', label: 'Bulgaria' },
  bosnia: { code: 'BA', label: 'Bosnia' },
  me: { code: 'ME', label: 'Montenegro' },
  montenegro: { code: 'ME', label: 'Montenegro' },
  // FAST provider names that only exist in US
  'samsung tv plus': { code: 'US', label: 'US' },
  'samsungtvplus': { code: 'US', label: 'US' },
  tubi: { code: 'US', label: 'US' },
  xumo: { code: 'US', label: 'US' },
  stirr: { code: 'US', label: 'US' },
  roku: { code: 'US', label: 'US' },
};

// Macro / named regions — checked after specific countries
const NAMED_REGIONS: Record<string, { code: string; label: string }> = {
  arab: { code: 'ARAB', label: 'Arab' },
  arabic: { code: 'ARAB', label: 'Arab' },
  'middle east': { code: 'ARAB', label: 'Arab' },
  asia: { code: 'ASIA', label: 'Asia' },
  asian: { code: 'ASIA', label: 'Asia' },
  lame: { code: 'LATINO', label: 'Latino' },
  latino: { code: 'LATINO', label: 'Latino' },
  'latino america': { code: 'LATINO', label: 'Latino' },
  latin: { code: 'LATINO', label: 'Latino' },
  caribbean: { code: 'CARIBBEAN', label: 'Caribbean' },
  caribbiean: { code: 'CARIBBEAN', label: 'Caribbean' }, // source misspelling
  exyu: { code: 'EXYU', label: 'Ex-Yugo' },
  'ex-yu': { code: 'EXYU', label: 'Ex-Yugo' },
  'exyu macedonia': { code: 'EXYU', label: 'Ex-Yugo' },
  macedonia: { code: 'MK', label: 'Macedonia' },
  makedonija: { code: 'MK', label: 'Macedonia' },
  'former yugoslavia': { code: 'EXYU', label: 'Ex-Yugo' },
  af: { code: 'AF', label: 'Africa' },
  africa: { code: 'AF', label: 'Africa' },
  cplusafrica: { code: 'AF', label: 'Africa' },
  'c+ africa': { code: 'AF', label: 'Africa' },
  xxx: { code: 'XXX', label: '18+' },
  '18+': { code: 'XXX', label: '18+' },
  adult: { code: 'XXX', label: '18+' },
};

// Continent codes (least specific — last resort)
const CONTINENT_CODES: Record<string, { code: string; label: string }> = {
  am: { code: 'AMERICAS', label: 'Americas' },
  americas: { code: 'AMERICAS', label: 'Americas' },
  europe: { code: 'EUROPE', label: 'Europe' },
  europeen: { code: 'EUROPE', label: 'Europe' },
  asia: { code: 'ASIA', label: 'Asia' },
  af: { code: 'AFRICA', label: 'Africa' },
  africa: { code: 'AFRICA', label: 'Africa' },
};

// Preferred display order for the country filter chips
export const COUNTRY_ORDER: string[] = [
  'US', 'CA', 'UK', 'AU', 'DE', 'FR', 'ES', 'IT', 'PT', 'PL', 'TR',
  'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'IN', 'PK', 'IR', 'KR', 'SG', 'MY',
  'ZA', 'NG', 'KE', 'UG', 'ML', 'SN', 'SO', 'RU', 'NL', 'BE', 'SE', 'NO',
  'DK', 'FI', 'AT', 'CH', 'GR', 'HU', 'RO', 'RS', 'HR', 'BA', 'ME', 'CZ',
  'SK', 'BG', 'IE', 'NZ', 'ARAB', 'ASIA', 'LATINO', 'CARIBBEAN', 'EXYU',
  'AMERICAS', 'EUROPE', 'AFRICA', 'XXX', 'OTHER',
];

export const COUNTRY_LABELS: Record<string, string> = {
  US: 'US', CA: 'Canada', UK: 'UK', AU: 'Australia', NZ: 'New Zealand',
  IE: 'Ireland', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
  PT: 'Portugal', PL: 'Poland', TR: 'Turkey', BR: 'Brazil', MX: 'Mexico',
  AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru', IN: 'India',
  PK: 'Pakistan', IR: 'Iran', KR: 'S. Korea', SG: 'Singapore', MY: 'Malaysia',
  ZA: 'S. Africa', NG: 'Nigeria', KE: 'Kenya', UG: 'Uganda', ML: 'Mali',
  SN: 'Senegal', SO: 'Somalia', RU: 'Russia', NL: 'Netherlands', BE: 'Belgium',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', AT: 'Austria',
  CH: 'Switzerland', GR: 'Greece', HU: 'Hungary', RO: 'Romania', RS: 'Serbia',
  HR: 'Croatia', BA: 'Bosnia', ME: 'Montenegro', CZ: 'Czechia', SK: 'Slovakia',
  BG: 'Bulgaria', ARAB: 'Arab', ASIA: 'Asia', LATINO: 'Latino',
  CARIBBEAN: 'Caribbean', EXYU: 'Ex-Yugo', AMERICAS: 'Americas',
  EUROPE: 'Europe', AFRICA: 'Africa', XXX: '18+', OTHER: 'Other',
};

// ── Genre rules ─────────────────────────────────────────────────────────────
// Ordered by priority (first match wins). Each rule tests the whole normalized
// group-title string.
const GENRE_RULES: Array<{ key: string; label: string; test: RegExp }> = [
  { key: 'adult', label: '18+', test: /\bxxx\b|\b18\+|adult|adulti/ },
  { key: 'ppv', label: 'PPV', test: /\bppv\b|pay.?per.?view|live events|sky store/ },
  { key: 'fast', label: 'FAST', test: /\bfast\b|samsung tv|samsungtv|tubi\b|xumo\b|stirr\b|roku\b|free\b/ },
  { key: 'movies', label: 'Movies', test: /\bmovies?\b|\bcinema\b|\bfilm\b|\bseries?\b|\bcine\b/ },
  { key: 'documentaries', label: 'Docs', test: /documentari|documentaire|\bhistory\b|discovery|nat geo|national geographic/ },
  { key: 'kids', label: 'Kids', test: /\bkids?\b|children|nickelodeon|cartoon|disney jr/ },
  { key: 'music', label: 'Music', test: /\bmusic\b|\bmtv\b|\bvh1\b|concert/ },
  { key: 'news', label: 'News', test: /\bnews\b|\bcnn\b|\bbbc news\b|msnbc|weather|information|not[íi]cias|24 hours|24 heures/ },
  { key: 'entertainment', label: 'Entertainment', test: /entertainment|\bshows?\b|\bcomedy\b|\btnt\b|\btbs\b|\bfx\b|starz|showtime|\bamc\b|\bcbs\b|\bnbc\b|\bfox\b|\babc\b/ },
  { key: 'sports', label: 'Sports', test: /sport|dazn|espn|bein|bundesliga|laliga|uefa|\bnfl\b|\bnba\b|\bmlb\b|nhl|hockey|tennis|golf|rugby|cricket|\bf1\b|motorsport|racing|\bufc\b|\bwwe\b|boxing|fight|championship|football|\bleague\b|spfl|deportes|esportes/ },
];

const DEFAULT_GENRE = { key: 'general', label: 'General' };

export const GENRE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'sports', label: 'Sports' },
  { key: 'movies', label: 'Movies' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'news', label: 'News' },
  { key: 'documentaries', label: 'Docs' },
  { key: 'kids', label: 'Kids' },
  { key: 'music', label: 'Music' },
  { key: 'ppv', label: 'PPV' },
  { key: 'fast', label: 'FAST' },
  { key: 'adult', label: '18+' },
  { key: 'general', label: 'General' },
];

function normalizeToken(part: string): string {
  return part
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[¡¿]/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (españa→espana, turk sinema ok)
    .replace(/\s+/g, ' ')
    .replace(/[⭐⛔☀⚡➡✅✔️📡🔴🟢🔵💡🆕✨]/gu, ' ');
}

// Country names in non-English group-titles (post accent-strip)
const COUNTRY_NAME_EXTRA: Record<string, { code: string; label: string }> = {
  espana: { code: 'ES', label: 'Spain' },
  espanol: { code: 'ES', label: 'Spain' },
  turk: { code: 'TR', label: 'Turkey' },
  turkish: { code: 'TR', label: 'Turkey' },
  turkiye: { code: 'TR', label: 'Turkey' },
  ukraina: { code: 'UA', label: 'Ukraine' },
  ukrain: { code: 'UA', label: 'Ukraine' },
  ukraine: { code: 'UA', label: 'Ukraine' },
  albani: { code: 'AL', label: 'Albania' },
  albany: { code: 'AL', label: 'Albania' },
  albanie: { code: 'AL', label: 'Albania' },
  algerie: { code: 'DZ', label: 'Algeria' },
  alban: { code: 'AL', label: 'Albania' },
  israil: { code: 'IL', label: 'Israel' },
  israel: { code: 'IL', label: 'Israel' },
  kurd: { code: 'KU', label: 'Kurdistan' },
  kurdish: { code: 'KU', label: 'Kurdistan' },
  kurdistan: { code: 'KU', label: 'Kurdistan' },
  armenia: { code: 'AM2', label: 'Armenia' },
  georgia: { code: 'GE', label: 'Georgia' },
  azer: { code: 'AZ', label: 'Azerbaijan' },
  moldav: { code: 'MD', label: 'Moldova' },
  belar: { code: 'BY', label: 'Belarus' },
  kazak: { code: 'KZ', label: 'Kazakhstan' },
  tajik: { code: 'TJ', label: 'Tajikistan' },
  uzbek: { code: 'UZ', label: 'Uzbekistan' },
  vietnam: { code: 'VN', label: 'Vietnam' },
  thai: { code: 'TH', label: 'Thailand' },
  japan: { code: 'JP', label: 'Japan' },
  china: { code: 'CN', label: 'China' },
  hongkong: { code: 'HK', label: 'Hong Kong' },
  'hong kong': { code: 'HK', label: 'Hong Kong' },
  guatemala: { code: 'GT', label: 'Guatemala' },
  'costa rica': { code: 'CR', label: 'Costa Rica' },
  paraguay: { code: 'PY', label: 'Paraguay' },
  ecuador: { code: 'EC', label: 'Ecuador' },
  bolivia: { code: 'BO', label: 'Bolivia' },
  venezuela: { code: 'VE', label: 'Venezuela' },
  haiti: { code: 'HT', label: 'Haiti' },
  jamaica: { code: 'JM', label: 'Jamaica' },
  panama: { code: 'PA', label: 'Panama' },
  'el salvador': { code: 'SV', label: 'El Salvador' },
  nicaragua: { code: 'NI', label: 'Nicaragua' },
  honduras: { code: 'HN', label: 'Honduras' },
  afghan: { code: 'AF2', label: 'Afghanistan' },
  afghanistan: { code: 'AF2', label: 'Afghanistan' },
  iran: { code: 'IR', label: 'Iran' },
  irak: { code: 'IQ', label: 'Iraq' },
  iraq: { code: 'IQ', label: 'Iraq' },
  egypt: { code: 'EG', label: 'Egypt' },
  morocco: { code: 'MA', label: 'Morocco' },
  'marruecos': { code: 'MA', label: 'Morocco' },
  tunisia: { code: 'TN', label: 'Tunisia' },
  libya: { code: 'LY', label: 'Libya' },
  ghana: { code: 'GH', label: 'Ghana' },
  ethiopia: { code: 'ET', label: 'Ethiopia' },
  tanzania: { code: 'TZ', label: 'Tanzania' },
  mozambique: { code: 'MZ', label: 'Mozambique' },
  zimbabwe: { code: 'ZW', label: 'Zimbabwe' },
  gh: { code: 'GH', label: 'Ghana' },
  ma: { code: 'MA', label: 'Morocco' },
  tz: { code: 'TZ', label: 'Tanzania' },
  'new york': { code: 'US', label: 'US' },
  'san diego': { code: 'US', label: 'US' },
  'los angeles': { code: 'US', label: 'US' },
};

function splitTokens(part: string): string[] {
  // Split a compound token on common delimiters so "UK-Restream" → ["uk", "restream"]
  return part
    .split(/[-|:._\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function findCountry(parts: string[]): { code: string; label: string } | null {
  const norm = parts.map(normalizeToken);
  const specificMaps = [SPECIFIC_COUNTRIES, COUNTRY_NAME_EXTRA];

  // Pass 1 — specific countries (country codes & names)
  for (const part of norm) {
    // Exact match on the whole token
    for (const map of specificMaps) {
      const hit = map[part];
      if (hit) return hit;
    }
    // Exact match on sub-tokens (e.g. "UK-Restream" → "uk")
    for (const sub of splitTokens(part)) {
      for (const map of specificMaps) {
        const hit = map[sub];
        if (hit) return hit;
      }
    }
    // Substring check for compound labels, e.g. "Canada | SAMSUNG TV+"
    for (const map of specificMaps) {
      for (const [token, meta] of Object.entries(map)) {
        if (token.length >= 4 && part.includes(token)) return meta;
      }
    }
  }

  // Pass 2 — named regions (Arab, Asia, Latino, 18+, ...)
  for (const part of norm) {
    const hit = NAMED_REGIONS[part];
    if (hit) return hit;
    for (const sub of splitTokens(part)) {
      const hit2 = NAMED_REGIONS[sub];
      if (hit2) return hit2;
    }
  }

  // Pass 3 — continent codes (AM, EU, AS, AF)
  for (const part of norm) {
    const hit = CONTINENT_CODES[part];
    if (hit) return hit;
    for (const sub of splitTokens(part)) {
      const hit2 = CONTINENT_CODES[sub];
      if (hit2) return hit2;
    }
  }

  return null;
}

function findGenre(fullNormalized: string): { key: string; label: string } {
  for (const rule of GENRE_RULES) {
    if (rule.test.test(fullNormalized)) return { key: rule.key, label: rule.label };
  }
  return { key: DEFAULT_GENRE.key, label: DEFAULT_GENRE.label };
}

/**
 * Strip channel-name decorations: leading `####`/`#####`/`009 `/`⭐ ` badges,
 * trailing `#####`, and super-script quality tags (NTAL PPV etc.).
 */
function cleanChannelName(name: string): string {
  return name
    .replace(/\u00A0/g, ' ')
    .replace(/[⭐⛔☀⚡➡✅✔️📡🔴🟢🔵💡🆕✨]/gu, ' ')
    .replace(/^[0-9]{3}\s*/, '') // "009 MX: ..." → "MX: ..."
    .replace(/^[#⭐⚡☀]\s*/, '')
    .replace(/\s*[#⭐⚡☀]\s*$/g, '')
    .replace(/[\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a raw M3U group-title (and optionally the channel name) into a
 * country code + genre. Handles the "<provider>|<region>|<genre>" convention,
 * plain FAST names like "Samsung TV Plus", and portal feeds where the signal
 * lives in the channel name (e.g. "##### CA - SPORTSNET #####").
 */
export function parseGroupTitle(raw: string | undefined, channelName?: string): IptvMeta {
  if (!raw && !channelName) {
    return { country: 'OTHER', countryLabel: 'Other', genre: 'general', genreLabel: 'General' };
  }

  const group = raw ? raw.replace(/\u00A0/g, ' ').trim() : '';
  const name = channelName ? cleanChannelName(channelName) : '';

  // Country: prefer group-title parts, fall back to name tokens
  let country: { code: string; label: string } | null = null;
  if (group) {
    const parts = group.split('|').map((p) => p.trim()).filter(Boolean);
    const searchParts = parts.length <= 1 ? parts : parts.slice(1);
    country = findCountry(searchParts);
  }
  if (!country && name) {
    // Name tokens are separated by " - ", " | ", ":", or whitespace
    const nameTokens = name.split(/[\-|:]/).map((p) => p.trim()).filter(Boolean);
    country = findCountry(nameTokens);
  }
  if (!country) country = { code: 'OTHER', label: 'Other' };

  // Genre: scan group + name together
  const combined = normalizeToken([group, name].filter(Boolean).join(' '));
  const genre = findGenre(combined);

  return {
    country: country.code,
    countryLabel: COUNTRY_LABELS[country.code] || country.label,
    genre: genre.key,
    genreLabel: genre.label,
  };
}
