export const generateStaticMapUrl = (geoData, rows, width = 800, height = 600) => {
  if (!geoData || Object.keys(geoData).length === 0) return null;

  // Calculate bounds with padding
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  Object.values(geoData).forEach(feature => {
    if (!feature.geometry || !feature.geometry.coordinates) return;

    feature.geometry.coordinates[0].forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  // Add 10% padding to bounds
  const lngPadding = (maxLng - minLng) * 0.1;
  const latPadding = (maxLat - minLat) * 0.1;
  const bounds = [
    [minLng - lngPadding, minLat - latPadding],
    [maxLng + lngPadding, maxLat + latPadding]
  ].map(coord => coord.map(n => parseFloat(n.toFixed(6))));

  // Prepare GeoJSON features with simplified coordinates
  const features = Object.entries(geoData).map(([id, feature]) => {
    const row = rows.find(r => r.id === id || r.dealId === id);
    const rowIndex = rows.indexOf(row) + 1;

    // Simplify coordinates to 6 decimal places
    const simplifiedCoords = feature.geometry.coordinates[0].map(([lng, lat]) => [
      parseFloat(lng.toFixed(6)),
      parseFloat(lat.toFixed(6))
    ]);

    return {
      type: 'Feature',
      properties: {
        id,
        rowIndex,
        isDMRE: row?.isDMRE || false,
        fill: row?.isDMRE ? '#0077b6' : '#ff8c00',
        'fill-opacity': 0.5,
        stroke: '#ffffff',
        'stroke-width': 1
      },
      geometry: {
        type: 'Polygon',
        coordinates: [simplifiedCoords]
      }
    };
  });

  // Create markers for each feature (centroids)
  const markers = features.map(feature => {
    const coords = feature.geometry.coordinates[0];
    const center = coords.reduce((acc, [lng, lat]) => {
      acc.lng += lng;
      acc.lat += lat;
      return acc;
    }, { lng: 0, lat: 0 });

    center.lng /= coords.length;
    center.lat /= coords.length;

    return {
      coordinates: [center.lng, center.lat],
      label: feature.properties.rowIndex.toString(),
      color: feature.properties.isDMRE ? '0077b6' : 'ff8c00',
      labelColor: 'ffffff'
    };
  });

  // Construct the URL components
  const baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static';

  // 1. Add GeoJSON overlay (simplified)
  const geojson = {
    type: 'FeatureCollection',
    features: features
  };

  // 2. Add markers
  const markerParams = markers.map(marker =>
    `pin-s-${marker.color}+${marker.labelColor}(${marker.coordinates[0]},${marker.coordinates[1]})`
  ).join(',');

  // 3. Construct the final URL
  const url = new URL(baseUrl);

  // Add path components
  url.pathname += `/geojson(${encodeURIComponent(JSON.stringify(geojson))})`;

  if (markerParams) {
    url.pathname += `/${markerParams}`;
  }

  url.pathname += `/${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`;
  url.pathname += `/${width}x${height}`;

  // Add query parameters
  url.searchParams.append('access_token', process.env.REACT_APP_MAPBOX_API_KEY);
  url.searchParams.append('attribution', 'false');
  url.searchParams.append('logo', 'false');

  console.log('Generated Mapbox URL:', url.toString());
  return url.toString();
};
