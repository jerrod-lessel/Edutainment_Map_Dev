// engine/demo.js
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

// Simple placeholder draw: color by mask type + label
function maskLabel(mask) {
  if (mask === 0) return '';
  if (mask === 15) return '+';
  if (mask === 5) return '|';
  if (mask === 10) return '—';
  if ([3,6,9,12].includes(mask)) return 'L';
  if ([7,11,13,14].includes(mask)) return 'T';
  return 'o'; // endcap or unknown
}

function maskColor(mask) {
  if (mask === 0) return '#e8eef6'; // background
  if (mask === 15) return '#444';   // intersection
  if ([5,10].includes(mask)) return '#555';
  if ([3,6,9,12].includes(mask)) return '#666';
  if ([7,11,13,14].includes(mask)) return '#777';
  return '#888';
}

// Render
ctx.font = '12px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    const mask = masks[y * cols + x];

    // cell background
    ctx.fillStyle = '#e8eef6';
    ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);

    // road cell
    if (mask !== 0) {
      ctx.fillStyle = maskColor(mask);
      ctx.fillRect(x * cellPx + 2, y * cellPx + 2, cellPx - 4, cellPx - 4);

      ctx.fillStyle = 'white';
      ctx.fillText(maskLabel(mask), x * cellPx + cellPx / 2, y * cellPx + cellPx / 2);
    }

    // grid lines
    ctx.strokeStyle = '#c7d2e3';
    ctx.strokeRect(x * cellPx, y * cellPx, cellPx, cellPx);
  }
}
