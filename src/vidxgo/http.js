/**
 * HTTP Utilities
 * Use this file for network requests and headers.
 */

// Header per il GET dell'embed page (Firefox 150 + Referer altadefinizione).
// Sono quelli che StreamVix usa con successo per il primo step.
export const GET_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-GPC': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'iframe',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'DNT': '1',
  'Referer': 'https://altadefinizione.you/',
  'Priority': 'u=0, i',
};

// Header playback verso il CDN. Critico: il CDN richiede i Client Hints
// (sec-ch-ua-*) di Chrome, altrimenti risponde 403. Verificato 2026-05-26.
export const PLAYBACK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': `${VIDXGO_DOMAIN}/`,
  'Origin': VIDXGO_DOMAIN,
  'sec-ch-ua': '"Not)A;Brand";v="99", "Chromium";v="139", "Google Chrome";v="139"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform-version': '"5.15.0"',
  'sec-ch-ua-full-version-list': '"Not)A;Brand";v="99.0.0.0", "Chromium";v="139.0.7258.66", "Google Chrome";v="139.0.7258.66"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};