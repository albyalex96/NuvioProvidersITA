/**
 * torbox.js — TorBox debrid integration.
 *
 * Flow:
 *   1. checkCached(hashes[])   → which hashes are instantly available
 *   2. addTorrent(magnet)      → add to account, get torrent_id
 *   3. getFiles(torrent_id)    → list video files
 *   4. buildStreamUrl(...)     → permanent redirect link
 */

import { tbGet, tbPost } from './http.js';

const TORBOX_BASE = 'https://api.torbox.app/v1/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isVideoFile(name) {
  if (!name) return false;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ['mkv', 'mp4', 'avi', 'mov', 'm4v', 'ts', 'webm', 'wmv'].includes(ext);
}

function parseQuality(s) {
  const t = (s || '').toLowerCase();
  if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '4K';
  if (t.includes('1080p')) return '1080p';
  if (t.includes('720p')) return '720p';
  if (t.includes('480p')) return '480p';
  return 'Unknown';
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Check which hashes are cached in TorBox (instantly streamable).
 * Returns a Set of lowercase hex hashes that are cached.
 *
 * Endpoint: GET /v1/api/torrents/checkcached?hash=HASH1,HASH2,...&format=list
 *
 * @param {string[]} hashes
 * @param {string} apiKey
 * @returns {Promise<Set<string>>}
 */
export async function checkCached(hashes, apiKey) {
  const cached = new Set();
  if (!hashes || hashes.length === 0) return cached;

  // API accepts up to ~100 hashes per request
  const BATCH = 100;
  for (let i = 0; i < hashes.length; i += BATCH) {
    const batch = hashes.slice(i, i + BATCH);
    try {
      const resp = await tbGet(
        '/torrents/checkcached',
        { hash: batch.join(','), format: 'list' },
        apiKey
      );

      if (!resp.success || !resp.data) continue;

      // "list" format returns an array of hashes that are cached
      const data = resp.data;
      if (Array.isArray(data)) {
        data.forEach((h) => cached.add(String(h).toLowerCase()));
      } else if (typeof data === 'object') {
        // "object" format: { HASH: { ... } } — keys present = cached
        Object.keys(data).forEach((h) => cached.add(h.toLowerCase()));
      }
    } catch (err) {
      console.log('[TorBox/cache] checkcached error:', err.message);
    }
  }

  return cached;
}

/**
 * Add a torrent by magnet link.
 * Returns torrent_id (number) or null on failure.
 * Handles DUPLICATE_ITEM gracefully.
 *
 * @param {string} hash  - Lowercase hex info hash
 * @param {string} name  - Human-readable label
 * @param {string} apiKey
 * @returns {Promise<number|null>}
 */
export async function addTorrent(hash, name, apiKey) {
  const magnet = 'magnet:?xt=urn:btih:' + hash;
  try {
    const resp = await tbPost(
      '/torrents/createtorrent',
      { magnet, name: name || hash, as_queued: false },
      apiKey
    );

    if (resp.success && resp.data) {
      return resp.data.torrent_id || resp.data.id || null;
    }

    // TorBox returns error=DUPLICATE_ITEM when already added; data still has the id
    if (resp.error === 'DUPLICATE_ITEM' && resp.data) {
      return resp.data.torrent_id || resp.data.id || null;
    }

    console.log('[TorBox] addTorrent failed:', resp.detail);
    return null;
  } catch (err) {
    console.log('[TorBox] addTorrent error:', err.message);
    return null;
  }
}

/**
 * Fetch file list for a torrent already in the account.
 *
 * @param {number} torrentId
 * @param {string} apiKey
 * @returns {Promise<Array<{id, name, size}>>}
 */
export async function getTorrentFiles(torrentId, apiKey) {
  try {
    const resp = await tbGet(
      '/torrents/mylist',
      { id: torrentId, bypass_cache: 'true' },
      apiKey
    );
    if (!resp.success || !resp.data) return [];
    const torrent = Array.isArray(resp.data) ? resp.data[0] : resp.data;
    return (torrent && torrent.files) ? torrent.files : [];
  } catch (err) {
    console.log('[TorBox] getTorrentFiles error:', err.message);
    return [];
  }
}

/**
 * Build a permanent streaming redirect URL.
 * ?redirect=true makes TorBox auto-redirect to the CDN link.
 */
export function buildStreamUrl(apiKey, torrentId, fileId) {
  return (
    TORBOX_BASE +
    '/torrents/requestdl?token=' + apiKey +
    '&torrent_id=' + torrentId +
    '&file_id=' + fileId +
    '&redirect=true'
  );
}

/**
 * Full debrid pipeline for a single torrent hash.
 * Returns an array of Nuvio stream objects (may be empty).
 *
 * @param {string} hash
 * @param {string} torrentTitle
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function debridHash(hash, torrentTitle, apiKey) {
  const streams = [];

  const torrentId = await addTorrent(hash, torrentTitle, apiKey);
  if (!torrentId) return streams;

  const files = await getTorrentFiles(torrentId, apiKey);
  const videos = files.filter((f) => isVideoFile(f.name || f.short_name || ''));

  if (videos.length === 0) {
    // Fallback: file_id=0 requests the largest file
    const url = buildStreamUrl(apiKey, torrentId, 0);
    const q = parseQuality(torrentTitle);
    streams.push({
      name: 'TorBox',
      title: q + ' · ' + (torrentTitle || '').substring(0, 60),
      url,
      quality: q,
    });
    return streams;
  }

  for (const file of videos) {
    const fileId = file.id;
    const fileName = file.name || file.short_name || '';
    const url = buildStreamUrl(apiKey, torrentId, fileId);
    const q = parseQuality(torrentTitle + ' ' + fileName);
    streams.push({
      name: 'TorBox',
      title: q + ' · ' + fileName.substring(0, 60),
      url,
      quality: q,
    });
  }

  return streams;
}