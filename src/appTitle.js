import utils from './utils';

/**
 * Updates the webOS app title dynamically
 * @param {String} title - The new title to set
 */
export const updateAppTitle = (title) => {
  if (utils.isTv() && window.webOS) {
    try {
      // Get the default app title as fallback
      const defaultTitle = "Crunchyroll";
      
      // Format the title properly
      const formattedTitle = title ? `${defaultTitle} - ${title}` : defaultTitle;
      
      // Set the app title using webOS API
      if (window.webOS.application && typeof window.webOS.application.setAppTitle === 'function') {
        window.webOS.application.setAppTitle(formattedTitle);
      } else {
        // For older webOS versions that might have a different API
        const appMgr = window.webOS.service.request("luna://com.webos.applicationManager", {
          method: "setAppInfo",
          parameters: { 
            appId: "lol.lolodotzip.crunchyroll",
            title: formattedTitle
          },
          onSuccess: () => console.log("App title updated"),
          onFailure: (err) => console.error("Failed to update app title:", err)
        });
      }
    } catch (e) {
      console.error("Error updating app title:", e);
    }
  }
};

/**
 * Computes a title string from content object
 * @param {Object} content - The content object with episode information
 * @returns {String} Formatted title
 */
export const computeContentTitle = (content) => {
  if (!content) return "";
  
  const parts = [];
  
  // Add series title
  if (content.series_title) {
    parts.push(content.series_title);
  } else if (content.title) {
    parts.push(content.title);
  }
  
  // Add episode number for episodes
  if (content.type === 'episode') {
    let epNumber = null;
    if (content.episode_metadata) {
      epNumber = content.episode_metadata.episode_number;
    } else if (content.episode_number) {
      epNumber = content.episode_number;
    }
    
    if (epNumber) {
      parts.push(`E${epNumber}`);
    }
  }
  
  // Add episode title if different from series title
  if (content.subTitle && content.subTitle !== content.title) {
    parts.push(content.subTitle);
  }
  
  return parts.join(' - ');
};