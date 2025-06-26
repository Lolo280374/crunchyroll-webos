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
        // FORCE 480p MODE - Disable Adaptive Bitrate completely for WebOS 3.5
        config.streaming.abr = {
            // Turn OFF automatic quality switching
            autoSwitchBitrate: {
                audio: true,  // Keep audio adaptive
                video: false  // Force video quality
            },
            // Start at 480p
            initialBitrate: { 
                audio: -1, 
                video: BITRATE_480P
            },
            // Hard limit to 480p
            maxBitrate: {
                audio: -1,
                video: BITRATE_480P
            },
            maxHeight: RESOLUTION_480P
        };
        
        // Conservative buffer settings for stability
        config.streaming.buffer = {
            fastSwitchEnabled: false,
            bufferTimeDefault: 8,
            bufferTimeAtTopQuality: 12,
            bufferTimeAtTopQualityLongForm: 20,
            initialBufferLevel: 6,
            stableBufferTime: 10,
            bufferToKeep: 30,
            bufferPruningInterval: 30
        };
        
        // Turn off quality switching completely
        dashPlayer.updateSettings({
            debug: {
                logLevel: 0 // Reduce logging to improve performance
            },
            streaming: config.streaming
        });
        
        // Disable ABR Manager to ensure quality doesn't change
        dashPlayer.on('streamInitialized', () => {
            console.log("Forcing 480p quality for WebOS 3.5");
            dashPlayer.setQualityFor('video', 0); // Force lowest quality index
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
        
        dashPlayer.updateSettings({
            streaming: config.streaming
        });
    }
    
    return dashPlayer;
};

export default {
    configurePlayer
};