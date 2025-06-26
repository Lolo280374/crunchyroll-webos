/**
 * Player configuration optimized for WebOS 3.5
 */

import utils from '../utils';

// Constants
const RESOLUTION_480P = 480;
const BITRATE_480P = 900000;   // ~900 Kbps for 480p

/**
 * Configure player for optimal performance based on device
 * @param {import('dashjs-webos5').MediaPlayerClass} dashPlayer 
 */
export const configurePlayer = async (dashPlayer) => {
    // Detect WebOS version
    const isLegacyWebOS = utils.isTv() && 
        window.webOS && 
        window.webOS.device && 
        (parseFloat(window.webOS.device.platformVersion) <= 4);
        
    if (isLegacyWebOS) {
        // AGGRESSIVE QUALITY FORCING FOR WEBOS 3.5
        console.log("Aggressive 480p enforcement for WebOS 3.5");
        
        // 1. Disable ABR completely
        dashPlayer.updateSettings({
            debug: {
                logLevel: 0 // Reduce logging overhead
            },
            streaming: {
                abr: {
                    autoSwitchBitrate: {
                        audio: true,  // Keep audio adaptive
                        video: false  // Force video quality
                    },
                    // Cap bitrate very aggressively
                    maxBitrate: {
                        video: BITRATE_480P
                    }
                },
                buffer: {
                    fastSwitchEnabled: false,
                    bufferTimeDefault: 10,
                    bufferTimeAtTopQuality: 20,
                    initialBufferLevel: 8
                }
            }
        });
        
        // 2. Force quality selection at multiple points in the lifecycle
        
        // When stream is initialized
        dashPlayer.on('streamInitialized', () => {
            forceLowestQuality(dashPlayer);
        });
        
        // When tracks are added (failsafe)
        dashPlayer.on('tracksAdded', () => {
            setTimeout(() => forceLowestQuality(dashPlayer), 100);
        });
        
        // When quality changes, force back to low quality
        dashPlayer.on('qualityChangeRendered', () => {
            setTimeout(() => forceLowestQuality(dashPlayer), 100);
        });
        
        // 3. Create a quality enforcement interval
        const qualityInterval = setInterval(() => {
            if (dashPlayer.getQualityFor('video') > 0) {
                forceLowestQuality(dashPlayer);
            }
        }, 5000); // Check every 5 seconds
        
        // 4. Store the interval for cleanup
        dashPlayer._qualityEnforcementInterval = qualityInterval;
    } else {
        // Modern WebOS settings
        dashPlayer.updateSettings({
            streaming: {
                buffer: {
                    bufferTimeDefault: 20,
                    bufferTimeAtTopQuality: 150,
                    bufferTimeAtTopQualityLongForm: 300,
                    initialBufferLevel: 16,
                    bufferToKeep: 12,
                    bufferPruningInterval: 8
                },
                abr: {
                    autoSwitchBitrate: {
                        audio: true,
                        video: true
                    }
                }
            }
        });
    }
    
    return dashPlayer;
};

/**
 * Helper function to force lowest quality for video
 */
function forceLowestQuality(dashPlayer) {
    try {
        // Force the absolute lowest quality available
        dashPlayer.setAutoSwitchQualityFor('video', false);
        
        // Most reliable way to get the lowest quality index
        const videoQualities = dashPlayer.getBitrateInfoListFor('video');
        if (videoQualities && videoQualities.length > 0) {
            // Find the representation with lowest height ≤ 480p
            let lowestQualityIdx = 0;
            let lowestHeight = Infinity;
            let lowestBitrate = Infinity;
            
            for (let i = 0; i < videoQualities.length; i++) {
                const quality = videoQualities[i];
                if (quality.height <= RESOLUTION_480P && 
                    (quality.height < lowestHeight || 
                     (quality.height === lowestHeight && quality.bitrate < lowestBitrate))) {
                    lowestQualityIdx = i;
                    lowestHeight = quality.height;
                    lowestBitrate = quality.bitrate;
                }
            }
            
            console.log(`Forcing video to lowest quality: ${lowestHeight}p @ ${Math.round(lowestBitrate/1000)}kbps`);
            dashPlayer.setQualityFor('video', lowestQualityIdx);
            
            // Double-check after a short delay
            setTimeout(() => {
                const currentQuality = dashPlayer.getQualityFor('video');
                const currentInfo = videoQualities[currentQuality];
                console.log(`Current quality: ${currentInfo.height}p @ ${Math.round(currentInfo.bitrate/1000)}kbps`);
            }, 1000);
        }
    } catch (e) {
        console.error("Error forcing quality:", e);
    }
}

// Add cleanup method to the export
export const cleanupPlayer = (dashPlayer) => {
    if (dashPlayer._qualityEnforcementInterval) {
        clearInterval(dashPlayer._qualityEnforcementInterval);
    }
};

export default {
    configurePlayer,
    cleanupPlayer
};