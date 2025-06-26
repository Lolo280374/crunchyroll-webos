/**
 * Player configuration optimized for WebOS 3.5
 */

import utils from '../utils';

// Constants
const RESOLUTION_720P = 720;
const RESOLUTION_480P = 480;
const BITRATE_720P = 2500000;   // ~2.5 Mbps for 720p
const BITRATE_480P = 1100000;   // ~1.1 Mbps for 480p
const BUFFER_LOW_THRESHOLD = 8; // Seconds before we consider buffering at risk

/**
 * Configure player for optimal performance based on device
 * @param {import('dashjs-webos5').MediaPlayerClass} dashPlayer 
 */
export const configurePlayer = async (dashPlayer) => {
    const isLegacyWebOS = utils.isTv() && 
        window.webOS && 
        window.webOS.device && 
        (parseFloat(window.webOS.device.platformVersion) <= 4);
        
    if (isLegacyWebOS) {
        // WebOS 3.5 Ultra-Conservative settings
        
        // First, drop quality much lower for WebOS 3.5
        const RESOLUTION_480P = 480;
        const BITRATE_480P = 900000;  // ~900 Kbps for 480p
        
        // Apply ultra-conservative buffer settings
        dashPlayer.updateSettings({
            streaming: {
                lowLatencyEnabled: false,
                abr: {
                    // Force start at lower quality 
                    initialBitrate: { 
                        audio: -1, 
                        video: BITRATE_480P
                    },
                    // Hard limit to 480p
                    maxBitrate: {
                        audio: -1,
                        video: BITRATE_480P
                    },
                    maxHeight: RESOLUTION_480P,
                    // Prevent jumping between qualities too quickly
                    bandwidthSafetyFactor: 0.8,
                    // Be much more conservative about upgrading quality
                    switchDownRatio: 0.7,
                    switchUpRatio: 0.9,
                    // Simplify ABR logic
                    ABRStrategy: "abrThroughput"
                },
                buffer: {
                    // Bigger initial buffer for WebOS 3.5
                    fastSwitchEnabled: false,
                    bufferTimeDefault: 8,
                    bufferTimeAtTopQuality: 12,
                    bufferTimeAtTopQualityLongForm: 20,
                    initialBufferLevel: 6,
                    stableBufferTime: 10,
                    bufferToKeep: 30,
                    bufferPruningInterval: 30
                },
                // Simplify the player's internal management
                scheduling: {
                    scheduleWhilePaused: true,
                    lowLatencyEnabled: false,
                    timeShiftBufferPruningInterval: 30,
                    timeShiftBufferAheadOf: 60
                }
            }
        });
        
        // Add buffer level monitoring
        dashPlayer.on('bufferLevelStateChanged', (e) => {
            if (e.state === 'low') {
                console.log("Buffer state low, dropping quality significantly");
                // Drop to minimum quality when buffer gets low
                dashPlayer.updateSettings({
                    streaming: {
                        abr: {
                            maxHeight: 360,
                            maxBitrate: {
                                video: 500000 // 500 Kbps
                            }
                        }
                    }
                });
            }
        });
        
        // Optimize for WebOS 3.5 memory constraints
        dashPlayer.setTextDefaultEnabled(false); // Disable subtitles by default
        
        // Reduce internally stored buffer when memory limited
        dashPlayer.on('fragmentLoadingAbandoned', () => {
            dashPlayer.updateSettings({
                streaming: {
                    buffer: {
                        bufferToKeep: 10 // Reduce buffer when we're struggling
                    }
                }
            });
        });
    } else {
        // Modern WebOS settings (keep your existing code here)
    }
    
    return dashPlayer;
};

export default {
    configurePlayer
};