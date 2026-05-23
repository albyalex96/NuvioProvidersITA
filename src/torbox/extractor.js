/**
 * extractor.js — Orchestrates the full stream-discovery pipeline:
 *
 *   1. Resolve TMDB ID → title + year  (via TMDB API, optional)
 *      OR use title/year already provided by Nuvio in scraper_settings
 *   2. Search public torrent indices for info hashes
 *   3. Batch-check which hashes are cached on TorBox
 *   4. Debrid only the cached ones (add + get files + build URL)
 *   5. Return Nuvio stream objects
 *
 * Notes:
 *   - A TMDB API key is NOT required if you only want hash→stream.
 *     Without it, we do a best-effort text search using the TMDB ID as query.
 *   - With a TMDB API key stored in globalThis.SCRAPER_SETTINGS.tmdb_api_key,
 *     we fetch the real title first, improving search accuracy significantly.
 */

import { findTorrentHashes } from './search.js';
import { checkCached, debridHash } from './torbox.js';

const TMDB_API = 'https://api.themoviedb.org/3';

/**
 * Resolve TMDB ID to { title, year } using the TMDB API.
 * Returns null if no TMDB key is available or on error.
 */
async function resolveTmdbTitle(tmdbId, mediaType, tmdbApiKey) {
  if (!tmdbApiKey) return null;
  try {
    const endpoint =
      mediaType === 'tv'
        ? TMDB_API + '/tv/' + tmdbId + '?api_key=' + tmdbApiKey + '&language=en-US'
        : TMDB_API + '/movie/' + tmdbId + '?api_key=' + tmdbApiKey + '&language=en-US';

    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();

    const title = data.title || data.name || null;
    const rawDate = data.release_date || data.first_air_date || '';
    const year = rawDate ? parseInt(rawDate.substring(0, 4), 10) : null;
    return title ? { title, year } : null;
  } catch (err) {
    console.log('[TorBox/tmdb] resolve error:', err.message);
    return null;
  }
}

/**
 * Main extractor: given Nuvio params, return stream list.
 *
 * @param {string} tmdbId
 * @param {string} mediaType  - 'movie' | 'tv'
 * @param {number|null} season
 * @param {number|null} episode
 * @param {string} apiKey      - TorBox API key
 * @param {string|null} tmdbApiKey - Optional TMDB API key for title resolution
 * @returns {Promise<Array>}   - Nuvio stream objects
 */
export async function extractStreams(tmdbId, mediaType, season, episode, apiKey, tmdbApiKey) {
  // ── Step 1: Resolve title ──────────────────────────────────────────────────
  let title = null;
  let year = null;

  const resolved = await resolveTmdbTitle(tmdbId, mediaType, tmdbApiKey);
  if (resolved) {
    title = resolved.title;
    year = resolved.year;
    console.log('[TorBox] Resolved title:', title, year);
  } else {
    // Fallback: use TMDB ID as-is in query (poor results but better than nothing)
    title = 'tmdb' + tmdbId;
    console.log('[TorBox] No TMDB key, searching by ID:', title);
  }

  // ── Step 2: Find torrent hashes ────────────────────────────────────────────
  const candidates = await findTorrentHashes(title, year, mediaType, season, episode);
  if (candidates.length === 0) {
    console.log('[TorBox] No torrents found');
    return [];
  }
  console.log('[TorBox] Found', candidates.length, 'torrent candidates');

  // ── Step 3: Batch-check TorBox cache ──────────────────────────────────────
  const hashes = candidates.map((c) => c.hash);
  const cachedSet = await checkCached(hashes, apiKey);
  console.log('[TorBox] Cached hashes:', cachedSet.size, '/', hashes.length);

  // Filter to only cached candidates (instant streams, no wait)
  const cachedCandidates = candidates.filter((c) => cachedSet.has(c.hash));

  if (cachedCandidates.length === 0) {
    // Fallback: try top 3 uncached if nothing is cached
    // (TorBox will queue them, but requestdl with redirect=true will still work
    //  once they finish, so we can still offer the link)
    console.log('[TorBox] No cached hits, falling back to top 3 uncached');
    const fallback = candidates.slice(0, 3);
    const streams = [];
    for (const c of fallback) {
      const s = await debridHash(c.hash, c.title, apiKey);
      streams.push(...s);
    }
    return streams;
  }

  // ── Step 4: Debrid cached candidates ──────────────────────────────────────
  // Process top 5 cached results to keep response time short
  const toDebrid = cachedCandidates.slice(0, 5);
  const streams = [];

  for (const candidate of toDebrid) {
    const s = await debridHash(candidate.hash, candidate.title, apiKey);
    streams.push(...s);
  }

  console.log('[TorBox] Total streams:', streams.length);
  return streams;
}