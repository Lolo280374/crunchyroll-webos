/**
 * Freezes DOM updates during video playback
 */

class DOMFreezer {
  constructor() {
    this.frozen = false;
    this.mutationObserver = null;
    this.intersectionObserver = null;
    this.resizeObserver = null;
    this.deferredUpdates = [];
    
    // Elements that should always be updated - correct syntax for selectors
    this.allowedSelectors = [
      '.moon-VideoPlayer',
      '.moon-VideoPlayer *',
      '#skip-button',
      '#media-controls',
      '.player-overlay'
    ];
  }
  
  /**
   * Check if an element should be allowed to update during freeze
   */
  isAllowedElement(element) {
    return this.allowedSelectors.some(selector => {
      try {
        return element.matches(selector) || 
               element.closest(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }
  
  /**
   * Freeze unnecessary DOM updates during playback
   */
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    
    // Store original requestAnimationFrame for critical updates
    this.originalRAF = window.requestAnimationFrame;
    
    // Limit requestAnimationFrame updates
    window.requestAnimationFrame = (callback) => {
      // Check if the call stack includes player components
      const stack = new Error().stack || '';
      const isPlayerUpdate = stack.includes('VideoPlayer') || 
                             stack.includes('media') || 
                             stack.includes('player');
      
      if (isPlayerUpdate) {
        return this.originalRAF(callback);
      } else {
        // Defer non-player updates
        this.deferredUpdates.push(callback);
        return -1;
      }
    };
    
    // Pause observers that cause reflows
    this.pauseObservers();
  }
  
  /**
   * Unfreeze DOM and process deferred updates
   */
  unfreeze() {
    if (!this.frozen) return;
    this.frozen = false;
    
    // Restore requestAnimationFrame
    window.requestAnimationFrame = this.originalRAF;
    
    // Process deferred updates in batches to prevent UI freeze
    const processBatch = (startIdx, batchSize) => {
      const endIdx = Math.min(startIdx + batchSize, this.deferredUpdates.length);
      
      for (let i = startIdx; i < endIdx; i++) {
        try {
          this.originalRAF(this.deferredUpdates[i]);
        } catch (e) {
          console.error('Error processing deferred update', e);
        }
      }
      
      if (endIdx < this.deferredUpdates.length) {
        setTimeout(() => processBatch(endIdx, batchSize), 16);
      } else {
        this.deferredUpdates = [];
      }
    };
    
    if (this.deferredUpdates.length) {
      processBatch(0, 5); // Process 5 updates per frame
    }
    
    // Resume observers
    this.resumeObservers();
  }
  
  /**
   * Pause DOM observers
   */
  pauseObservers() {
    // Instead of using invalid selector, iterate through all elements
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      // Skip player elements
      if (this.isAllowedElement(el)) {
        return;
      }
      
      const observers = el._domFreezerObservers;
      if (observers) {
        if (observers.mutation) observers.mutation.disconnect();
        if (observers.intersection) observers.intersection.disconnect();
        if (observers.resize) observers.resize.disconnect();
      }
    });
  }
  
  /**
   * Resume DOM observers
   */
  resumeObservers() {
    // Re-enable observers that were paused
    document.querySelectorAll('*').forEach(el => {
      const observers = el._domFreezerObservers;
      if (observers) {
        if (observers.mutation && observers.mutationConfig) {
          observers.mutation.observe(el, observers.mutationConfig);
        }
        if (observers.intersection && observers.intersectionConfig) {
          observers.intersection.observe(el, observers.intersectionConfig);
        }
        if (observers.resize && observers.resizeConfig) {
          observers.resize.observe(el, observers.resizeConfig);
        }
      }
    });
  }

  // Singleton implementation
  static instance = null;
  
  static getInstance() {
    if (!DOMFreezer.instance) {
      DOMFreezer.instance = new DOMFreezer();
    }
    return DOMFreezer.instance;
  }
}

export default DOMFreezer;