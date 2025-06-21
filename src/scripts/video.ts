import type { Callback, State, Template } from "./vine"
import { $, fire, on, off, trigger, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

declare var Hls: any

// Add this variable at the top of your file where you define hls
let dashPlayer: any = null;

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
    const episodeId = state.episodeId
    const videoId = state.videoId

console.log("DASH.js available:", typeof window.dashjs !== 'undefined');

    // Get playhead info as before
    const playheadResponse = await App.playHeads([episodeId], {})
    let playhead = 0
    let duration = 0

    if( playheadResponse && playheadResponse.data && playheadResponse.data.length ){
        playhead = playheadResponse.data[0].playhead
        duration = playheadResponse.data[0].duration
    }

    if (playhead / duration > 0.90 || playhead < 30) {
        playhead = 0
    }

    try {
        console.log("Attempting to use modern streaming API...");
        
        // Get the current access token to use in all requests
        const accessToken = localStorage.getItem('accessToken');
        console.log("Using access token:", accessToken ? "Present" : "Missing");
        
        // Get stream info from the modern API
        const modernResponse = await App.modernStreams(videoId);
        
        if (!modernResponse.error && (modernResponse.url || (modernResponse.hardSubs && Object.keys(modernResponse.hardSubs).length))) {
            console.log("Modern streaming API successful!");
            
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
            
            // Handle proxy if needed
            const proxyUrl = document.body.dataset.proxyUrl;
            const proxyEncode = document.body.dataset.proxyEncode;
            if (proxyUrl) {
                stream = proxyUrl + (proxyEncode === "true" ? encodeURIComponent(stream) : stream);
            }

            area.classList.add('video-is-loading');

            // Detect if this is a DASH stream (ends with .mpd)
            const isDashStream = stream.includes('.mpd') || stream.includes('manifest.mpd');
            console.log(`Detected ${isDashStream ? 'DASH' : 'HLS'} stream format`);

            // If it's a DASH stream and dashjs is available, use DASH player
            if (isDashStream && typeof window.dashjs !== 'undefined') {
                console.log("Using DASH player for MPD stream");
                
                // Clean up any existing HLS player
                if (hls) {
                    hls.destroy();
                    hls = null;
                }
                
                return await new Promise((resolve) => {
                    try {
                        // Create dashjs player
                        dashPlayer = window.dashjs.MediaPlayer().create();
                        
                        // Add authorization header to all DASH requests
                        dashPlayer.extend("RequestModifier", function() {
                            return {
                                modifyRequestHeader: function(xhr: XMLHttpRequest) {
                                    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                                    console.log("Added Authorization header to DASH request");
                                    return xhr;
                                }
                            };
                        });
                        
                        // Setup event handling
                        dashPlayer.on("error", function(e: any) {
                            console.error("DASH error:", e);
                            showError('DASH playback error: ' + (e.error || 'Unknown error'));
                        });
                        
                        dashPlayer.on("playbackMetaDataLoaded", function() {
                            area.classList.remove('video-is-loading');
                            area.classList.add('video-is-loaded');
                            console.log("DASH stream loaded successfully");
                            resolve(null);
                        });

                        dashPlayer.on("qualityChanged", function(e: any) {
                            let quality = $('.video-quality', area);
                            let bitrateInfo = dashPlayer.getBitrateInfoListFor('video');
                            let currentQuality = e.newQuality;
                            let level = bitrateInfo[currentQuality];
                            let next = currentQuality - 1;

                            if (next < 0) {
                                next = bitrateInfo.length - 1;
                            }

                            quality.dataset.next = next;
                            $('span', quality).innerText = level.height + 'p';
                        });
                        
                        // Initialize the player
                        dashPlayer.initialize(video, stream, true);
                        
                        // Set initial position if needed
                        if (playhead > 0) {
                            dashPlayer.seek(playhead);
                        }
                    } catch (dashError) {
                        console.error("Error initializing DASH player:", dashError);
                        showError('Failed to initialize DASH player: ' + dashError.message);
                        resolve(null);
                    }
                });
            } else {
                // Use HLS.js (either for HLS streams or as fallback when dashjs is not available)
                console.log("Using HLS player" + (isDashStream ? " (fallback for DASH)" : ""));
                
                return await new Promise((resolve) => {
                    if (!Hls.isSupported()) {
                        throw Error('Video format not supported.');
                    }

                    // Configure HLS.js with the crucial xhrSetup function
                    hls = new Hls({
                        autoStartLoad: false,
                        startLevel: -1,
                        maxBufferLength: 15,
                        backBufferLength: 15,
                        maxBufferSize: 30 * 1000 * 1000,
                        maxFragLookUpTolerance: 0.2,
                        nudgeMaxRetry: 10,
                        // THIS IS THE KEY PART - Add the Authorization header to all HLS requests
                        xhrSetup: function(xhr, url) {
                            // Add Authorization header to all requests
                            xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                            console.log("Added Authorization header to HLS request");
                        }
                    });

                    // Rest of your HLS setup remains the same
                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        hls.loadSource(stream);
                    });

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        hls.startLoad(playhead);
                    });

                    hls.on(Hls.Events.LEVEL_LOADED, () => {
                        area.classList.remove('video-is-loading');
                        area.classList.add('video-is-loaded');
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
                        // Log more details about HLS errors
                        console.error("HLS error:", data);
                        
                        if (!data.fatal) {
                            return;
                        }

                        switch (data.type) {
                            case Hls.ErrorTypes.OTHER_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                if (data.details == 'manifestLoadError') {
                                    showError('Episode cannot be played because of CORS error or invalid token. Error details: ' + data.response?.code);
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

                    hls.attachMedia(video);
                });
            }
        } else {
            // If modern API fails, fall back to legacy method
            console.log("Modern API didn't return valid stream info, falling back to legacy API");
            throw new Error("Modern API failed");
        }
    } catch (modernError) {
        // Fall back to legacy streaming method
        console.error("Modern streaming failed:", modernError);
        console.log("Falling back to legacy streaming API...");

        try {
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

            // Legacy streaming setup
            console.log(`Legacy stream URL (first 100 chars): ${stream.substring(0, 100)}...`);
            
            const proxyUrl = document.body.dataset.proxyUrl;
            const proxyEncode = document.body.dataset.proxyEncode;
            if (proxyUrl) {
                stream = proxyUrl + (proxyEncode === "true" ? encodeURIComponent(stream) : stream);
            }

            area.classList.add('video-is-loading');

            return await new Promise((resolve) => {
                // Same HLS setup as before
                if (!Hls.isSupported()) {
                    throw Error('Video format not supported.');
                }

                hls = new Hls({
                    autoStartLoad: false,
                    startLevel: -1,
                    maxBufferLength: 15,
                    backBufferLength: 15,
                    maxBufferSize: 30 * 1000 * 1000,
                    maxFragLookUpTolerance: 0.2,
                    nudgeMaxRetry: 10
                });

                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    hls.loadSource(stream);
                });

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    hls.startLoad(playhead);
                });

                hls.on(Hls.Events.LEVEL_LOADED, () => {
                    area.classList.remove('video-is-loading');
                    area.classList.add('video-is-loaded');
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

                hls.attachMedia(video);
            });
        } catch (error) {
            console.error("Legacy API failed:", error);
            throw error; // Re-throw to show error to user
        }
    }
}

