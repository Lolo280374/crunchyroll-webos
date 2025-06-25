/**
 * Optimizes video element properties for WebOS 3.5
 */

const optimizeVideoElement = (videoElement) => {
  if (!videoElement) return;
  
  // Force hardware acceleration where possible
  videoElement.style.transform = 'translateZ(0)';
  
  // Disable picture-in-picture to save resources
  videoElement.disablePictureInPicture = true;
  
  // Set optimal video attributes
  videoElement.setAttribute('preload', 'auto');
  videoElement.setAttribute('playsinline', '');
  
  // WebOS-specific optimizations
  if (window.webOS) {
    // Reduce video element dimensions very slightly to prevent edge rendering issues
    // This helps WebOS 3.5 with graphics rendering
    videoElement.style.width = '99.5%';
    videoElement.style.height = '99.5%';
    
    // WebOS 3.5 specific codec hints
    if (window.webOS.device && parseFloat(window.webOS.device.platformVersion) <= 4) {
      // Add WebOS-specific attributes if they exist
      if (window.webOS.mediaPreferences) {
        window.webOS.mediaPreferences.setPreferences(videoElement, {
          mediaCodec: 'h264',
          frameRateMode: 'fixed',
          decoderPriority: 'hardware',
          bufferSize: 'large'
        });
      }
    }
  }
};

export default optimizeVideoElement;