import React from 'react';
import { useRef, useEffect, useState } from 'react';
import { generateStaticMapUrl } from './MapboxStaticMap';

const MapRenderer = ({ geoData, rows, width = 800, height = 600 }) => {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (canvasRef.current && geoData) {
      setIsRendering(true);

      const mapUrl = generateStaticMapUrl(geoData, rows, width, height);
      if (mapUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setIsRendering(false);
        };
        img.onerror = () => {
          console.error('Failed to load map image');
          setIsRendering(false);
        };
        img.src = mapUrl;
      }
    }
  }, [geoData, rows, width, height]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%' }}
      />
      {isRendering && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.7)'
        }}>
          <div>Loading map...</div>
        </div>
      )}
    </div>
  );
};

export default MapRenderer;
