import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

export const generateMapImageFromGeoData = async (geoData, { width = 800, height = 400 }) => {
  return new Promise((resolve, reject) => {
    const mapContainer = document.createElement('div');
    mapContainer.style.width = `${width}px`;
    mapContainer.style.height = `${height}px`;
    mapContainer.style.position = 'absolute';
    mapContainer.style.top = '-9999px';
    document.body.appendChild(mapContainer);

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_KEY;

    const map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-96.8, 32.9],
      zoom: 10,
      interactive: false,
      preserveDrawingBuffer: true
    });

    map.once('load', () => {
      const features = Object.entries(geoData).map(([id, data], index) => {
        const feature = {
          type: 'Feature',
          properties: {
            id,
            label: data?.properties?.dealName || 'Unnamed',
            markerNum: `${index + 1}`,
          },
          geometry: data.geometry
        };
        return feature;
      });

      const featureCollection = {
        type: 'FeatureCollection',
        features
      };

      // Add polygon data
      map.addSource('properties', {
        type: 'geojson',
        data: featureCollection
      });

      map.addLayer({
        id: 'property-polygons',
        type: 'fill',
        source: 'properties',
        paint: {
          'fill-color': '#0077b6',
          'fill-opacity': 0.4
        }
      });

      map.addLayer({
        id: 'property-borders',
        type: 'line',
        source: 'properties',
        paint: {
          'line-color': '#0077b6',
          'line-width': 2
        }
      });

      // Generate centroid points for markers
      const centroidFeatures = features.map((polygon, index) => {
        const center = turf.centroid(polygon);
        center.properties = {
          markerNum: `${index + 1}`
        };
        return center;
      });

      const markerSource = {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: centroidFeatures
        }
      };

      map.addSource('property-centroids', markerSource);

      // 👇 Circle size (make this a bit smaller)
      map.addLayer({
        id: 'marker-circles',
        type: 'circle',
        source: 'property-centroids',
        paint: {
          'circle-radius': 9, // ← Previously 14 — try 11 or 12
          'circle-color': '#003566'
        }
      });

      // 👇 Text styling
      map.addLayer({
        id: 'marker-labels',
        type: 'symbol',
        source: 'property-centroids',
        layout: {
          'text-field': ['get', 'markerNum'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 9, // ← Previously 12 — dial this down slightly
          'text-offset': [0, 0],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Fit bounds to all polygons
      const bbox = turf.bbox(featureCollection);
      map.fitBounds(bbox, { padding: 30 });

      map.once('idle', () => {
        setTimeout(() => {
          map.getCanvas().toBlob(blob => {
            const reader = new FileReader();
            reader.onload = () => {
              if (mapContainer.parentNode) {
                map.remove();
                mapContainer.parentNode.removeChild(mapContainer);
              }
              resolve(reader.result); // returns a data URL
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }, 'image/png');
        }, 1000);
      });
    });

    map.on('error', (e) => {
      console.error('[❌ Mapbox Error]', e.error);
      reject(e.error);
    });
  });
};
