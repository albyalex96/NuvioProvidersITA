/**
 * torbox - Built from src/torbox/
 * Generated: 2026-05-23T14:32:02.768Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/torbox/index.js
var torbox_exports = {};
__export(torbox_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(torbox_exports);

// src/torbox/http.js
var BASE_URL = "https://api.torbox.app/v1/api";
function apiGet(path, params, apiKey) {
  return __async(this, null, function* () {
    const url = new URL(BASE_URL + path);
    if (params) {
      Object.keys(params).forEach((k) => {
        if (params[k] !== null && params[k] !== void 0) {
          url.searchParams.set(k, String(params[k]));
        }
      });
    }
    const response = yield fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error("TorBox HTTP error: " + response.status);
    }
    return response.json();
  });
}
function apiPost(path, body, apiKey) {
  return __async(this, null, function* () {
    const response = yield fetch(BASE_URL + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error("TorBox HTTP error: " + response.status);
    }
    return response.json();
  });
}

// src/torbox/extractor.js
var API_BASE = "https://api.torbox.app/v1/api";
function buildQuery(tmdbId, mediaType, season, episode) {
  let query = "tmdb:" + tmdbId;
  if (mediaType === "tv" && season != null && episode != null) {
    const s = String(season).padStart(2, "0");
    const e = String(episode).padStart(2, "0");
    query += " S" + s + "E" + e;
  }
  return query;
}
function parseQuality(name) {
  if (!name)
    return "Unknown";
  const n = name.toLowerCase();
  if (n.includes("2160p") || n.includes("4k") || n.includes("uhd"))
    return "4K";
  if (n.includes("1080p"))
    return "1080p";
  if (n.includes("720p"))
    return "720p";
  if (n.includes("480p"))
    return "480p";
  return "Unknown";
}
function isVideoFile(name) {
  if (!name)
    return false;
  const ext = name.split(".").pop().toLowerCase();
  return ["mkv", "mp4", "avi", "mov", "wmv", "m4v", "ts", "webm"].includes(ext);
}
function sortTorrents(torrents) {
  return torrents.slice().sort((a, b) => {
    const aCached = a.cached ? 1 : 0;
    const bCached = b.cached ? 1 : 0;
    if (bCached !== aCached)
      return bCached - aCached;
    return (b.seeders || 0) - (a.seeders || 0);
  });
}
function searchTorrents(query, apiKey) {
  return __async(this, null, function* () {
    const resp = yield apiGet(
      "/torrents/search",
      { query, limit: 20 },
      apiKey
    );
    if (!resp.success || !resp.data) {
      console.log("[TorBox] Search returned no data:", resp.detail);
      return [];
    }
    const list = Array.isArray(resp.data) ? resp.data : resp.data.torrents || [];
    console.log("[TorBox] Search found " + list.length + " result(s)");
    return list;
  });
}
function addTorrent(hash, name, apiKey) {
  return __async(this, null, function* () {
    try {
      const magnet = "magnet:?xt=urn:btih:" + hash;
      const resp = yield apiPost(
        "/torrents/createtorrent",
        { magnet, name, as_queued: false },
        apiKey
      );
      if (resp.success && resp.data) {
        const torrentId = resp.data.torrent_id || resp.data.id;
        console.log("[TorBox] Added torrent, id=" + torrentId);
        return torrentId;
      }
      if (resp.error === "DUPLICATE_ITEM" && resp.data) {
        const torrentId = resp.data.torrent_id || resp.data.id;
        console.log("[TorBox] Duplicate, existing id=" + torrentId);
        return torrentId;
      }
      console.log("[TorBox] addTorrent failed:", resp.detail);
      return null;
    } catch (err) {
      console.log("[TorBox] addTorrent error:", err.message);
      return null;
    }
  });
}
function getTorrentFiles(torrentId, apiKey) {
  return __async(this, null, function* () {
    try {
      const resp = yield apiGet(
        "/torrents/mylist",
        { id: torrentId, bypass_cache: "true" },
        apiKey
      );
      if (!resp.success || !resp.data)
        return [];
      const torrent = Array.isArray(resp.data) ? resp.data[0] : resp.data;
      return torrent && torrent.files ? torrent.files : [];
    } catch (err) {
      console.log("[TorBox] getTorrentFiles error:", err.message);
      return [];
    }
  });
}
function buildStreamUrl(apiKey, torrentId, fileId) {
  return API_BASE + "/torrents/requestdl?token=" + apiKey + "&torrent_id=" + torrentId + "&file_id=" + fileId + "&redirect=true";
}
function extractStreams(tmdbId, mediaType, season, episode, apiKey) {
  return __async(this, null, function* () {
    const streams = [];
    const query = buildQuery(tmdbId, mediaType, season, episode);
    console.log("[TorBox] Query:", query);
    const results = yield searchTorrents(query, apiKey);
    if (results.length === 0) {
      console.log("[TorBox] No torrents found");
      return streams;
    }
    const sorted = sortTorrents(results);
    const candidates = sorted.slice(0, 5);
    for (let i = 0; i < candidates.length; i++) {
      const torrent = candidates[i];
      const hash = torrent.hash || torrent.info_hash;
      const torrentName = torrent.name || "TorBox #" + i;
      if (!hash)
        continue;
      console.log("[TorBox] Processing: " + torrentName);
      const torrentId = yield addTorrent(hash, torrentName, apiKey);
      if (!torrentId)
        continue;
      const files = yield getTorrentFiles(torrentId, apiKey);
      const videoFiles = files.filter((f) => isVideoFile(f.name || f.short_name || ""));
      if (videoFiles.length === 0) {
        const url = buildStreamUrl(apiKey, torrentId, 0);
        const quality = parseQuality(torrentName);
        streams.push({
          name: "TorBox",
          title: quality + " \xB7 " + torrentName.substring(0, 60),
          url,
          quality
        });
        continue;
      }
      for (let j = 0; j < videoFiles.length; j++) {
        const file = videoFiles[j];
        const fileId = file.id;
        const fileName = file.name || file.short_name || "File " + j;
        const url = buildStreamUrl(apiKey, torrentId, fileId);
        const quality = parseQuality(torrentName + " " + fileName);
        streams.push({
          name: "TorBox",
          title: quality + " \xB7 " + fileName.substring(0, 60),
          url,
          quality
        });
      }
    }
    console.log("[TorBox] Total streams built:", streams.length);
    return streams;
  });
}

// src/torbox/index.js
function getApiKey() {
  if (typeof globalThis !== "undefined" && globalThis.SCRAPER_SETTINGS && globalThis.SCRAPER_SETTINGS.torbox_api_key) {
    return globalThis.SCRAPER_SETTINGS.torbox_api_key;
  }
  return null;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.log(
        "[TorBox] No API key found. Set globalThis.SCRAPER_SETTINGS.torbox_api_key"
      );
      return [];
    }
    try {
      const streams = yield extractStreams(tmdbId, mediaType, season, episode, apiKey);
      return streams;
    } catch (err) {
      console.log("[TorBox] Unexpected error in getStreams:", err.message);
      return [];
    }
  });
}
