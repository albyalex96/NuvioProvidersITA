/**
 * extractor.js - Core TorBox API logic:
 *   1. Search for torrents by TMDB ID
 *   2. Add the best result to the user's TorBox account (if not cached)
 *   3. Request a streaming permalink for each video file
 */

import { apiGet, apiPost } from './http.js';

const API_BASE = 'https://api.torbox.app/v1/api';

/**
 * Build a TMDB search query string accepted by TorBox's search API.
 * TorBox supports the format: "tmdb:ID" for movies, "tmdb:ID" for series.
 * For TV shows we also include season/episode in the text query so that
 * TorBox's full-text search can filter to the right episode pack.
 *
 * @param {string} tmdbId
 * @param {string} mediaType - 'movie' | 'tv'
 * @param {number|null} season
 * @param {number|null} episode
 * @returns {string}
 */
function buildQuery(tmdbId, mediaType, season, episode) {
  let query = 'tmdb:' + tmdbId;
  if (mediaType === 'tv' && season != null && episode != null) {
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    query += ' S' + s + 'E' + e;
  }
  return query;
}

/**
 * Parse a quality label from a torrent name string.
 * @param {string} name
 * @returns {string}
 */
function parseQuality(name) {
  if (!name) return 'Unknown';
  const n = name.toLowerCase();
  if (n.includes('2160p') || n.includes('4k') || n.includes('uhd')) return '4K';
  if (n.includes('1080p')) return '1080p';
  if (n.includes('720p')) return '720p';
  if (n.includes('480p')) return '480p';
  return 'Unknown';
}

/**
 * Determine if a file is a video file worth streaming.
 * @param {string} name - File name
 * @returns {boolean}
 */
function isVideoFile(name) {
  if (!name) return false;
  const ext = name.split('.').pop().toLowerCase();
  return ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'm4v', 'ts', 'webm'].includes(ext);
}

/**
 * Sort torrents: prefer cached, then by seeders descending.
 * @param {Array} torrents
 * @returns {Array}
 */
function sortTorrents(torrents) {
  return torrents.slice().sort((a, b) => {
    const aCached = a.cached ? 1 : 0;
    const bCached = b.cached ? 1 : 0;
    if (bCached !== aCached) return bCached - aCached;
    return (b.seeders || 0) - (a.seeders || 0);
  });
}

/**
 * Search TorBox for torrents matching this media.
 * Returns the top N sorted results.
 *
 * @param {string} query
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
async function searchTorrents(query, apiKey) {
  const resp = await apiGet(
    '/torrents/search',
    { query, limit: 20 },
    apiKey
  );

  if (!resp.success || !resp.data) {
    console.log('[TorBox] Search returned no data:', resp.detail);
    return [];
  }

  // The API may return data as an array directly or wrapped in a .torrents key
  const list = Array.isArray(resp.data) ? resp.data : (resp.data.torrents || []);
  console.log('[TorBox] Search found ' + list.length + ' result(s)');
  return list;
}

/**
 * Add a torrent (by hash) to the user's TorBox account.
 * This is required to obtain a torrent_id for requestdl.
 * Returns the torrent_id, or null on failure.
 *
 * @param {string} hash - Info hash
 * @param {string} name - Torrent name (for labelling)
 * @param {string} apiKey
 * @returns {Promise<number|null>}
 */
async function addTorrent(hash, name, apiKey) {
  try {
    const magnet = 'magnet:?xt=urn:btih:' + hash;
    const resp = await apiPost(
      '/torrents/createtorrent',
      { magnet, name, as_queued: false },
      apiKey
    );

    if (resp.success && resp.data) {
      const torrentId = resp.data.torrent_id || resp.data.id;
      console.log('[TorBox] Added torrent, id=' + torrentId);
      return torrentId;
    }

    // Handle "duplicate item" – TorBox returns the existing torrent_id in data
    if (resp.error === 'DUPLICATE_ITEM' && resp.data) {
      const torrentId = resp.data.torrent_id || resp.data.id;
      console.log('[TorBox] Duplicate, existing id=' + torrentId);
      return torrentId;
    }

    console.log('[TorBox] addTorrent failed:', resp.detail);
    return null;
  } catch (err) {
    console.log('[TorBox] addTorrent error:', err.message);
    return null;
  }
}

