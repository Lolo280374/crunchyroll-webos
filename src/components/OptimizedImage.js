import { useState, useEffect, useRef } from 'react';
import { optimizeImageUrl, getImageQualitySettings } from '../utils/imageOptimizer';

/**
 * Image component optimized for WebOS 3.5
 * Only loads images when visible, and supports memory management
 */
const OptimizedImage = ({ source, alt, className, style, imageType = 'thumbnail', context = 'grid', ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef();
  
  // Optimize the image URL for WebOS 3.5
  const optimizedSource = optimizeImageUrl(source, imageType);
  
  // Get quality settings
  const qualitySettings = getImageQualitySettings(context);
  
  useEffect(() => {
    // Mark this image as optimized for memory management
    if (imgRef.current) {
      imgRef.current.setAttribute('data-optimized', 'true');
      
      // Apply quality settings
      if (qualitySettings.quality) {
        imgRef.current.setAttribute('fetchpriority', 
          qualitySettings.quality === 'high' ? 'high' : 'low');
      }
    }
  }, [qualitySettings]);

  return (
    <img
      ref={imgRef}
      src={optimizedSource}
      alt={alt || ''}
      className={className}
      style={{
        ...style,
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}
      loading={qualitySettings.loading}
      decoding={qualitySettings.decoding}
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
};

export default OptimizedImage;