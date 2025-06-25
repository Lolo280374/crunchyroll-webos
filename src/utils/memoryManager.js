/**
 * Memory Manager for WebOS 3.5
 * Aggressively manages memory to prevent app crashes
 */

class MemoryManager {
  constructor() {
    this.imageCache = new Map();
    this.visibleImages = new Set();
    this.memoryLimit = 50 * 1024 * 1024; // 50MB limit for images
    this.currentMemoryUsage = 0;
    this.cleanupInterval = null;
    this.isLegacyWebOS = window.webOS && 
      window.webOS.device && 
      (parseFloat(window.webOS.device.platformVersion) <= 4);
  }

  /**
   * Initialize memory management
   */
  initialize() {
    if (!this.isLegacyWebOS) return () => {}; // Only active on legacy WebOS
    
    // Register intersection observer for all optimized images
    this.setupIntersectionObserver();
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanupUnusedImages(), 30000);
    
    // Register global low memory handler
    if (window.webOS && window.webOS.systemInfo) {
      window.webOS.systemInfo.onlowmemory = () => {
        console.log("Low memory warning received - aggressive cleanup");
        this.aggressiveCleanup();
      };
    }
    
    // Cleanup function for component unmounting
    return () => {
      clearInterval(this.cleanupInterval);
      if (window.webOS && window.webOS.systemInfo) {
        window.webOS.systemInfo.onlowmemory = null;
      }
    };
  }
  
  /**
   * Setup intersection observer to track visible images
   */
  setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '50px', // Load images slightly before they enter viewport
      threshold: 0.01
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const imgElement = entry.target;
        const imgSrc = imgElement.getAttribute('src');
        
        if (entry.isIntersecting) {
          // Image is visible
          this.visibleImages.add(imgSrc);
        } else {
          // Image is not visible
          this.visibleImages.delete(imgSrc);
          
          // If we're already using a lot of memory, release this image
          if (this.currentMemoryUsage > this.memoryLimit * 0.8) {
            this.releaseImage(imgSrc);
          }
        }
      });
    }, options);
    
    // Observe all optimized images
    this.observeAllImages(observer);
    
    // Re-observe on DOM changes
    const mutationObserver = new MutationObserver(() => {
      this.observeAllImages(observer);
    });
    
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Observe all optimized images in the DOM
   */
  observeAllImages(observer) {
    document.querySelectorAll('img[data-optimized="true"]').forEach(img => {
      observer.observe(img);
    });
  }
  
  /**
   * Release an image from memory
   */
  releaseImage(src) {
    if (!src || !this.imageCache.has(src)) return;
    
    const imgElement = this.imageCache.get(src);
    
    // Only release if not visible
    if (!this.visibleImages.has(src)) {
      // Set to empty source to release memory
      imgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      imgElement.setAttribute('data-real-src', src);
      
      // Estimate memory freed (very rough estimate)
      const width = imgElement.naturalWidth || 300;
      const height = imgElement.naturalHeight || 200;
      const bytesFreed = width * height * 4; // 4 bytes per pixel (RGBA)
      this.currentMemoryUsage -= bytesFreed;
      
      console.log(`Released image: ${src.substr(-20)} - Freed ~${bytesFreed/1024}KB`);
    }
  }
  
  /**
   * Reload an image that was previously released
   */
  reloadImage(imgElement) {
    const realSrc = imgElement.getAttribute('data-real-src');
    if (realSrc) {
      imgElement.src = realSrc;
      imgElement.removeAttribute('data-real-src');
      
      // Update memory usage estimate
      const width = imgElement.naturalWidth || 300;
      const height = imgElement.naturalHeight || 200;
      const bytesAdded = width * height * 4;
      this.currentMemoryUsage += bytesAdded;
    }
  }
  
// Add to our MemoryManager class

/**
 * Activate media playback mode - aggressively free memory
 */
activateMediaMode() {
  console.log("Media playback mode activated - freeing memory");
  
  // Release ALL images except player-related ones
  this.imageCache.forEach((imgElement, src) => {
    // Skip player-related images
    if (src.includes('player') || imgElement.closest('.moon-VideoPlayer')) {
      return;
    }
    
    // Release all other images regardless of visibility
    this.releaseImage(src);
  });
  
  // Force garbage collection
  if (window.gc) window.gc();
  
  // Clear all CSS background images
  document.querySelectorAll('[style*="background-image"]').forEach(element => {
    // Skip player elements
    if (element.closest('.moon-VideoPlayer')) {
      return;
    }
    
    // Store original background if needed later
    if (!element.getAttribute('data-original-background')) {
      element.setAttribute('data-original-background', element.style.backgroundImage);
    }
    element.style.backgroundImage = 'none';
  });
  
  // Clear other caches
  if (window.caches) {
    window.caches.keys().then(names => {
      names.forEach(name => {
        window.caches.delete(name);
      });
    });
  }
  
  // Request low-priority memory cleanup from the system
  if (window.webOS && window.webOS.systemService) {
    window.webOS.systemService.request("luna://com.webos.service.memorymanager", {
      method: "clearMemory",
      parameters: { priority: "normal" }
    });
  }
}

/**
 * Deactivate media mode - restore normal operation
 */
deactivateMediaMode() {
  console.log("Media playback mode deactivated - normal memory management");
  
  // Restore background images if needed
  document.querySelectorAll('[data-original-background]').forEach(element => {
    element.style.backgroundImage = element.getAttribute('data-original-background');
  });
  
  // Normal memory management will resume automatically
}

  /**
   * Cleanup unused images
   */
  cleanupUnusedImages() {
    // Release images that aren't visible
    this.imageCache.forEach((imgElement, src) => {
      if (!this.visibleImages.has(src)) {
        this.releaseImage(src);
      }
    });
    
    // Force garbage collection if available
    if (window.gc) window.gc();
  }
  
  /**
   * Aggressive cleanup for low memory situations
   */
  aggressiveCleanup() {
    // Release all non-visible images
    this.imageCache.forEach((imgElement, src) => {
      if (!this.visibleImages.has(src)) {
        this.releaseImage(src);
      }
    });
    
    // Force garbage collection if available
    if (window.gc) window.gc();
    
    // Clear other caches
    if (window.caches) {
      window.caches.keys().then(names => {
        names.forEach(name => {
          window.caches.delete(name);
        });
      });
    }
    
    console.log("Aggressive memory cleanup complete");
  }
  
  // Singleton instance
  static instance = null;
  
  static initialize() {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance.initialize();
  }
}

export default MemoryManager;