import { computeMaskGrid } from './autotile.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const cols = 20;
const rows = 20;
const cellPx = 24;

canvas.width = cols * cellPx;
canvas.height = rows * cellPx;

// Build a fake road grid: a plus sign
const grid = new Uint8Array(cols * rows);

// Horizontal road
const hy = 10;
for (let x = 3; x <= 16; x++) grid[hy * cols + x] = 1;

// Vertical road
const vx = 10;
for (let y = 3; y <= 16; y++) grid[y * cols + vx] = 1;

// Compute bitmask per road cell
const masks = computeMaskGrid(grid, cols, rows);

// Sprite atlas config (matches make_sprites.html layout)
const atlas = {
  imgUrl: './sprites_placeholder.png',
  tilePx: 32,
  map: {
    1:  { tx: 0, ty: 0 }, // N
    2:  { tx: 1, ty: 0 }, // E
    4:  { tx: 2, ty: 0 }, // S
    8:  { tx: 3, ty: 0 }, // W

    5:  { tx: 0, ty: 1 }, // NS
    10: { tx: 1, ty: 1 }, // EW

    3:  { tx: 0, ty: 2 }, // NE
    6:  { tx: 1, ty: 2 }, // ES
    12: { tx: 2, ty: 2 }, // SW
    9:  { tx: 3, ty: 2 }, // WN

    7:  { tx: 0, ty: 3 }, // T¬W (N+E+S)
    14: { tx: 1, ty: 3 }, // T¬N (E+S+W)
    13: { tx: 2, ty: 3 }, // T¬E (N+S+W)
    11: { tx: 3, ty: 3 }, // T¬S (N+E+W)

    15: { tx: 0, ty: 4 }, // +
  }
};

function drawGridBackground() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = '#e8eef6';
      ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      ctx.strokeStyle = '#c7d2e3';
      ctx.strokeRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }
  }
}

function drawSprite(img, tx, ty, dx, dy, dSize) {
  const s = atlas.tilePx;
  ctx.drawImage(
    img,
    tx * s, ty * s, s, s,
    dx, dy, dSize, dSize
  );
}

// Load atlas image then render
const img = new Image();
img.onload = () => {
  drawGridBackground();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const mask = masks[y * cols + x];
      if (mask === 0) continue;

      const entry = atlas.map[mask];
      if (!entry) continue; // unknown mask (shouldn't happen in this demo)

      drawSprite(img, entry.tx, entry.ty, x * cellPx, y * cellPx, cellPx);
    }
  }
};
img.src = atlas.imgUrl;
