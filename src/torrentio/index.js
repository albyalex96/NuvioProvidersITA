/**
 * Template Provider
 * Main entry point.
 */

import { extractStreams , getImdbId } from './extractor.js';

/**
 * Main function called by Nuvio
 * @param {string} tmdbId - TMDB ID of the media
 * @param {string} mediaType - 'movie' or 'tv'
 * @param {number} season - Season number (for TV)
 * @param {number} episode - Episode number (for TV)
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[TorrentIO] Request: ${mediaType} ${tmdbId}`);

        const imdbId = await getImdbId(tmdbId, mediaType);

        if (!imdbId) {
        console.log("[TORRENTIO] IMDB ID not found");
        return [];
        }
        
        const streams = await extractStreams(tmdbId, mediaType, season, episode);

        return streams;
    } catch (error) {
        console.error(`[TorrentIO] Error: ${error.message}`);
        return [];
    }
}



module.exports = { getStreams };
