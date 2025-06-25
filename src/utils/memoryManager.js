/**
 * Manages memory for WebOS 3.5 devices
 */
const MemoryManager = {
  /**
   * Initializes memory management for WebOS 3.5
   */
  initialize: () => {
    // Only apply to WebOS 3.5 or lower
    const isLegacyWebOS = window.webOS && 
      window.webOS.device && 
      (parseFloat(window.webOS.device.platformVersion) <= 4);
    
    if (!isLegacyWebOS) return () => {};
    
    console.log('[MemoryManager] Initialized for WebOS 4');
    
    // Clean offscreen images periodically
    const interval = setInterval(() => {
      const cleanedCount = MemoryManager.cleanupOffscreenImages();
      if (cleanedCount > 0) {
        console.log(`[MemoryManager] Released ${cleanedCount} offscreen images`);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  },
  
  /**
   * Cleans up offscreen images to free memory
   */
  cleanupOffscreenImages: () => {
    // Find all images that are likely offscreen
    const allImages = document.querySelectorAll('img[data-optimized="true"]');
    let cleaned = 0;
    
    allImages.forEach(img => {
      // Check if image is not in viewport
      if (!isElementInViewport(img)) {
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = img.src;
        }
        // Replace with empty image to free memory
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        cleaned++;
      } else if (img.dataset.originalSrc && 
                img.src === 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=') {
        // Restore image when back in viewport
        img.src = img.dataset.originalSrc;
      }
    });
    
    return cleaned;
  }
};

/**
 * Helper to check if element is in viewport
 */
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= -300 &&
    rect.left >= -100 &&
    rect.bottom <= (window.innerHeight + 300) &&
    rect.right <= (window.innerWidth + 100)
  );
}

export default MemoryManager;