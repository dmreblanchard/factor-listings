import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const MapExporter = ({ map }) => {
  const exportMap = () => {
    if (!map) return;

    // 1. Create an off-screen canvas at 2x resolution
    const originalCanvas = map.getCanvas();
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    const scale = 2; // For high DPI (retina quality)

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width * scale;
    exportCanvas.height = height * scale;
    const ctx = exportCanvas.getContext('2d');

    // 2. Apply smoothing for better text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Draw the base map
    ctx.drawImage(
      originalCanvas,
      0, 0, width, height,
      0, 0, exportCanvas.width, exportCanvas.height
    );

    // 4. Add custom enhancements
    addWatermark(ctx, exportCanvas.width, exportCanvas.height);

    // 5. Trigger download
    exportCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'map-export.png');
      URL.revokeObjectURL(url); // Clean up
    }, 'image/png', 1.0); // Maximum quality
  };

  const addWatermark = (ctx, width, height) => {
    ctx.font = `${width * 0.02}px Arial`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(
      `Exported ${new Date().toLocaleDateString()}`,
      width - 20,
      height - 20
    );
  };

  const triggerDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={exportMap}
      className="export-button"
    >
      Export High-Res Map (2x)
    </button>
  );
};

export default MapExporter;
