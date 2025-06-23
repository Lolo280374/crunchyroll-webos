import type { Callback, State, Template } from "./vine"
import { $, fire, on, off, trigger, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

declare var Hls: any

// Add these variables at the top of your file if they don't exist already
let dashPlayer: any = null;
let streamTimeout: number | null = null;
let playbackStarted = false;

let hls = null
let area: HTMLElement = null
let video: HTMLVideoElement = null
let playing = false
let trackTimeout = null
let lastPlayhead = 0

/**
 * Initial state
 * @returns
 */
const state: State = () => {
    return {
        serieId: String(Route.getParam('serieId') || ''),
        seasonId: String(Route.getParam('seasonId') || ''),
        episodeId: String(Route.getParam('episodeId') || ''),
        videoId: String(Route.getParam('videoId') || ''),
    }
}

/**
 * Return template
 * @param component
 * @returns
 */
const template: Template = async ({ state }) => {
    return await App.getTemplate('video', state)
}

/**
 * Format time
 * @param time
 * @returns
 */
const formatTime = (time: number) => {

    if (!time) {
        time = 0
    }

    const result = new Date(time * 1000).toISOString().substring(11, 19)
    const minutes = result.substring(3, 5)
    const seconds = result.substring(6, 8)

    return {
        m: minutes,
        s: seconds
    }
}

/**
 * Show error message
 * @param message
 */
const showError = (message: string) => {

    const error = $('.video-error', area)

    area.classList.add('video-has-error')
    error.innerHTML = message

    const closeButton = $('.video-close', area)
    fire('active::element::set', closeButton)
    fire('loading::hide')

}

/**
 * Show video
 */
const showVideo = async () => {
    area.classList.add('video-is-active')
}

/**
 * Hide video
 */
const hideVideo = () => {

    area.classList.remove('video-is-active')

    if (document.fullscreenElement) {
        document.exitFullscreen()
    }

}

/**
 * Load episode
 * @param component
 */

const loadEpisode: Callback = async ({ state }) => {
    const episodeId = state.episodeId;
    const episodeResponse = await App.episode(episodeId, {});
    
// For testing - try a known working ID
const testVideoId = "GG1U28242"; // Wind Breaker episode
console.log("Testing with hardcoded ID:", testVideoId);
const testResponse = await App.modernStreams(testVideoId);
console.log("Test response:", testResponse.error ? "Error" : "Success");

    if (episodeResponse.error) {
        throw Error(`Episode info error: ${episodeResponse.errorMessage || 'Unknown error'}`);
    }
    
    const episodeInfo = episodeResponse.data[0];
    const episodeMetadata = episodeInfo.episode_metadata;

    const serieName = episodeMetadata.series_title;
    const seasonNumber = episodeMetadata.season_number;
    const episodeNumber = episodeMetadata.episode_number || episodeMetadata.episode;
    const episodeName = episodeInfo.title;

    // Log the entire episode response to find the right format
    console.log("Full episode response:", JSON.stringify(episodeInfo));

    // Extract the new format videoId (looks like GG1U28242)
    let videoId = '';
    
    // Check if the episode data has a 'versions' array
    if (Array.isArray(episodeInfo.versions) && episodeInfo.versions.length > 0) {
        // Get user's preferred audio language
        const preferredAudio = localStorage.getItem('preferredContentAudioLanguage');
        
        // Try to find a version matching the preferred language
        let matchedVersion = episodeInfo.versions.find(v => v.audio_locale === preferredAudio);
        
        // If no match for preferred language, use the first version
        if (!matchedVersion && episodeInfo.versions.length > 0) {
            matchedVersion = episodeInfo.versions[0];
        }
        
        if (matchedVersion && matchedVersion.guid) {
            videoId = matchedVersion.guid;
            console.log(`Using version GUID as videoId: ${videoId}`);
        }
    }
    
    // If we still don't have a videoId, try other sources
    if (!videoId) {
        if (episodeInfo.guid) {
            videoId = episodeInfo.guid;
            console.log(`Using episode GUID as videoId: ${videoId}`);
        } else if (episodeInfo.media_id) {
            videoId = episodeInfo.media_id;
            console.log(`Using media_id as videoId: ${videoId}`);
        } else if (episodeInfo.id && episodeInfo.id.includes('G')) {
            // Some episodes have a G-prefixed ID directly in the id field
            videoId = episodeInfo.id;
            console.log(`Using episode.id as videoId: ${videoId}`);
        } else {
            // Last resort - use the episodeId
            videoId = episodeId;
            console.log(`Using episodeId as videoId: ${videoId}`);
        }
    }
    
    // If the videoId doesn't start with G, it's probably not a valid GUID
    if (videoId && !videoId.includes('G')) {
        console.warn(`Warning: videoId ${videoId} doesn't look like a valid GUID (should start with G)`);
    }
    
    state.videoId = videoId;
    
    // Rest of the function remains unchanged
    const serie = $('.video-serie', area);
    serie.innerHTML = serieName + ' / S' + seasonNumber + ' / E' + episodeNumber;

    const title = $('.video-title', area);
    title.innerHTML = episodeName;

    const serieId = state.serieId;
    const seasonId = state.seasonId;
    const episodesUrl = '/serie/' + serieId + '/season/' + seasonId;

    const episodes = $('.video-episodes', area);
    episodes.dataset.url = episodesUrl;
}

/**
 * Load next and previous episodes
 * @param component
 */
const loadClosestEpisodes: Callback = async ({ state }) => {

    const episodeId = state.episodeId
    const previousResponse = await App.previousEpisode(episodeId, {})
    const nextResponse = await App.upNext(episodeId, {})

    const previous = $('.video-previous-episode', area)
    previous.classList.add('hide')

    if( previousResponse.data && previousResponse.data.length ){
        const item = previousResponse.data[0].panel
        const metadata = item.episode_metadata
        const serieId = metadata.series_id
        const seasonId = metadata.season_id
        const episodeId = item.id
        const seasonNumber = metadata.season_number
        const episodeNumber = metadata.episode_number || metadata.episode
        const episodeUrl = '/serie/' + serieId + '/season/' + seasonId + '/episode/' + episodeId + '/video'

        previous.dataset.url = episodeUrl
        previous.title = 'Previous Episode - S' + seasonNumber + ' / E' + episodeNumber
        previous.classList.remove('hide')
    }

    const next = $('.video-next-episode', area)
    next.classList.add('hide')

    if( nextResponse.data && nextResponse.data.length ){
        const item = nextResponse.data[0].panel
        const metadata = item.episode_metadata
        const serieId = metadata.series_id
        const seasonId = metadata.season_id
        const episodeId = item.id
        const seasonNumber = metadata.season_number
        const episodeNumber = metadata.episode_number || metadata.episode
        const episodeUrl = '/serie/' + serieId + '/season/' + seasonId + '/episode/' + episodeId + '/video'

        next.dataset.url = episodeUrl
        next.title = 'Next Episode - S' + seasonNumber + ' / E' + episodeNumber
        next.classList.remove('hide')
    }

}

/**
 * Stream video
 * @param component
 */
const streamVideo: Callback = async ({ state }) => {
    const episodeId = state.episodeId;
    const videoId = state.videoId;

    // Clear existing timeout if any
    if (streamTimeout !== null) {
        clearTimeout(streamTimeout);
        streamTimeout = null;
    }
    
    // Reset playback flag
    playbackStarted = false;

    console.log("DASH.js available:", typeof window.dashjs !== 'undefined');

    // Get playhead info
    const playheadResponse = await App.playHeads([episodeId], {});
    let playhead = 0;
    let duration = 0;

    if (playheadResponse && playheadResponse.data && playheadResponse.data.length) {
        playhead = playheadResponse.data[0].playhead;
        duration = playheadResponse.data[0].duration;
    }

    // Reset playhead if near the end or very beginning
    if (playhead / duration > 0.90 || playhead < 30) {
        playhead = 0;
    }

    // Set up improved diagnostics
    video.addEventListener('loadstart', () => console.log("Video: loadstart"));
    video.addEventListener('loadedmetadata', () => console.log("Video: loadedmetadata"));
    video.addEventListener('canplay', () => {
        console.log("Video: canplay");
        if (!playbackStarted) {
            playbackStarted = true;
            area.classList.remove('video-is-loading');
            area.classList.add('video-is-loaded');
        }
    });
    video.addEventListener('playing', () => {
        console.log("Video: playing");
        if (!playbackStarted) {
            playbackStarted = true;
            area.classList.remove('video-is-loading');
            area.classList.add('video-is-loaded');
        }
    });
    video.addEventListener('error', (e) => {
        console.error("Video error:", video.error);
    });

    try {
        console.log("Attempting to use modern streaming API...");
        
        // Get the current access token
        const accessToken = localStorage.getItem('accessToken');
        console.log("Using access token:", accessToken ? "Present" : "Missing");
        
        // Get stream info from the modern API
        const modernResponse = await App.modernStreams(videoId);
        
        if (!modernResponse.error && (modernResponse.url || (modernResponse.hardSubs && Object.keys(modernResponse.hardSubs).length))) {
            console.log("Modern streaming API successful!");
            console.log("Stream data:", JSON.stringify(modernResponse).substring(0, 500) + "...");
            
            // Choose the appropriate stream URL
            let stream = '';
            const locale = localStorage.getItem('preferredContentSubtitleLanguage');
            
            // Check if we have hardSubs in the preferred language
            if (modernResponse.hardSubs && modernResponse.hardSubs[locale]) {
                stream = modernResponse.hardSubs[locale].url;
                console.log(`Using hardsub URL for locale ${locale}`);
            } else if (modernResponse.url) {
                // Otherwise use the main URL
                stream = modernResponse.url;
                console.log("Using main URL");
            }

            if (!stream) {
                throw Error('No streams to load.');
            }
            
            // Print the stream URL for debugging
            console.log(`Full stream URL: ${stream}`);
            
            // Handle proxy if needed
            const proxyUrl = document.body.dataset.proxyUrl;
            const proxyEncode = document.body.dataset.proxyEncode;
            if (proxyUrl) {
                stream = proxyUrl + (proxyEncode === "true" ? encodeURIComponent(stream) : stream);
            }

            area.classList.add('video-is-loading');

            // IMPORTANT: Check if we can get an HLS stream instead - usually better supported
            // Let's try to modify the URL to request HLS instead of DASH
            if (stream.indexOf('.mpd') !== -1 || stream.indexOf('manifest.mpd') !== -1) {
                console.log("WEBOS 3.5 DASH PLAYBACK APPROACH");
                
                // Try to get an HLS version by modifying the URL
                var possibleHlsUrl = null;
                
                // Some services allow format switching by changing the URL
                if (stream.indexOf('format=dash') !== -1) {
                    possibleHlsUrl = stream.replace('format=dash', 'format=hls');
                } else if (stream.indexOf('.urlset/manifest.mpd') !== -1) {
                    possibleHlsUrl = stream.replace('.urlset/manifest.mpd', '/master.m3u8');
                } else if (stream.indexOf('.mpd') !== -1) {
                    possibleHlsUrl = stream.replace('.mpd', '.m3u8');
                }
                
                // If we created a possible HLS URL, try to fetch it to verify
                if (possibleHlsUrl) {
                    console.log("Trying possible HLS URL:", possibleHlsUrl);
                    
                    return await new Promise((resolve) => {
                        var hlsCheckXhr = new XMLHttpRequest();
                        hlsCheckXhr.open('HEAD', possibleHlsUrl, true);
                        hlsCheckXhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                        
                        hlsCheckXhr.onload = function() {
                            if (hlsCheckXhr.status === 200) {
                                console.log("HLS version found! Using HLS stream instead of DASH");
                                playHlsStream(possibleHlsUrl, accessToken, playhead, resolve);
                            } else {
                                console.log("HLS version not available, proceeding with improved DASH approach");
                                tryImprovedDashToMp4(stream, accessToken, playhead, resolve);
                            }
                        };
                        
                        hlsCheckXhr.onerror = function() {
                            console.log("Error checking HLS URL, proceeding with DASH approach");
                            tryImprovedDashToMp4(stream, accessToken, playhead, resolve);
                        };
                        
                        hlsCheckXhr.send();
                    });
                } else {
                    return await new Promise((resolve) => {
                        tryImprovedDashToMp4(stream, accessToken, playhead, resolve);
                    });
                }
            } else {
                // This is an HLS stream - use HLS.js
                console.log("Using HLS.js for HLS stream");
                
                return await new Promise((resolve) => {
                    playHlsStream(stream, accessToken, playhead, resolve);
                });
            }
        } else {
            console.log("Modern API didn't return valid stream info, falling back to legacy API");
            throw new Error("Modern API failed");
        }
    } catch (error) {
        console.error("Modern streaming failed:", error);
        
        // Directly try legacy streaming
        return await new Promise((resolve) => {
            tryLegacyStreaming(videoId, 0, resolve);
        });
    }
};

/**
 * Try improved DASH to MP4 conversion
 */
function tryImprovedDashToMp4(stream, accessToken, playhead, resolve) {
    // Clean up any existing players
    if (hls) {
        hls.destroy();
        hls = null;
    }
    if (dashPlayer) {
        dashPlayer.destroy();
        dashPlayer = null;
    }
    
    console.log("Attempting improved DASH to MP4 extraction");
    
    // First, fetch the actual MPD content to analyze the structure
    var xhr = new XMLHttpRequest();
    xhr.open('GET', stream, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    
    xhr.onload = function() {
        if (xhr.status === 200) {
            var mpd = xhr.responseText;
            console.log("Got MPD content, length:", mpd.length);
            
            // Log part of the MPD for debugging
            console.log("MPD snippet:", mpd.substring(0, 300));
            
            // Look for akamaized URLs which are typically direct CDN links
            var akamaizedMatch = mpd.match(/https:\/\/[^"']+akamaized\.net[^"']+\.mp4/);
            if (akamaizedMatch) {
                var akamaizedUrl = akamaizedMatch[0];
                console.log("Found Akamaized URL:", akamaizedUrl);
                
                // Try playing with the Akamaized URL directly
                playWithDirectUrl(akamaizedUrl, accessToken, playhead, resolve);
                return;
            }
            
            // Look for direct segment references in the URL first
            if (stream.indexOf('.mp4') !== -1) {
                var parts = stream.split('_,');
                if (parts.length > 1) {
                    var urlBasePrefix = parts[0] + '_';
                    var segments = parts[1].split(',');
                    
                    var mp4Segments = [];
                    for (var i = 0; i < segments.length; i++) {
                        if (segments[i].indexOf('.mp4') !== -1) {
                            mp4Segments.push(segments[i].split(',')[0]);
                        }
                    }
                    
                    if (mp4Segments.length > 0) {
                        // Find a better quality segment - second or third is usually good
                        var segmentIndex = Math.min(1, mp4Segments.length - 1); 
                        var directUrl = urlBasePrefix + mp4Segments[segmentIndex];
                        
                        console.log("USING DIRECT SEGMENT:", directUrl);
                        
                        // The correct approach: Change '.mp4,' to just '.mp4'
                        directUrl = directUrl.replace('.mp4,', '.mp4');
                        
                        // Try to play this direct URL
                        playWithDirectUrl(directUrl, accessToken, playhead, resolve);
                        return;
                    }
                }
            }
            
            // If we can't extract from the URL, look for initialization segments in the MPD
            var initSegmentMatch = mpd.match(/initialization="([^"]+)"/);
            if (initSegmentMatch) {
                var initSegment = initSegmentMatch[1];
                console.log("Found initialization segment:", initSegment);
                
                // Construct the full URL if it's relative
                var fullInitUrl = initSegment;
                if (initSegment.indexOf('http') !== 0) {
                    var pathBase = stream.substring(0, stream.lastIndexOf('/') + 1);
                    fullInitUrl = pathBase + initSegment;
                }
                
                console.log("Trying initialization segment URL:", fullInitUrl);
                playWithDirectUrl(fullInitUrl, accessToken, playhead, resolve);
                return;
            }
            
            // Last resort: Try to convert to HLS if possible
            tryModifiedHlsUrl(stream, accessToken, playhead, resolve);
        } else {
            console.error("Failed to fetch MPD:", xhr.status);
            tryLegacyStreaming(null, playhead, resolve);
        }
    };
    
    xhr.onerror = function() {
        console.error("Error fetching MPD");
        tryLegacyStreaming(null, playhead, resolve);
    };
    
    xhr.send();
}

/**
 * Try to play with a direct URL 
 */
function playWithDirectUrl(url, accessToken, playhead, resolve) {
    console.log("Playing with direct URL:", url);
    
    // IMPORTANT FIX: Process multi-segment Akamaized URLs properly
    if (url.indexOf('_,') !== -1 && url.indexOf('.mp4,') !== -1) {
        console.log("Detected multi-segment URL - extracting single segment");
        
        // Extract the base part and pick one segment
        var baseUrlPart = url.substring(0, url.indexOf('_,') + 2); // Include the '_,'
        var segmentsPart = url.substring(url.indexOf('_,') + 2);
        var segments = segmentsPart.split(',');
        
        // Find MP4 segments
        var mp4Segments = [];
        for (var i = 0; i < segments.length; i++) {
            if (segments[i].indexOf('.mp4') !== -1) {
                mp4Segments.push(segments[i]);
            }
        }
        
        if (mp4Segments.length > 0) {
            // Choose a medium quality segment (often 2nd or 3rd is good)
            // The segments are usually in quality order
            var chosenIndex = Math.min(1, mp4Segments.length - 1);
            
            // Create clean URL for the chosen segment
            url = baseUrlPart + mp4Segments[chosenIndex];
            console.log("Selected single MP4 segment:", url);
            
            // Fix URL ending if needed (remove any trailing commas)
            if (url.indexOf('.mp4,') !== -1) {
                url = url.replace('.mp4,', '.mp4');
            }
        }
    }
    
    // Rest of the function remains the same...
    // Clear video element
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('type');
    video.load();
    
    // Create a special video source tag with custom request headers
    var source = document.createElement('source');
    source.src = url;
    source.type = 'video/mp4';
    
    // Add authorization via DOM element
    var meta = document.createElement('meta');
    meta.setAttribute('httpEquiv', 'Authorization');
    meta.setAttribute('content', 'Bearer ' + accessToken);
    document.head.appendChild(meta);
    
    // Set up video
    video.appendChild(source);
    
    if (playhead > 0) {
        video.currentTime = playhead;
    }
    
    // Track success/failure
    var successHandler = function() {
        console.log("Direct URL playback started!");
        video.removeEventListener('playing', successHandler);
        video.removeEventListener('error', errorHandler);
        
        if (streamTimeout !== null) {
            clearTimeout(streamTimeout);
            streamTimeout = null;
        }
        
        playbackStarted = true;
        area.classList.remove('video-is-loading');
        area.classList.add('video-is-loaded');
        resolve(null);
    };
    
    var errorHandler = function() {
        console.error("Direct URL playback error:", video.error);
        video.removeEventListener('playing', successHandler);
        video.removeEventListener('error', errorHandler);
        
        if (streamTimeout !== null) {
            clearTimeout(streamTimeout);
            streamTimeout = null;
        }
        
        tryModifiedHlsUrl(url, accessToken, playhead, resolve);
    };
    
    video.addEventListener('playing', successHandler);
    video.addEventListener('error', errorHandler);
    
    // Set timeout for fallback
    streamTimeout = setTimeout(function() {
        if (!playbackStarted) {
            console.log("Direct URL playback timeout");
            video.removeEventListener('playing', successHandler);
            video.removeEventListener('error', errorHandler);
            tryModifiedHlsUrl(url, accessToken, playhead, resolve);
        }
    }, 10000);
    
    // Start playback
    video.load();
    try {
        video.play();
    } catch (e) {
        console.error("Error playing video:", e);
        errorHandler();
    }
}

/**
 * Try using a modified HLS URL as last resort
 */
function tryModifiedHlsUrl(url, accessToken, playhead, resolve) {
    console.log("Trying to create an HLS URL from:", url);
    
    var hlsUrl = url;
    
    // Try various URL transformations
    if (url.indexOf('.mpd') !== -1) {
        hlsUrl = url.replace('.mpd', '.m3u8');
    } else if (url.indexOf('format=dash') !== -1) {
        hlsUrl = url.replace('format=dash', 'format=hls');
    } else if (url.indexOf('dash') !== -1) {
        hlsUrl = url.replace('dash', 'hls');
    }
    
    if (hlsUrl !== url) {
        console.log("Created possible HLS URL:", hlsUrl);
        
        // Check if this URL is accessible
        var checkXhr = new XMLHttpRequest();
        checkXhr.open('HEAD', hlsUrl, true);
        if (accessToken) {
            checkXhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
        }
        
        checkXhr.onload = function() {
            if (checkXhr.status === 200) {
                console.log("Modified HLS URL works! Using HLS stream");
                playHlsStream(hlsUrl, accessToken, playhead, resolve);
            } else {
                console.log("Modified HLS URL failed, falling back to legacy");
                tryLegacyStreaming(null, playhead, resolve);
            }
        };
        
        checkXhr.onerror = function() {
            console.log("Error checking modified HLS URL, falling back to legacy");
            tryLegacyStreaming(null, playhead, resolve);
        };
        
        checkXhr.send();
    } else {
        console.log("Could not create a valid HLS URL, falling back to legacy");
        tryLegacyStreaming(null, playhead, resolve);
    }
}

/**
 * Play an HLS stream
 */
function playHlsStream(stream, accessToken, playhead, resolve) {
    if (!Hls.isSupported()) {
        console.error("HLS.js not supported on this device");
        tryLegacyStreaming(null, playhead, resolve);
        return;
    }

    console.log("Playing HLS stream:", stream.substring(0, 100) + "...");
    
    // Clean up any existing players
    if (hls) {
        hls.destroy();
        hls = null;
    }
    if (dashPlayer) {
        dashPlayer.destroy();
        dashPlayer = null;
    }
    
    // Configure HLS.js
    hls = new Hls({
        autoStartLoad: false,
        startLevel: -1,
        maxBufferLength: 15,
        backBufferLength: 15,
        maxBufferSize: 30 * 1000 * 1000,
        maxFragLookUpTolerance: 0.2,
        nudgeMaxRetry: 10,
        // Critical for WebOS 3.5 - add auth headers
        xhrSetup: function(xhr, url) {
            if (accessToken) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                console.log("Added Authorization header to HLS request");
            }
        }
    });

    // Set up HLS events
    hls.on(Hls.Events.MEDIA_ATTACHED, function() {
        console.log("HLS: media attached, loading source");
        hls.loadSource(stream);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, function() {
        console.log("HLS: manifest parsed, starting load from", playhead);
        hls.startLoad(playhead);
    });

    hls.on(Hls.Events.LEVEL_LOADED, function() {
        console.log("HLS: level loaded");
        playbackStarted = true;
        area.classList.remove('video-is-loading');
        area.classList.add('video-is-loaded');
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, function() {
        var quality = $('.video-quality', area);
        var level = hls.levels[hls.currentLevel];
        var next = hls.currentLevel - 1;

        if (next < -1) {
            next = hls.levels.length - 1;
        }

        quality.dataset.next = next;
        $('span', quality).innerText = level.height + 'p';
    });

    hls.once(Hls.Events.FRAG_LOADED, function() {
        console.log("HLS: fragment loaded");
        resolve(null);
    });

    hls.on(Hls.Events.ERROR, function(_event, data) {
        console.error("HLS error:", data);
        
        if (!data.fatal) {
            return;
        }

        switch (data.type) {
            case Hls.ErrorTypes.OTHER_ERROR:
                hls.startLoad();
                break;
            case Hls.ErrorTypes.NETWORK_ERROR:
                if (data.details === 'manifestLoadError') {
                    console.error("HLS manifest load error");
                    tryLegacyStreaming(null, playhead, resolve);
                } else {
                    hls.startLoad();
                }
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("HLS media error, trying recovery");
                hls.recoverMediaError();
                break;
            default:
                console.error("HLS fatal error:", data.details);
                tryLegacyStreaming(null, playhead, resolve);
                break;
        }
    });

    // Attach media
    console.log("Attaching media to HLS player");
    hls.attachMedia(video);
    
    // Set timeout for fallback
    streamTimeout = setTimeout(function() {
        if (!playbackStarted) {
            console.log("HLS playback failed to start, trying legacy");
            tryLegacyStreaming(null, playhead, resolve);
        }
    }, 15000);
}

/**
 * Function to try the legacy API approach
 */
function tryLegacyStreaming(videoId, playhead, resolve) {
    // Clear any existing timeout
    if (streamTimeout !== null) {
        clearTimeout(streamTimeout);
        streamTimeout = null;
    }
    
    console.log("Attempting legacy streaming method");
    
    if (!videoId) {
        showError("Playback failed. Video format not supported by this device.");
        resolve(null);
        return;
    }
    
    // Use your existing legacy streaming code here
    // This is the same as your original implementation
    (async () => {
        try {
            console.log("Fetching stream info from legacy API");
            const streamsResponse = await App.streams(videoId, {});
            
            console.log("Legacy API response:", JSON.stringify(streamsResponse).substring(0, 500) + "...");
            
            if (streamsResponse.error) {
                throw Error(`Stream API error: ${streamsResponse.errorMessage || 'Unknown error'}`);
            }
            
            if (!streamsResponse || !streamsResponse.streams) {
                throw Error('Streams not available for this episode.');
            }

            const streams = streamsResponse.streams.adaptive_hls || [];
            const locale = localStorage.getItem('preferredContentSubtitleLanguage');
            const priorities = [locale, ''];

            let stream = '';
            priorities.forEach((locale) => {
                if (streams[locale] && !stream) {
                    stream = streams[locale].url;
                }
            });

            if (!stream) {
                throw Error('No streams to load.');
            }

            console.log(`Legacy stream URL (first 100 chars): ${stream.substring(0, 100)}...`);
            
            const proxyUrl = document.body.dataset.proxyUrl;
            const proxyEncode = document.body.dataset.proxyEncode;
            if (proxyUrl) {
                stream = proxyUrl + (proxyEncode === "true" ? encodeURIComponent(stream) : stream);
            }

            area.classList.add('video-is-loading');

            // Clean up any existing players
            if (hls) {
                hls.destroy();
                hls = null;
            }
            if (dashPlayer) {
                dashPlayer.destroy();
                dashPlayer = null;
            }

            if (!Hls.isSupported()) {
                throw Error('HLS format not supported on this device.');
            }

            // Configure HLS.js
            hls = new Hls({
                autoStartLoad: false,
                startLevel: -1,
                maxBufferLength: 15,
                backBufferLength: 15,
                maxBufferSize: 30 * 1000 * 1000,
                maxFragLookUpTolerance: 0.2,
                nudgeMaxRetry: 10
            });

            // Set up HLS events 
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(stream);
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                hls.startLoad(playhead);
            });

            hls.on(Hls.Events.LEVEL_LOADED, () => {
                area.classList.remove('video-is-loading');
                area.classList.add('video-is-loaded');
                playbackStarted = true;
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, () => {
                let quality = $('.video-quality', area);
                let level = hls.levels[hls.currentLevel];
                let next = hls.currentLevel - 1;

                if (next < -1) {
                    next = hls.levels.length - 1;
                }

                quality.dataset.next = next;
                $('span', quality).innerText = level.height + 'p';
            });

            hls.once(Hls.Events.FRAG_LOADED, () => {
                resolve(null);
            });

            hls.on(Hls.Events.ERROR, (_event: Event, data: any) => {
                if (!data.fatal) {
                    return;
                }

                switch (data.type) {
                    case Hls.ErrorTypes.OTHER_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        if (data.details == 'manifestLoadError') {
                            showError('Episode cannot be played because of CORS error. You must use a proxy.');
                        } else {
                            hls.startLoad();
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        showError('Media error: trying recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        showError('Media cannot be recovered: ' + data.details);
                        hls.destroy();
                        break;
                }
            });

            // Attach media
            console.log("Attaching media to legacy HLS player");
            hls.attachMedia(video);
            
            streamTimeout = setTimeout(() => {
                if (!playbackStarted) {
                    console.log("Legacy playback failed to start");
                    showError('Unable to play video. Format not supported by this device.');
                    resolve(null);
                }
            }, 15000) as unknown as number;
            
        } catch (error) {
            console.error("Legacy API failed:", error);
            showError('Unable to play video: ' + (error.message || 'Unknown error'));
            resolve(null);
        }
    })();
}

/**
 * Play video
 * @param component
 */
const playVideo: Callback = async (component) => {

    try {
        await video.play()
    } catch (error) {
        console.log(error.message)
    }

    area.classList.remove('video-is-paused')
    area.classList.add('video-is-playing')

    playing = true
    trackProgress(component)

}

/**
 * Pause video
 * @param component
 */
const pauseVideo: Callback = (component) => {

    video.pause()
    area.classList.remove('video-is-playing')
    area.classList.add('video-is-paused')

    playing = false
    stopTrackProgress(component)

}

/**
 * Stop video
 * @param component
 */
const stopVideo: Callback = (component) => {
    pauseVideo(component)
    skipAhead(0)
}

/**
 * Toggle video
 * @param component
 */
const toggleVideo: Callback = (component) => {
    if (playing) {
        pauseVideo(component)
    } else {
        playVideo(component)
    }
}

/**
 * Forward video
 * @param seconds
 */
const forwardVideo = (seconds: number) => {
    skipAhead(video.currentTime + seconds)
}

/**
 * Backward video
 * @param seconds
 */
const backwardVideo = (seconds: number) => {
    skipAhead(video.currentTime - seconds)
}

/**
 * Skip ahead video
 * @param skipTo
 */
const skipAhead = (skipTo: number) => {

    if (!skipTo) {
        return
    }

    const seek = $('input[type="range"]', area) as HTMLInputElement
    const progress = $('progress', area) as HTMLProgressElement

    video.currentTime = skipTo
    seek.value = String(skipTo)
    progress.value = skipTo

}

/**
 * Toggle full screen mode
 */
const toggleFullScreen = () => {

    if (document.fullscreenElement) {
        document.exitFullscreen()
    } else {
        area.requestFullscreen().catch(() => { })
    }

}

/**
 * Update seek tooltip text and position
 * @param event
 */
const updateSeekTooltip = (event: MouseEvent) => {

    const tooltip = $('.tooltip', area)
    const seek = $('input[type="range"]', area) as HTMLInputElement
    const target = event.target as HTMLElement
    const bcr = target.getBoundingClientRect()

    let offsetX = event.offsetX
    let pageX = event.pageX
    if (window.TouchEvent && event instanceof TouchEvent) {
        offsetX = event.targetTouches[0].clientX - bcr.x
        pageX = event.targetTouches[0].pageX
    }

    let max = Number(seek.max)
    let skipTo = Math.round(
        (offsetX / target.clientWidth)
        * parseInt(target.getAttribute('max'), 10)
    )

    if (skipTo > max) {
        skipTo = max
    }

    const format = formatTime(skipTo)

    seek.dataset.seek = String(skipTo)
    tooltip.textContent = format.m + ':' + format.s
    tooltip.style.left = pageX + 'px'

}

/**
 * Update video duration
 */
const updateDuration: Callback = () => {

    const duration = $('.duration', area)
    const seek = $('input[type="range"]', area) as HTMLInputElement
    const progress = $('progress', area) as HTMLProgressElement

    const time = Math.round(video.duration)
    const format = formatTime(time)

    duration.innerText = format.m + ':' + format.s
    duration.setAttribute('datetime', format.m + 'm ' + format.s + 's')

    seek.setAttribute('max', String(time))
    progress.setAttribute('max', String(time))

}

/**
 * Update video time elapsed
 */
const updateTimeElapsed: Callback = () => {

    const elapsed = $('.elapsed', area)
    const time = Math.round(video.currentTime)
    const format = formatTime(time)

    elapsed.innerText = format.m + ':' + format.s
    elapsed.setAttribute('datetime', format.m + 'm ' + format.s + 's')

}

/**
 * Update video progress
 */
const updateProgress: Callback = () => {

    const seek = $('input[type="range"]', area) as HTMLInputElement
    const progress = $('progress', area) as HTMLProgressElement

    seek.value = String(Math.floor(video.currentTime))
    progress.value = Math.floor(video.currentTime)

}

/**
 * Start progress tracking
 * @param component
 */
const trackProgress: Callback = (component) => {

    if (trackTimeout) {
        stopTrackProgress(component)
    }

    trackTimeout = setTimeout(() => {
        updatePlaybackStatus(component)
    }, 15000) // 15s

}

/**
 * Stop progress tracking
 */
const stopTrackProgress: Callback = () => {
    if (trackTimeout) {
        clearTimeout(trackTimeout)
    }
}

/**
 * Update playback status at Crunchyroll
 * @param component
 */
const updatePlaybackStatus: Callback = async (component) => {

    const episodeId = component.state.episodeId
    const playhead = Math.floor(video.currentTime)

    if (playhead != lastPlayhead) {
        await App.setProgress({}, {
            'content_id': episodeId,
            'playhead': playhead
        })
    }

    lastPlayhead = playhead
    trackProgress(component)

}

/**
 * Set video as watched at Crunchyroll
 * @param component
 */
const setWatched: Callback = async (component) => {

    const episodeId = component.state.episodeId
    const duration = Math.floor(video.duration)

    await App.setProgress({}, {
        'content_id': episodeId,
        'playhead': duration
    })

    stopTrackProgress(component)

}

/**
 * Set video quality
 * @param level
 */
const setQuality = (level: number) => {
    hls.currentLevel = level
    hls.loadLevel = level
}

/**
 * On mount
 * @param component
 */
const onMount: Callback = (component) => {

    const element = component.element
    let controlsTimeout = null

    // UI Events
    on(element, 'click', '.video-close', (event) => {
        event.preventDefault()
        pauseVideo(component)
        hideVideo()
        Route.redirect('/home')
    })

    on(element, 'click', '.video-watched', (event) => {
        event.preventDefault()
        setWatched(component)
    })

    on(element, 'click', '.video-quality', (event, target) => {
        event.preventDefault()
        setQuality(Number(target.dataset.next))
    })

    on(element, 'click', '.video-episodes', (event, target) => {
        event.preventDefault()
        pauseVideo(component)
        hideVideo()
        Route.redirect(target.dataset.url)
    })

    on(element, 'click', '.video-previous-episode', (event, target) => {
        event.preventDefault()
        pauseVideo(component)
        Route.redirect(target.dataset.url)
    })

    on(element, 'click', '.video-next-episode', (event, target) => {
        event.preventDefault()
        pauseVideo(component)
        Route.redirect(target.dataset.url)
    })

    on(element, 'click', '.video-fullscreen', (event) => {
        event.preventDefault()
        toggleFullScreen()
    })

    on(element, 'click', '.video-pause', (event) => {

        event.preventDefault()
        pauseVideo(component)

        const playButton = $('.video-play', element)
        fire('active::element::set', playButton)

    })

    on(element, 'click', '.video-play', (event) => {

        event.preventDefault()
        playVideo(component)

        const pauseButton = $('.video-pause', element)
        fire('active::element::set', pauseButton)

    })

    on(element, 'click', '.video-reload', (event) => {
        event.preventDefault()
        pauseVideo(component)
        component.render()
    })

    on(element, 'click', '.video-forward', (event) => {
        event.preventDefault()
        forwardVideo(5)
    })

    on(element, 'click', '.video-backward', (event) => {
        event.preventDefault()
        backwardVideo(5)
    })

    on(element, 'click', '.video-skip-intro', (event) => {
        event.preventDefault()
        forwardVideo(80)
    })

    // Mouse Events
    on(element, 'mouseenter mousemove', () => {

        if (area) {
            area.classList.add('show-controls')
        }

        if (controlsTimeout) {
            clearTimeout(controlsTimeout)
        }

        controlsTimeout = setTimeout(() => {
            if (area) {
                area.classList.remove('show-controls')
            }
        }, 2000) // 2s

    })

    on(element, 'mouseleave', () => {
        if (area) {
            area.classList.remove('show-controls')
        }
    })

    on(element, 'mousemove touchmove', 'input[type="range"]', (e: MouseEvent) => {
        updateSeekTooltip(e)
    })

    on(element, 'click input', 'input[type="range"]', (_event, target) => {
        skipAhead(Number(target.dataset.seek))
    })

    // Public
    watch(element, 'video::play', () => {
        playVideo(component)
    })
    watch(element, 'video::pause', () => {
        pauseVideo(component)
    })
    watch(element, 'video::stop', () => {
        stopVideo(component)
    })
    watch(element, 'video::toggle', () => {
        toggleVideo(component)
    })
    watch(element, 'video::forward', (seconds: number) => {
        forwardVideo(seconds)
    })
    watch(element, 'video::backward', (seconds: number) => {
        backwardVideo(seconds)
    })
    watch(element, 'view::reload', () => {
        pauseVideo(component)
        component.render(state())
    })

}

/**
 * On render
 * @param component
 */
const onRender: Callback = async (component) => {

    setTimeout(async () => {

        const element = component.element

        area = $('#video', element)
        video = $('video', element) as HTMLVideoElement
        video.controls = false

        video = video
        playing = false
        lastPlayhead = 0

        // Video Events
        on(video, 'click', (event) => {
            event.preventDefault()
            toggleVideo(component)
        })

        on(video, 'timeupdate', () => {
            updateDuration(component)
            updateTimeElapsed(component)
            updateProgress(component)
        })

        fire('loading::show')

        try {

            await loadEpisode(component)
            await loadClosestEpisodes(component)
            await streamVideo(component)
            await showVideo()

            trigger(element, 'click', '.video-play')

        } catch (error) {
            showError(App.formatError(error))
        }

        fire('loading::hide')

    }, 200)

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    off(element, 'click', '.video-close')
    off(element, 'click', '.video-quality')
    off(element, 'click', '.video-watched')
    off(element, 'click', '.video-episodes')
    off(element, 'click', '.video-previous-episode')
    off(element, 'click', '.video-next-episode')
    off(element, 'click', '.video-fullscreen')
    off(element, 'click', '.video-pause')
    off(element, 'click', '.video-play')
    off(element, 'click', '.video-reload')
    off(element, 'click', '.video-forward')
    off(element, 'click', '.video-backward')
    off(element, 'click', '.video-skip-intro')
    off(element, 'mouseenter mousemove')
    off(element, 'mouseleave')
    off(element, 'mousemove touchmove', 'input[type="range"]')
    off(element, 'click input', 'input[type="range"]')

    unwatch(element, 'video::play')
    unwatch(element, 'video::pause')
    unwatch(element, 'video::stop')
    unwatch(element, 'video::toggle')
    unwatch(element, 'video::forward')
    unwatch(element, 'video::backward')
    unwatch(element, 'view::reload')

}

register('[data-video]', {
    state,
    template,
    onMount,
    onRender,
    onDestroy
})

Route.add({
    id: 'video',
    path: '/serie/:serieId/season/:seasonId/episode/:episodeId/video',
    title: 'Episode Video',
    component: '<div data-video></div>',
    authenticated: true
})
