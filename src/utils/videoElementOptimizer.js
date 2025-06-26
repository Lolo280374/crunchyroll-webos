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
    // Check for WebOS 3.5
    const isLegacyWebOS = window.webOS.device && 
      parseFloat(window.webOS.device.platformVersion) <= 4;
    
    if (isLegacyWebOS) {
      // ULTRA-LIGHTWEIGHT MODE
      
      // 1. Reduce video element size to reduce decode work
      videoElement.style.width = '99%';
      videoElement.style.height = '99%';
      
      // 2. Disable shadows and complex effects around video
      const videoParent = videoElement.parentElement;
      if (videoParent) {
        videoParent.style.boxShadow = 'none';
        videoParent.style.webkitFilter = 'none';
      }
      
      // 3. Reduce animation frames for video controls
      document.documentElement.style.setProperty('--video-transition', '0s');
      
      // 4. Enable WebOS TV-specific optimizations if available
      if (window.webOS.mediaPreferences) {
        window.webOS.mediaPreferences.setPreferences(videoElement, {
          mediaCodec: 'h264',
          frameRateMode: 'fixed',
          decoderPriority: 'hardware',
          bufferSize: 'small',
          // Override to prioritize stability over quality
          mediaQuality: 'standard' 
        });
      }
      
      // 5. Simplify reflection effects
      const reflections = document.querySelectorAll('.reflection, .shadow');
      reflections.forEach(el => {
        el.style.display = 'none';
      });
    }
  }
};

export default optimizeVideoElement;