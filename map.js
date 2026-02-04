// Initialize the map
const map = L.map('map', {
  zoomControl: true,
  attributionControl: false
});

// Guadalupe-focused view (rough center)
map.setView([34.9715, -120.5713], 13);

// Clean basemap (calm, modern)
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 18
  }
).addTo(map);

// Guadalupe world bounds (approximate, we refine later)
const guadalupeBounds = L.latLngBounds(
  [34.920, -120.640], // Southwest (ocean)
  [35.010, -120.500]  // Northeast (river / county line)
);

// Keep map inside Guadalupe
map.setMaxBounds(guadalupeBounds);

map.on('drag', function () {
  map.panInsideBounds(guadalupeBounds, { animate: false });
});

L.rectangle(guadalupeBounds, {
  color: '#666',
  weight: 1,
  dashArray: '4,4',
  fillOpacity: 0
}).addTo(map);
