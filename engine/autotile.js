// engine/autotile.js
export function computeRoadBitmask(grid, cols, rows, x, y) {
  const idx = y * cols + x;
  if (grid[idx] !== 1) return 0;

  const has = (xx, yy) => {
    if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) return 0;
    return grid[yy * cols + xx] === 1 ? 1 : 0;
  };

  const n = has(x, y - 1) ? 1 : 0;
  const e = has(x + 1, y) ? 1 : 0;
  const s = has(x, y + 1) ? 1 : 0;
  const w = has(x - 1, y) ? 1 : 0;

  return (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0);
}

export function computeMaskGrid(grid, cols, rows) {
  const masks = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      masks[y * cols + x] = computeRoadBitmask(grid, cols, rows, x, y);
    }
  }
  return masks;
}