// Video quality selector
const setupQualitySelector = () => {
    const quality = $('.video-quality', area);
    
    quality.addEventListener('click', () => {
        if (hls) {
            // HLS quality handling
            let next = parseInt(quality.dataset.next);
            hls.currentLevel = next;
        } else if (dashPlayer) {
            // DASH quality handling
            const bitrateInfo = dashPlayer.getBitrateInfoListFor('video');
            const currentIndex = dashPlayer.getQualityFor('video');
            let nextIndex = currentIndex - 1;
            
            if (nextIndex < 0) {
                nextIndex = bitrateInfo.length - 1;
            }
            
            dashPlayer.setQualityFor('video', nextIndex);
            
            // Update quality display
            const level = bitrateInfo[nextIndex];
            quality.dataset.next = '' + nextIndex;
            $('span', quality).innerText = level.height + 'p';
        }
    });
    
    // For DASH player, set up quality display on load
    if (dashPlayer) {
        dashPlayer.on('streamInitialized', () => {
            const bitrateInfo = dashPlayer.getBitrateInfoListFor('video');
            const currentIndex = dashPlayer.getQualityFor('video');
            const level = bitrateInfo[currentIndex];
            
            quality.dataset.next = '' + (currentIndex - 1);
            $('span', quality).innerText = level.height + 'p';
        });
    }
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
