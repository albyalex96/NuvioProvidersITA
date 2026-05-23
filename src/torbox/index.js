/**
 * TorBox Nuvio Provider
 * ─────────────────────
 * Searches TorBox's torrent index by TMDB ID, adds the best results to the
 * user's TorBox account, and returns streaming permalinks.
 *
 * Requirements:
 *   - A paid TorBox account and API key.
 *   - Set your API key via: globalThis.SCRAPER_SETTINGS.torbox_api_key
 *
 * Build command (from repo root):
 *   node build.js torbox
 */

import { extractStreams } from './extractor.js';

/**
 * Retrieve the TorBox API key from globalThis.SCRAPER_SETTINGS.
 * @returns {string|null}
 */
function getApiKey() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.SCRAPER_SETTINGS &&
    globalThis.SCRAPER_SETTINGS.torbox_api_key
  ) {
    return globalThis.SCRAPER_SETTINGS.torbox_api_key;
  }
  return null;
}

/**
 * Main Nuvio provider function.
 *
 * @param {string} tmdbId   - The TMDB ID (e.g. "550")
 * @param {string} mediaType - "movie" or "tv"
 * @param {number|null} season  - Season number (1-based), null for movies
 * @param {number|null} episode - Episode number (1-based), null for movies
 * @returns {Promise<Array>} - List of stream objects
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.log(
      '[TorBox] No API key found. Set globalThis.SCRAPER_SETTINGS.torbox_api_key'
    );
    return [];
  }

  try {
    const streams = await extractStreams(tmdbId, mediaType, season, episode, apiKey);
    return streams;
  } catch (err) {
    console.log('[TorBox] Unexpected error in getStreams:', err.message);
    return [];
  }
}

export { getStreams };