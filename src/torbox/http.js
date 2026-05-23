/**
 * http.js - Minimal fetch wrapper for Nuvio/Hermes compatibility.
 * No external dependencies, uses the global fetch available in React Native.
 */

const BASE_URL = 'https://api.torbox.app/v1/api';

/**
 * Perform a GET request to the TorBox API.
 * @param {string} path - Endpoint path (e.g. '/torrents/search')
 * @param {Object} params - Query string parameters
 * @param {string} apiKey - TorBox API key
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function apiGet(path, params, apiKey) {
  const url = new URL(BASE_URL + path);
  if (params) {
    Object.keys(params).forEach((k) => {
      if (params[k] !== null && params[k] !== undefined) {
        url.searchParams.set(k, String(params[k]));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('TorBox HTTP error: ' + response.status);
  }

  return response.json();
}

/**
 * Perform a POST request to the TorBox API (JSON body).
 * @param {string} path - Endpoint path
 * @param {Object} body - JSON body
 * @param {string} apiKey - TorBox API key
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function apiPost(path, body, apiKey) {
  const response = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('TorBox HTTP error: ' + response.status);
  }

  return response.json();
}