/**
 * Fetch the file list for a torrent already in the user's account.
 * Returns an array of file objects with { id, name, size }.
 *
 * @param {number} torrentId
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
async function getTorrentFiles(torrentId, apiKey) {
  try {
    const resp = await apiGet(
      '/torrents/mylist',
      { id: torrentId, bypass_cache: 'true' },
      apiKey
    );

    if (!resp.success || !resp.data) return [];

    const torrent = Array.isArray(resp.data) ? resp.data[0] : resp.data;
    return torrent && torrent.files ? torrent.files : [];
  } catch (err) {
    console.log('[TorBox] getTorrentFiles error:', err.message);
    return [];
  }
}

/**
 * Build a stable streaming permalink for a specific file.
 * Using ?redirect=true means the link auto-redirects to the CDN URL.
 *
 * @param {string} apiKey
 * @param {number} torrentId
 * @param {number} fileId
 * @returns {string}
 */
function buildStreamUrl(apiKey, torrentId, fileId) {
  return (
    API_BASE +
    '/torrents/requestdl?token=' +
    apiKey +
    '&torrent_id=' +
    torrentId +
    '&file_id=' +
    fileId +
    '&redirect=true'
  );
}

/**
 * Main extractor: given media info, returns a list of Nuvio stream objects.
 *
 * @param {string} tmdbId
 * @param {string} mediaType - 'movie' | 'tv'
 * @param {number|null} season
 * @param {number|null} episode
 * @param {string} apiKey
 * @returns {Promise<Array>} - Array of Nuvio stream objects
 */
export async function extractStreams(tmdbId, mediaType, season, episode, apiKey) {
  const streams = [];

  const query = buildQuery(tmdbId, mediaType, season, episode);
  console.log('[TorBox] Query:', query);

  const results = await searchTorrents(query, apiKey);
  if (results.length === 0) {
    console.log('[TorBox] No torrents found');
    return streams;
  }

  const sorted = sortTorrents(results);
  // Process top 5 to avoid too many API calls / long wait times
  const candidates = sorted.slice(0, 5);

  for (let i = 0; i < candidates.length; i++) {
    const torrent = candidates[i];
    const hash = torrent.hash || torrent.info_hash;
    const torrentName = torrent.name || ('TorBox #' + i);

    if (!hash) continue;

    console.log('[TorBox] Processing: ' + torrentName);

    // Add the torrent to the account (or find the existing one)
    const torrentId = await addTorrent(hash, torrentName, apiKey);
    if (!torrentId) continue;

    // Get file list
    const files = await getTorrentFiles(torrentId, apiKey);
    const videoFiles = files.filter((f) => isVideoFile(f.name || f.short_name || ''));

    if (videoFiles.length === 0) {
      // Fallback: build a permalink without file_id (requests the largest file)
      const url = buildStreamUrl(apiKey, torrentId, 0);
      const quality = parseQuality(torrentName);
      streams.push({
        name: 'TorBox',
        title: quality + ' · ' + torrentName.substring(0, 60),
        url,
        quality,
      });
      continue;
    }

    for (let j = 0; j < videoFiles.length; j++) {
      const file = videoFiles[j];
      const fileId = file.id;
      const fileName = file.name || file.short_name || ('File ' + j);

      const url = buildStreamUrl(apiKey, torrentId, fileId);
      const quality = parseQuality(torrentName + ' ' + fileName);

      streams.push({
        name: 'TorBox',
        title: quality + ' · ' + fileName.substring(0, 60),
        url,
        quality,
      });
    }
  }

  console.log('[TorBox] Total streams built:', streams.length);
  return streams;
}