/**
 * search.js — Public torrent index search to retrieve info hashes.
 *
 * Strategy:
 *   1. Build a text query from title + year (+ S/E for TV)
 *   2. Query Knaben API (aggregates multiple public trackers, no auth needed)
 *   3. Return a deduped array of { hash, title, size, seeders }
 *
 * Knaben docs: https://knaben.eu/about/
 */

import { publicGet } from './http.js';

const KNABEN_API = 'https://knaben.eu/api/v1';

/**
 * Quality keyword sets, from best to worst.
 * Used to sort results before cache-checking.
 */
const QUALITY_SCORE = {
  '2160p': 8,
  '4k': 8,
  'uhd': 7,
  'remux': 6,
  '1080p': 5,
  'bluray': 4,
  'web-dl': 3,
  'webrip': 3,
  '720p': 2,
};

function qualityScore(title) {
  const t = (title || '').toLowerCase();
  for (const [kw, score] of Object.entries(QUALITY_SCORE)) {
    if (t.includes(kw)) return score;
  }
  return 0;
}

/**
 * Extract a clean 40-char hex info hash from a magnet or raw string.
 */
export function extractHash(value) {
  if (!value) return null;
  // Raw hex hash
  if (/^[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
  // Magnet URI
  const m = value.match(/btih:([a-fA-F0-9]{40})/i);
  if (m) return m[1].toLowerCase();
  return null;
}

/**
 * Search Knaben for torrents matching the given media.
 *
 * @param {string} query       - Text search query
 * @param {string} mediaType   - 'movie' | 'tv'
 * @param {number} maxResults
 * @returns {Promise<Array<{hash, title, size, seeders}>>}
 */
async function searchKnaben(query, mediaType, maxResults) {
  // Knaben category IDs: 2000=Movies, 5000=TV
  const categoryId = mediaType === 'tv' ? 5000 : 2000;

  const data = await publicGet(KNABEN_API + '/search', {
    q: query,
    categories: categoryId,
    orderBy: 'seeders',
    orderDirection: 'desc',
    take: maxResults,
  });

  if (!data || !Array.isArray(data.hits)) return [];

  return data.hits
    .map((item) => {
      const hash = extractHash(item.infoHash || item.hash || item.magnet || '');
      if (!hash) return null;
      return {
        hash,
        title: item.name || item.title || '',
        size: item.bytes || item.size || 0,
        seeders: item.seeders || 0,
      };
    })
    .filter(Boolean);
}

/**
 * Build the best text query for a piece of media.
 */
function buildQuery(title, year, mediaType, season, episode) {
  let q = title;
  if (year) q += ' ' + year;
  if (mediaType === 'tv' && season != null && episode != null) {
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    q += ' S' + s + 'E' + e;
  }
  return q.trim();
}

/**
 * Main entry: search public indices and return deduplicated hashes sorted by quality.
 *
 * @param {string} title
 * @param {number|null} year
 * @param {string} mediaType   - 'movie' | 'tv'
 * @param {number|null} season
 * @param {number|null} episode
 * @returns {Promise<Array<{hash, title, size, seeders}>>}
 */
export async function findTorrentHashes(title, year, mediaType, season, episode) {
  const query = buildQuery(title, year, mediaType, season, episode);
  console.log('[TorBox/search] Query:', query);

  let results = [];
  try {
    results = await searchKnaben(query, mediaType, 30);
    console.log('[TorBox/search] Knaben returned', results.length, 'results');
  } catch (err) {
    console.log('[TorBox/search] Knaben error:', err.message);
  }

  // Deduplicate by hash
  const seen = new Set();
  const unique = results.filter((r) => {
    if (seen.has(r.hash)) return false;
    seen.add(r.hash);
    return true;
  });

  // Sort: quality score desc, then seeders desc
  unique.sort((a, b) => {
    const qs = qualityScore(b.title) - qualityScore(a.title);
    if (qs !== 0) return qs;
    return (b.seeders || 0) - (a.seeders || 0);
  });

  return unique;
}