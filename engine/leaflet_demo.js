import { computeMaskGrid } from './autotile.js';
import { rasterizeRoadsToGrid } from './rasterize_roads.js';
import { project } from './webmercator.js';
import { SpriteOverlay } from './leaflet_sprite_overlay.js';

const bounds = {
  west: -120.640,
  south: 34.920,
  east: -120.500,
  north: 35.010
};

const cellSizeMeters = 5;

const atlasMap = {
  1:  { tx: 2, ty: 0 },
  2:  { tx: 3, ty: 0 },
  4:  { tx: 0, ty: 0 },
  8:  { tx: 1, ty: 0 },

  5:  { tx: 0, ty: 1 },
  10: { tx: 1, ty: 1 },

  3:  { tx: 2, ty: 2 },
  6:  { tx: 3, ty: 2 },
  12: { tx: 0, ty: 2 },
  9:  { tx: 1, ty: 2 },

  7:  { tx: 2, ty: 3 },
  14: { tx: 3, ty: 3 },
  13: { tx: 0, ty: 3 },
  11: { tx: 1, ty: 3 },

  15: { tx: 0, ty: 4 }
};

async function main() {
  // Leaflet map
  const map = L.map('map', { zoomControl: true });
  map.setView([34.9715, -120.5713], 14);

  // Basemap for reference
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  // Load roads
  const roads = await fetch('./eng_data/roads_guadalupe.geojson').then(r => r.json());
  
  // Rasterize
  const { grid, cols, rows } = rasterizeRoadsToGrid({
    geojson: roads,
    bounds,
    cellSizeMeters,
    brush: 0
  });

  // Masks
  const masks = computeMaskGrid(grid, cols, rows);
  
  // Grid origin (SW) in WebMercator meters
  const sw = project(bounds.west, bounds.south);
  const ne = project(bounds.east, bounds.north);

  console.log('grid size', cols, rows);
  let roadCells = 0;
  for (const v of grid) if (v === 1) roadCells++;
  console.log('road cells', roadCells);
  
  let maskCells = 0;
  for (const m of masks) if (m !== 0) maskCells++;
  console.log('mask cells', maskCells);
  
  // Load atlas image
  const atlasImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = './sprites_placeholder.png';
  });

  console.log('atlas loaded', atlasImg.width, atlasImg.height);
  
  // Add overlay
  const overlay = new SpriteOverlay({
    cols, rows,
    sw, ne,
    cellSizeMeters,
    masks,
    atlasImg,
    atlasTilePx: 32,
    atlasMap
  });

  overlay.addTo(map);

  // Optional: show bounds rectangle for sanity
  const bb = L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
  );
  L.rectangle(bb, { weight: 1 }).addTo(map);
}

main();
