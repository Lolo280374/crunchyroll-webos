/**
 * Provides optimized grid configurations for different sections based on device capabilities
 */
const getGridConfig = (section) => {
  // Check if we're on WebOS 3.5 or lower
  const isLegacyWebOS = window.webOS && 
    window.webOS.device && 
    (parseFloat(window.webOS.device.platformVersion) <= 4);
  
  // Default configuration (for modern devices)
  const defaultConfig = {
    itemsPerRow: 5,
    spacing: 25,
    maxVisibleItems: 24,
    preloadOffscreenItems: 8
  };
  
  // Optimized for WebOS 3.5
  if (isLegacyWebOS) {
    switch (section) {
      case 'home':
        return {
          itemsPerRow: 4,
          spacing: 15,
          maxVisibleItems: 16, // 4 rows of 4
          preloadOffscreenItems: 4
        };
      case 'search':
        return {
          itemsPerRow: 4,
          spacing: 15,
          maxVisibleItems: 8, // 2 rows of 4
          preloadOffscreenItems: 2
        };
      case 'userLists':
        return {
          itemsPerRow: 4,
          spacing: 15,
          maxVisibleItems: 32, // More for user's own lists
          preloadOffscreenItems: 8
        };
      case 'discover':
        return {
          itemsPerRow: 3,
          spacing: 15,
          maxVisibleItems: 6, // 2 rows of 3
          preloadOffscreenItems: 2
        };
      default:
        return {
          itemsPerRow: 4,
          spacing: 15,
          maxVisibleItems: 12,
          preloadOffscreenItems: 4
        };
    }
  }
  
  return defaultConfig;
};

export default getGridConfig;