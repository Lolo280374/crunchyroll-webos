import React, { useState, useEffect, useRef } from 'react';

/**
 * Image component optimized for WebOS 3.5
 * Only loads images when visible, and supports memory management
 */
const OptimizedImage = ({ source, alt, className, style, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef();
  
  // Check if we're on WebOS 3.5 or lower
  const isLegacyWebOS = window.webOS && 
    window.webOS.device && 
    (parseFloat(window.webOS.device.platformVersion) <= 4);
  
  useEffect(() => {
    // Mark this image as optimized for memory management
    if (imgRef.current && isLegacyWebOS) {
      imgRef.current.setAttribute('data-optimized', 'true');
    }
  }, [isLegacyWebOS]);

  return (
    <img
      ref={imgRef}
      src={source}
      alt={alt || ''}
      className={className}
      style={{
        ...style,
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
};

export default OptimizedImage;