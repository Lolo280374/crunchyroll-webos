/**
 * Ultra-aggressive 240p configuration for WebOS 3.5
 */

import utils from '../utils';

// Target the absolute lowest quality
const RESOLUTION_240P = 240;
const BITRATE_240P = 250000; // 250 Kbps for 240p

/**
 * Configure player for optimal performance on WebOS 3.5
 * @param {import('dashjs-webos5').MediaPlayerClass} dashPlayer 
 */
export const configurePlayer = async (dashPlayer) => {
    // Detect WebOS version
    const isLegacyWebOS = utils.isTv() && 
        window.webOS && 
        window.webOS.device && 
        (parseFloat(window.webOS.device.platformVersion) <= 4);
        
    if (isLegacyWebOS) {
        console.log("ULTRA-LOW QUALITY MODE for WebOS 3.5");
        
        // Set body class for WebOS 3.5 styling
        document.body.classList.add('webos35');
        
        // Apply extreme low quality settings
        dashPlayer.updateSettings({
            debug: { logLevel: 0 },
            streaming: {
                buffer: {
                    // Simplified buffer settings
                    fastSwitchEnabled: false,
                    bufferTimeDefault: 12,       // Higher buffers
                    bufferToKeep: 30,            // Keep more buffer
                    bufferPruningInterval: 30,   // Clean less frequently
                    bufferTimeAtTopQuality: 8,   // Not relevant but lower if used
                    bufferTimeAtTopQualityLongForm: 10, 
                    // Start with a generous buffer
                    stableBufferTime: 12,
                    initialBufferLevel: 10,
                    // Be more tolerant of stalling
                    stallThreshold: 0.5
                },
                // Disable ABR completely (quality switching)
                abr: {
                    autoSwitchBitrate: {
                        audio: false, 
                        video: false
                    },
                    // Set initial bitrates as low as possible
                    initialBitrate: {
                        audio: 32000,  // 32 Kbps audio
                        video: BITRATE_240P
                    },
                    // Hard limits for WebOS 3.5
                    maxBitrate: {
                        audio: 64000,  // 64 Kbps audio max
                        video: BITRATE_240P
                    },
                    // Maximum resolution
                    maxHeight: RESOLUTION_240P,
                    // Disable rules that might cause problems
                    useBufferOccupancyABR: false,
                    useDeadTimeLatency: false,
                    // Extremely conservative bandwidth estimates
                    bandwidthSafetyFactor: 0.5
                },
                // Request handling
                retryAttempts: {
                    MPD: 3,
                    XLinkExpansion: 1, 
                    InitializationSegment: 3,
                    IndexSegment: 3,
                    MediaSegment: 3,
                    BitstreamSwitchingSegment: 3,
                    FragmentInfoSegment: 3,
                    license: 3,
                    other: 2
                },
                // Higher timeouts for network issues
                fragmentRequestTimeout: 25000,
                // Never abandon downloads
                abandonLoadTimeout: 10000
            }
        });
        
        // Force 240p specifically and repeatedly
        dashPlayer.on('streamInitialized', () => {
            force240pQuality(dashPlayer);
        });
        
        dashPlayer.on('tracksAdded', () => {
            setTimeout(() => force240pQuality(dashPlayer), 100);
        });
        
        dashPlayer.on('qualityChangeRequested', () => {
            setTimeout(() => force240pQuality(dashPlayer), 50);
        });
        
        dashPlayer.on('qualityChangeRendered', () => {
            setTimeout(() => force240pQuality(dashPlayer), 50);
        });
        
        // Enforce regularly with interval
        const qualityInterval = setInterval(() => force240pQuality(dashPlayer), 2000);
        dashPlayer._qualityEnforcementInterval = qualityInterval;
        
        // Optimize video element
        const videoEl = dashPlayer.getVideoElement();
        if (videoEl) {
            videoEl.disablePictureInPicture = true;
            videoEl.autoplay = false;
            videoEl.preload = "auto";
            
            // Reduce video element size to ease rendering
            videoEl.style.width = '98.5%';
            videoEl.style.height = '98.5%';
            videoEl.style.transform = 'translateZ(0)';
            
            // Apply WebOS TV media optimizations if available
            if (window.webOS && window.webOS.mediaPreferences) {
                window.webOS.mediaPreferences.setPreferences(videoEl, {
                    mediaCodec: 'h264',         // Older, better supported codec
                    frameRateMode: 'fixed',     // Consistent frame rate
                    decoderPriority: 'hardware',
                    bufferSize: 'small',        // Smaller buffers in hardware
                    mediaQuality: 'minimum'     // Use absolute minimum quality
                });
            }
        }
    } else {
        // Modern WebOS settings - keep your standard settings here
        dashPlayer.updateSettings({
            streaming: {
                buffer: {
                    bufferTimeDefault: 20,
                    bufferTimeAtTopQuality: 150,
                    bufferTimeAtTopQualityLongForm: 300,
                    initialBufferLevel: 16
                }
            }
        });
    }
    
    return dashPlayer;
};

/**
 * Force the lowest quality possible (240p)
 */
function force240pQuality(dashPlayer) {
    try {
        // Disable auto quality selection
        dashPlayer.setAutoSwitchQualityFor('video', false);
        dashPlayer.setAutoSwitchQualityFor('audio', false);
        
        // Get video qualities
        const videoQualities = dashPlayer.getBitrateInfoListFor('video');
        if (videoQualities && videoQualities.length > 0) {
            // Find lowest quality (prioritizing 240p specifically)
            let targetIndex = 0;
            let targetFound = false;
            let lowestBitrate = Infinity;
            
            // First pass: look for 240p specifically
            for (let i = 0; i < videoQualities.length; i++) {
                const quality = videoQualities[i];
                if (quality.height === RESOLUTION_240P) {
                    if (quality.bitrate < lowestBitrate) {
                        targetIndex = i;
                        lowestBitrate = quality.bitrate;
                        targetFound = true;
                    }
                }
            }
            
            // Second pass: if no 240p, get the absolute lowest
            if (!targetFound) {
                lowestBitrate = Infinity;
                for (let i = 0; i < videoQualities.length; i++) {
                    if (videoQualities[i].bitrate < lowestBitrate) {
                        targetIndex = i;
                        lowestBitrate = videoQualities[i].bitrate;
                    }
                }
            }
            
            const targetQuality = videoQualities[targetIndex];
            console.log(`Forcing quality: ${targetQuality.height}p @ ${Math.round(targetQuality.bitrate/1000)}kbps`);
            
            // Set the quality forcefully
            dashPlayer.setQualityFor('video', targetIndex);
        }
        
        // Also force lowest audio quality
        const audioQualities = dashPlayer.getBitrateInfoListFor('audio');
        if (audioQualities && audioQualities.length > 0) {
            let lowestAudioIndex = 0;
            let lowestAudioBitrate = Infinity;
            
            for (let i = 0; i < audioQualities.length; i++) {
                if (audioQualities[i].bitrate < lowestAudioBitrate) {
                    lowestAudioIndex = i;
                    lowestAudioBitrate = audioQualities[i].bitrate;
                }
            }
            
            dashPlayer.setQualityFor('audio', lowestAudioIndex);
        }
    } catch (e) {
        console.error("Error forcing 240p quality", e);
    }
}

/**
 * Cleanup player resources when unmounting
 */
export const cleanupPlayer = (dashPlayer) => {
    if (dashPlayer && dashPlayer._qualityEnforcementInterval) {
        clearInterval(dashPlayer._qualityEnforcementInterval);
    }
};

export default {
    configurePlayer,
    cleanupPlayer
};