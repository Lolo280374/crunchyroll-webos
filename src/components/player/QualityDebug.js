import React, { useState, useEffect } from 'react';

/**
 * Component for showing video quality information with countdown
 * Specifically optimized for WebOS 3.5 
 */
const QualityDebug = ({ playerRef, loading }) => {
  const [countdown, setCountdown] = useState(10);
  const [showQuality, setShowQuality] = useState(false);
  const [qualityInfo, setQualityInfo] = useState({
    height: '?',
    bitrate: '?',
    bufferLevel: 0
  });
  
  // Count down before showing quality
  useEffect(() => {
    if (!loading && playerRef.current && !showQuality) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowQuality(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [loading, playerRef, showQuality]);
  
  // Update quality info when available
  useEffect(() => {
    if (!loading && playerRef.current && showQuality) {
      const updateInterval = setInterval(() => {
        try {
          const player = playerRef.current;
          const videoQualities = player.getBitrateInfoListFor('video');
          const currentQuality = player.getQualityFor('video');
          const currentInfo = videoQualities[currentQuality];
          const bufferLevel = player.getBufferLength('video') || 0;
          
          setQualityInfo({
            height: currentInfo.height || '?',
            bitrate: Math.round(currentInfo.bitrate/1000) || '?',
            bufferLevel: bufferLevel.toFixed(1)
          });
        } catch (e) {
          setQualityInfo({
            height: 'Error',
            bitrate: 'Error',
            bufferLevel: 0
          });
        }
      }, 2000);
      
      return () => clearInterval(updateInterval);
    }
  }, [loading, playerRef, showQuality]);
  
  // Don't render if player isn't ready yet
  if (!playerRef.current || loading) return null;
  
  const style = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    zIndex: 9999
  };
  
  return (
    <div style={style}>
      {!showQuality ? (
        <div>Loading quality info... {countdown}s</div>
      ) : (
        <div>
          <div>{qualityInfo.height}p @ {qualityInfo.bitrate}kbps</div>
          <div>Buffer: {qualityInfo.bufferLevel}s</div>
        </div>
      )}
    </div>
  );
};

export default QualityDebug;