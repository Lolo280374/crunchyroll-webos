/**
 * Extremely aggressive video optimization for WebOS 3.5
 * Makes video quality deliberately worse for better performance
 */
const optimizeVideoElement = (videoElement) => {
  if (!videoElement) return;
  
  // Check if we're on WebOS 3.5
  const isLegacyWebOS = window.webOS && 
    window.webOS.device && 
    (parseFloat(window.webOS.device.platformVersion) <= 4);
    
  if (isLegacyWebOS) {
    console.log("Applying EXTREME downscaling for WebOS 3.5");
    
    // EXTREME DOWNSCALING - render at 30% and scale back up
    // This dramatically reduces pixel processing requirements
    videoElement.style.width = '30%';
    videoElement.style.height = '30%';
    videoElement.style.transformOrigin = 'top left';
    videoElement.style.transform = 'scale(3.33)';
    videoElement.style.backfaceVisibility = 'hidden';
    videoElement.style.webkitBackfaceVisibility = 'hidden';
    
    // Further reduce quality with CSS filters (these help the GPU)
    videoElement.style.filter = 'blur(1px)';
    
    // Disable picture-in-picture and other features to save resources
    videoElement.disablePictureInPicture = true;
    videoElement.autoplay = false;
    videoElement.preload = "auto";
    
    // Create a CSS rule to further optimize video rendering
    try {
      const styleEl = document.createElement('style');
      styleEl.id = 'webos35-video-optimization';
      styleEl.textContent = `
        video {
          will-change: transform;
          image-rendering: optimizeSpeed;
          image-rendering: pixelated;
          transition: none !important;
          animation: none !important;
        }
        
        /* Further reduce UI animations around video */
        .moon-VideoPlayer_controlsFrame {
          transition: opacity 0.1s linear !important;
        }
        
        .moon-Slider_fill,
        .moon-Slider_knob {
          transition: none !important;
        }
      `;
      document.head.appendChild(styleEl);
      
      // Force repaint to apply changes
      videoElement.offsetHeight;
    } catch (e) {
      console.warn("Could not add optimization styles", e);
    }
    
    // WebOS specific optimizations
    if (window.webOS && window.webOS.mediaPreferences) {
      window.webOS.mediaPreferences.setPreferences(videoElement, {
        mediaCodec: 'h264',
        frameRateMode: 'fixed',
        decoderPriority: 'hardware',
        bufferSize: 'minimum',
        mediaQuality: 'minimum'
      });
    }
    
    // Handle the container as well
    const playerContainer = videoElement.closest('.moon-VideoPlayer');
    if (playerContainer) {
      // Add a class to help identify this mode
      playerContainer.classList.add('extreme-performance-mode');
      
      // Disable smooth scrolling in the player
      playerContainer.style.scrollBehavior = 'auto';
    }
    
    // Return cleanup function
    return () => {
      const style = document.getElementById('webos35-video-optimization');
      if (style) style.remove();
    };
  }
};

export default optimizeVideoElement;