// ============================================================
// torrentio.js — deoffuscato
// Provider per stream via Torrentio + TMDB
// ============================================================

const TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlYzM3OTBlOWM2ZjQ0MmRlYTU1NTU3ZjE3OTQ4YjJjMiIsInN1YiI6IjY2NTBmMWJmYTIyYTA3MmNjZTE5MWIwOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.YHkpxz4vc-5pCrODVF3dVCVbMpX_e6YvFvIR9WHDV1g";
const TORRENTIO_API = "https://torrentio.strem.fun/sort=qualitysize|qualityfilter=480p,scr,cam";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

// Utility async helper (equivalente di __async / generatori)
var __async = (thisArg, args, generator) => {
  return new Promise((resolve, reject) => {
    var onFulfilled = (value) => {
      try { step(generator.next(value)); }
      catch (e) { reject(e); }
    };
    var onRejected = (value) => {
      try { step(generator.throw(value)); }
      catch (e) { reject(e); }
    };
    var step = (result) =>
      result.done
        ? resolve(result.value)
        : Promise.resolve(result.value).then(onFulfilled, onRejected);
    step((generator = generator.apply(thisArg, args)).next());
  });
};

// -----------------------------------------------------------
// Estrae la qualità video dalla stringa descrittiva del flusso
// -----------------------------------------------------------
function extractQuality(title = "") {
  const t = title.toLowerCase();
  if (t.includes("2160p") || t.includes("4k")) return "4K";
  if (t.includes("1080p")) return "1080p";
  if (t.includes("720p"))  return "720p";
  if (t.includes("480p"))  return "480p";
  return "Unknown";
}

// -----------------------------------------------------------
// Lista di tracker per i magnet link
// -----------------------------------------------------------
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

// -----------------------------------------------------------
// Costruisce un magnet link partendo dall'infoHash
// -----------------------------------------------------------
function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const trackerParams = TRACKERS
    .map(t => "&tr=" + encodeURIComponent(t))
    .join("");
  return "magnet:?xt=urn:btih:" + infoHash + trackerParams;
}

// -----------------------------------------------------------
// Recupera l'IMDB ID tramite TMDB API
// @param {string} tmdbId   - ID TMDB del titolo
// @param {string} mediaType - "movie" oppure "tv"
// -----------------------------------------------------------
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const url =
        "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId +
        "/external_ids?api_key=" + TMDB_API_KEY + "&language=it-IT";

      const data = yield (yield fetch(url, { skipSizeCheck: true })).json();

      return (
        data?.external_ids?.imdb_id ||
        data?.imdb_id ||
        null
      );
    } catch (e) {
      return null;
    }
  });
}

// -----------------------------------------------------------
// Chiama l'API di Torrentio e restituisce i flussi
// @param {string}      imdbId  - IMDB ID
// @param {number|null} season  - stagione (solo per TV)
// @param {number|null} episode - episodio (solo per TV)
// -----------------------------------------------------------
function invokeTorrentio(imdbId, season, episode) {
  return __async(this, null, function* () {
    try {
      const isTv = season != null && episode != null;
      const url = isTv
        ? TORRENTIO_API + "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json"
        : TORRENTIO_API + "/stream/movie/" + imdbId + ".json";

      console.log("[TORRENTIO] Fetching:", url);

      const response = yield fetch(url, { headers: HEADERS, skipSizeCheck: true });
      const body = yield response.json();

      if (!body || !body.streams) {
        console.log("[TORRENTIO] No streams");
        return [];
      }

      const results = [];

      // Parole chiave che indicano audio/lingua italiana
      const ITA_KEYWORDS = [
        "ita", "italian", "italiano",
        "dual", "multi",          // spesso includono l'italiano
        "ita/eng", "eng/ita"
      ];

      for (const stream of body.streams.slice(0, 15)) {
        try {
          const title      = stream.title || "";
          const titleLower = title.toLowerCase();

          // Filtra: tieni solo stream con traccia italiana
          const hasItalian = ITA_KEYWORDS.some(kw => titleLower.includes(kw));
          if (!hasItalian) continue;

          const quality = extractQuality(title);
          const seeders = (title.match(/👤\s*(\d+)/) ?? [])[1] || "?";
          const magnet  = buildMagnet(stream.infoHash);

          if (!magnet) continue;

          results.push({
            url:       magnet,
            quality:   quality,
            title:     "🇮🇹 " + quality + " | 👤 " + seeders,
            subtitles: []
          });
        } catch (_) { /* salta stream malformato */ }
      }

      return results;

    } catch (err) {
      console.log("[TORRENTIO] Error:", err);
      return [];
    }
  });
}

// -----------------------------------------------------------
// Funzione principale esportata
// @param {string} tmdbId    - ID TMDB
// @param {string} mediaType - "movie" | "tv"
// @param {number} season    - stagione (TV)
// @param {number} episode   - episodio (TV)
// -----------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const imdbId = yield getImdbId(tmdbId, mediaType);

      if (!imdbId) {
        console.log("[TORRENTIO] IMDB ID not found");
        return [];
      }

      console.log("[TORRENTIO] IMDB ID:", imdbId);

      const streams = yield invokeTorrentio(
        imdbId,
        mediaType === "tv" ? season  : null,
        mediaType === "tv" ? episode : null
      );

      return streams;

    } catch (err) {
      console.log("[TORRENTIO] getStreams error:", err);
      return [];
    }
  });
}

module.exports = { getStreams };
