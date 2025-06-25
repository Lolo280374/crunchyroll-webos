/**
 * Manages network requests during playback to prevent interference
 */

class NetworkManager {
  constructor() {
    this.originalFetch = window.fetch;
    this.originalXHR = window.XMLHttpRequest;
    this.blockedDomains = [
      'metrics', 'analytics', 'stats', 'logs', 'telemetry'
    ];
    this.priorityUrls = [
      'license', 'manifest', 'segment', 'init', 'media', 'stream'
    ];
    this.playbackMode = false;
  }

  /**
   * Enable playback mode - prioritize streaming network requests
   */
  enablePlaybackMode() {
    this.playbackMode = true;
    
    // Replace fetch to filter non-essential requests
    window.fetch = (url, options) => {
      if (this.shouldBlockRequest(url)) {
        return new Promise((resolve) => {
          // Return empty response for non-critical requests
          resolve(new Response('{}', { status: 200 }));
        });
      }
      return this.originalFetch(url, options);
    };
    
    // Replace XHR to prioritize streaming requests
    const self = this;
    const originalOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      if (self.shouldPrioritizeRequest(url)) {
        this.setRequestHeader = function(header, value) {
          if (header.toLowerCase() === 'priority') {
            value = 'high';
          }
          XMLHttpRequest.prototype.setRequestHeader.call(this, header, value);
        };
      }
      return originalOpen.apply(this, arguments);
    };
  }

  /**
   * Disable playback mode - restore normal network behavior
   */
  disablePlaybackMode() {
    this.playbackMode = false;
    window.fetch = this.originalFetch;
    window.XMLHttpRequest = this.originalXHR;
  }

  /**
   * Determine if a request should be blocked during playback
   */
  shouldBlockRequest(url) {
    if (!this.playbackMode) return false;
    
    const urlString = url.toString().toLowerCase();
    
    // Block analytics, metrics and non-essential requests
    return this.blockedDomains.some(domain => urlString.includes(domain));
  }
  
  /**
   * Determine if a request should be prioritized during playback
   */
  shouldPrioritizeRequest(url) {
    if (!this.playbackMode) return false;
    
    const urlString = url.toString().toLowerCase();
    
    // Prioritize streaming-related requests
    return this.priorityUrls.some(term => urlString.includes(term));
  }
  
  // Singleton implementation
  static instance = null;
  
  static getInstance() {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }
}

export default NetworkManager;