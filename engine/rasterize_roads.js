// docs/engine/rasterize_roads.js
import { project } from './webmercator.js';

// ---------------------------
// Supercover line traversal
// Fills all grid cells touched by the segment
// ---------------------------
function supercoverLine(x0, y0, x1, y1, plot) {
  let dx = x1 - x0;
  let dy = y1 - y0;

  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  dx = Math.abs(dx);
  dy = Math.abs(dy);

  let x = x0;
  let y = y0;

  plot(x, y);
  if (dx === 0 && dy === 0) return;

  let tMaxX, tMaxY;
  let tDeltaX, tDeltaY;

  if (dx === 0) {
    tDeltaX = Infinity;
    tMaxX = Infinity;
  } else {
    tDeltaX = 1 / dx;
    tMaxX = tDeltaX / 2;
  }

  if (dy === 0) {
    tDeltaY = Infinity;
    tMaxY = Infinity;
  } else {
    tDeltaY = 1 / dy;
    tMaxY = tDeltaY / 2;
  }

  const n = dx + dy;
  for (let i = 0; i < n; i++) {
    if (tMaxX < tMaxY) {
      x += sx;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX) {
      y += sy;
      tMaxY += tDeltaY;
    } else {
      // Corner-crossing: step both
      x += sx;
      y += sy;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    }
    plot(x, y);
  }
}

// ---------------------------
// Extract LineStrings from GeoJSON
// ---------------------------
function extractRoadLines(geojson) {
  const out = [];
  if (!geojson) return out;

  const walk = (g) => {
    if (!g) return;
    if (g.type === 'FeatureCollection') {
      g.features.forEach(walk);
    } else if (g.type === 'Feature') {
      walk(g.geometry);
    } else if (g.type === 'LineString') {
      out.push(g.coordinates);
    } else if (g.type === 'MultiLineString') {
      g.coordinates.forEach(line => out.push(line));
    } else if (g.type === 'GeometryCollection') {
      g.geometries.forEach(walk);
    }
  };

  walk(geojson);
  return out;
}

// ---------------------------
// Fix A: bridge 1-cell gaps so 4-neighbor connectivity stays continuous
// (keeps roads effectively 1-cell wide, but closes tiny holes)
// ---------------------------
function bridgeGaps(grid, cols, rows, passes = 1) {
  const idx = (x, y) => y * cols + x;

  for (let p = 0; p < passes; p++) {
    const next = grid.slice(); // copy

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const i = idx(x, y);
        if (grid[i] === 1) continue;

        const n = grid[idx(x, y - 1)] === 1;
        const e = grid[idx(x + 1, y)] === 1;
        const s = grid[idx(x, y + 1)] === 1;
        const w = grid[idx(x - 1, y)] === 1;

        // Straight bridges (most important)
        if ((w && e) || (n && s)) {
          next[i] = 1;
          continue;
        }

        // Optional diagonal bridges (helps "touching at corners" breaks)
        const ne = grid[idx(x + 1, y - 1)] === 1;
        const nw = grid[idx(x - 1, y - 1)] === 1;
        const se = grid[idx(x + 1, y + 1)] === 1;
        const sw = grid[idx(x - 1, y + 1)] === 1;

        if ((ne && sw) || (nw && se)) {
          next[i] = 1;
        }
      }
    }

    grid = next;
  }

  return grid;
}

// ---------------------------
// Main: Rasterize OSM roads (GeoJSON) into a grid
// ---------------------------
export function rasterizeRoadsToGrid({
  geojson,
  bounds,          // { west, south, east, north } in lon/lat
  cellSizeMeters,  // 10
  brush = 0        // 0 = 1-cell wide, 1 = slightly thicker, etc.
}) {
  // Project bounds to meters
  const sw = project(bounds.west, bounds.south);
  const ne = project(bounds.east, bounds.north);

  const widthM = ne.x - sw.x;
  const heightM = ne.y - sw.y;

  const cols = Math.ceil(widthM / cellSizeMeters);
  const rows = Math.ceil(heightM / cellSizeMeters);

  const grid = new Uint8Array(cols * rows);

  // Burn helper with thickness
  const burn = (cx, cy) => {
    const b = Math.max(0, brush);
    for (let dy = -b; dy <= b; dy++) {
      for (let dx = -b; dx <= b; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        grid[y * cols + x] = 1;
      }
    }
  };

  // Convert lon/lat to grid cell coordinates
  // Note: rows increase downward from the top edge (ne.y), matching our overlay drawing
  const toCell = (lon, lat) => {
    const p = project(lon, lat);
    const cx = Math.floor((p.x - sw.x) / cellSizeMeters);
    const cy = Math.floor((ne.y - p.y) / cellSizeMeters);
    return { cx, cy };
  };

  const lines = extractRoadLines(geojson);

  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon0, lat0] = line[i];
      const [lon1, lat1] = line[i + 1];

      const a = toCell(lon0, lat0);
      const b = toCell(lon1, lat1);

      supercoverLine(a.cx, a.cy, b.cx, b.cy, (x, y) => burn(x, y));
    }
  }

  // Fix A: close tiny gaps to improve 4-neighbor connectivity
  const bridged = bridgeGaps(grid, cols, rows, 2);

  return { grid: bridged, cols, rows };
}
