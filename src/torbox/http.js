/**
 * http.js — Minimal fetch helpers for TorBox API + public torrent search.
 * No external deps; compatible with React Native / Hermes.
 */

const TORBOX_BASE = 'https://api.torbox.app/v1/api';

/**
 * Authenticated GET to TorBox API.
 */
export async function tbGet(path, params, apiKey) {
  const url = new URL(TORBOX_BASE + path);
  if (params) {
    Object.keys(params).forEach((k) => {
      if (params[k] !== null && params[k] !== undefined) {
        url.searchParams.append(k, String(params[k]));
      }
    });
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('TorBox GET error: ' + res.status);
  return res.json();
}

/**
 * Authenticated POST (JSON body) to TorBox API.
 */
export async function tbPost(path, body, apiKey) {
  const res = await fetch(TORBOX_BASE + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('TorBox POST error: ' + res.status);
  return res.json();
}

/**
 * Generic unauthenticated GET (for public search APIs).
 */
export async function publicGet(url, params) {
  const u = new URL(url);
  if (params) {
    Object.keys(params).forEach((k) => {
      if (params[k] !== null && params[k] !== undefined) {
        u.searchParams.set(k, String(params[k]));
      }
    });
  }
  const res = await fetch(u.toString(), {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NuvioProvider/1.0)' },
  });
  if (!res.ok) throw new Error('Public GET error: ' + res.status + ' ' + url);
  return res.json();
}