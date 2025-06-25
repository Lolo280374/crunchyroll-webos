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
    // Detect WebOS version
    const isLegacyWebOS = utils.isTv() && 
        window.webOS && 
        window.webOS.device && 
        (parseFloat(window.webOS.device.platformVersion) <= 4);
        
    // Base configuration
    const config = {
        streaming: {
            buffer: {
                bufferTimeDefault: 20,
                longFormContentDurationThreshold: 600,
                fastSwitchEnabled: true,
            },
            abr: {
                autoSwitchBitrate: {
                    audio: true,
                    video: true
                },
                initialBitrate: { 
                    audio: -1, 
                    video: -1 
                },
                limitBitrateByPortal: true,
                useDefaultABRRules: true
            }
        }
    };
    
    if (isLegacyWebOS) {
        // WebOS 3.5 optimized settings
        config.streaming.buffer = {
            ...config.streaming.buffer,
            bufferTimeAtTopQuality: 60,
            bufferTimeAtTopQualityLongForm: 120,
            initialBufferLevel: 8,
            bufferToKeep: 6,
            bufferPruningInterval: 4
        };
        
        // Limited quality for WebOS 3.5
        config.streaming.abr = {
            ...config.streaming.abr,
            maxBitrate: {
                audio: -1,
                video: BITRATE_720P
            },
            maxHeight: RESOLUTION_720P,
        };
        
        // Add custom ABR rules for WebOS 3.5
        config.streaming.abr.ABRStrategy = "abrDynamic";
        
        // Add buffer monitoring to detect playback issues
        dashPlayer.on('bufferLevelStateChanged', (e) => {
            if (e.state === 'low' && e.mediaType === 'video') {
                // When buffer gets low, force switch to lower quality
                dashPlayer.updateSettings({
                    streaming: {
                        abr: {
                            maxBitrate: {
                                video: BITRATE_480P
                            },
                            maxHeight: RESOLUTION_480P
                        }
                    }
                });
            } else if (e.state === 'loaded' && e.mediaType === 'video') {
                // When buffer is healthy again, allow up to 720p
                dashPlayer.updateSettings({
                    streaming: {
                        abr: {
                            maxBitrate: {
                                video: BITRATE_720P
                            },
                            maxHeight: RESOLUTION_720P
                        }
                    }
                });
            }
        });
        
        // Monitor for stalling and reduce quality if needed
        dashPlayer.on('playbackStalled', () => {
            // If playback stalls, immediately drop quality
            dashPlayer.updateSettings({
                streaming: {
                    abr: {
                        maxBitrate: {
                            video: BITRATE_480P
                        },
                        maxHeight: RESOLUTION_480P
                    }
                }
            });
            
            // Gradually allow higher quality after 30 seconds
            setTimeout(() => {
                dashPlayer.updateSettings({
                    streaming: {
                        abr: {
                            maxBitrate: {
                                video: BITRATE_720P
                            },
                            maxHeight: RESOLUTION_720P
                        }
                    }
                });
            }, 30000);
        });
    } else {
        // Modern WebOS settings - can use higher quality
        config.streaming.buffer = {
            ...config.streaming.buffer,
            bufferTimeAtTopQuality: 150,
            bufferTimeAtTopQualityLongForm: 300,
            initialBufferLevel: 16,
            bufferToKeep: 12,
            bufferPruningInterval: 8
        };
    }
    
    // Apply configuration
    dashPlayer.updateSettings(config);
    
    return dashPlayer;
};

export default {
    configurePlayer
};