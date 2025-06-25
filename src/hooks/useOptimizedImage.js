import { useState, useEffect } from 'react';
import { optimizeImageUrl } from '../utils/imageOptimizer';

/**
 * Hook for optimized image loading
 * 
 * @param {string} originalSrc - Original image URL
 * @param {string} type - Image type (thumbnail, banner, etc)
 * @returns {string} Optimized image URL
 */
const useOptimizedImage = (originalSrc, type = 'thumbnail') => {
  const [optimizedSrc, setOptimizedSrc] = useState(null);
  
  useEffect(() => {
    // Set original source while optimizing
    setOptimizedSrc(originalSrc);
    
    // Optimize the image URL
    const optimized = optimizeImageUrl(originalSrc, type);
    setOptimizedSrc(optimized);
  }, [originalSrc, type]);
  
  return optimizedSrc;
};

export default useOptimizedImage;