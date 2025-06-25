/**
 * Image optimization utility for WebOS 3.5
 */

// Helper to detect WebOS version
const isLegacyWebOS = window.webOS && 
  window.webOS.device && 
  (parseFloat(window.webOS.device.platformVersion) <= 4);

// Default scaling factors based on context
const scalingFactors = {
  thumbnail: isLegacyWebOS ? 0.5 : 1.0,    // Grid view thumbnails
  banner: isLegacyWebOS ? 0.7 : 1.0,       // Content banners
  background: isLegacyWebOS ? 0.3 : 1.0,    // Background images
  poster: isLegacyWebOS ? 0.6 : 1.0,       // Movie/show posters
  profileAvatar: isLegacyWebOS ? 0.6 : 1.0  // User profile pictures
};

/**
 * Process an image URL to optimize resolution for the device
 * 
 * @param {string} url - Original image URL
 * @param {string} type - Image context (thumbnail, banner, etc.)
 * @returns {string} - Optimized image URL
 */
export const optimizeImageUrl = (url, type = 'thumbnail') => {
  if (!url || !isLegacyWebOS) return url;
  
  // If the URL is from Crunchyroll CDN, we can modify dimensions
  if (url.includes('crunchyroll') && url.includes('crop') && url.match(/\/\d+x\d+\//)) {
    // Extract current dimensions
    const match = url.match(/\/(\d+)x(\d+)\//);
    if (match) {
      const [fullMatch, width, height] = match;
      
      // Calculate new dimensions
      const factor = scalingFactors[type] || 0.5;
      const newWidth = Math.floor(parseInt(width) * factor);
      const newHeight = Math.floor(parseInt(height) * factor);
      
      // Replace dimensions in URL
      return url.replace(fullMatch, `/${newWidth}x${newHeight}/`);
    }
  }
  
  return url;
};

/**
 * Get appropriate image quality settings based on context and device
 * @returns {Object} Quality settings
 */
export const getImageQualitySettings = (context = 'default') => {
  if (!isLegacyWebOS) {
    return { quality: 'auto', loading: 'lazy' };
  }
  
  // Return optimized settings for WebOS 3.5
  switch(context) {
    case 'grid':
      return { quality: 'low', loading: 'lazy', decoding: 'async' };
    case 'banner':
      return { quality: 'medium', loading: 'lazy', decoding: 'async' };
    case 'player':
      return { quality: 'high', loading: 'eager', decoding: 'sync' };
    default:
      return { quality: 'low', loading: 'lazy', decoding: 'async' };
  }
};

export default {
  optimizeImageUrl,
  getImageQualitySettings,
  isLegacyWebOS
};