// /engine/rasterize_roads.js
import { project } from './webmercator.js';

function supercoverLine(x0, y0, x1, y1, plot) {
  // Based on a classic "supercover" grid traversal:
  // ensures all cells touched by the segment are plotted.
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

  // tMaxX/tMaxY track when we cross the next vertical/horizontal grid boundary
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

  // Step count upper bound
  const n = dx + dy;

  for (let i = 0; i < n; i++) {
    if (tMaxX < tMaxY) {
      x += sx;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX) {
      y += sy;
      tMaxY += tDeltaY;
    } else {
      // Exactly on a corner: step both directions to avoid gaps
      x += sx;
      y += sy;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    }
    plot(x, y);
  }
}

function extractRoadLines(geojson) {
  // Overpass GeoJSON often exports ways as LineString with coordinates already.
  // We'll handle FeatureCollection with LineString/MultiLineString.
  const lines = [];

  const walk = (g) => {
    if (!g) return;
    if (g.type === 'FeatureCollection') g.features.forEach(walk);
    else if (g.type === 'Feature') walk(g.geometry);
    else if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => lines.push(l));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(walk);
  };

  walk(geojson);
  return lines;
}

export function rasterizeRoadsToGrid({
  geojson,
  bounds,          // { west, south, east, north } in lon/lat
  cellSizeMeters,  // 10
  brush = 1        // thickness in cells
}) {
  // Project bounds to meters
  const sw = project(bounds.west, bounds.south);
  const ne = project(bounds.east, bounds.north);

  const widthM = ne.x - sw.x;
  const heightM = ne.y - sw.y;

  const cols = Math.ceil(widthM / cellSizeMeters);
  const rows = Math.ceil(heightM / cellSizeMeters);

  const grid = new Uint8Array(cols * rows);

  const burn = (cx, cy) => {
    for (let dy = -brush; dy <= brush; dy++) {
      for (let dx = -brush; dx <= brush; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        grid[y * cols + x] = 1;
      }
    }
  };

  const toCell = (lon, lat) => {
    const p = project(lon, lat);
    const cx = Math.floor((p.x - sw.x) / cellSizeMeters);
    // y increases downward in canvas; WebMercator y increases upward,
    // so we flip by measuring from the top (ne.y).
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

  return { grid, cols, rows };
}
