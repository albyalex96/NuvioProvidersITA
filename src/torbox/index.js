/**
 * TorBox Nuvio Provider — v2
 * ──────────────────────────
 * Finds streams by:
 *   1. Resolving the TMDB ID to a real title (optional, needs TMDB key)
 *   2. Searching public torrent indices (Knaben) for info hashes
 *   3. Checking TorBox cache — only instantly-available torrents are shown first
 *   4. Debriding and returning permanent streaming links
 *
 * Required setting:
 *   globalThis.SCRAPER_SETTINGS.torbox_api_key  — your TorBox API key
 *
 * Optional (but strongly recommended for better search results):
 *   globalThis.SCRAPER_SETTINGS.tmdb_api_key    — TMDB v3 API key
 *
 * Build command (from nuvio-providers repo root):
 *   node build.js torbox
 */

import { extractStreams } from './extractor.js';

function getSetting(key) {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.SCRAPER_SETTINGS &&
    globalThis.SCRAPER_SETTINGS[key]
  ) {
    return globalThis.SCRAPER_SETTINGS[key];
  }
  return null;
}

/**
 * @param {string} tmdbId
 * @param {string} mediaType  - "movie" | "tv"
 * @param {number|null} season
 * @param {number|null} episode
 * @returns {Promise<Array>}
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  const apiKey = getSetting('torbox_api_key');
  if (!apiKey) {
    console.log('[TorBox] Missing torbox_api_key in SCRAPER_SETTINGS');
    return [];
  }

  const tmdbApiKey = "01926d2187b6a5d861eefc750e9df3e3" // optional

  try {
    return await extractStreams(tmdbId, mediaType, season, episode, apiKey, tmdbApiKey);
  } catch (err) {
    console.log('[TorBox] Fatal error in getStreams:', err.message);
    return [];
  }
}

export { getStreams };