import { computeMaskGrid } from './autotile.js';
import { rasterizeRoadsToGrid } from './rasterize_roads.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const cellSizeMeters = 10;

// Your Guadalupe bounds from earlier code
const bounds = {
  west: -120.640,
  south: 34.920,
  east: -120.500,
  north: 35.010
};

// Sprite atlas config (same mapping you already fixed)
const atlas = {
  imgUrl: './sprites_placeholder.png',
  tilePx: 32,
  map: {
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
  }
};

// Visual scale for demo (pixels per grid cell)
const cellPx = 6; // try 3–6 depending on how big you want it

function drawSprite(img, tx, ty, dx, dy, dSize) {
  const s = atlas.tilePx;
  ctx.drawImage(img, tx * s, ty * s, s, s, dx, dy, dSize, dSize);
}

async function main() {
  // Load real roads GeoJSON
  const roads = await fetch('./eng_data/roads_guadalupe.geojson').then(r => r.json());

  // Rasterize to 10m grid
  const { grid, cols, rows } = rasterizeRoadsToGrid({
    geojson: roads,
    bounds,
    cellSizeMeters,
    brush: 1
  });

  // Compute autotile masks
  const masks = computeMaskGrid(grid, cols, rows);

  // Size canvas to fit grid
  canvas.width = cols * cellPx;
  canvas.height = rows * cellPx;

  // Load atlas image and render
  const img = new Image();
  img.onload = () => {
    ctx.imageSmoothingEnabled = false;

    // background
    ctx.fillStyle = '#e8eef6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw road sprites
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const mask = masks[y * cols + x];
        if (mask === 0) continue;

        const entry = atlas.map[mask];
        if (!entry) continue;

        drawSprite(img, entry.tx, entry.ty, x * cellPx, y * cellPx, cellPx);
      }
    }
  };
  img.src = atlas.imgUrl;
}

main();
