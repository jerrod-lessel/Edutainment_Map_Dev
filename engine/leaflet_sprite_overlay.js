// engine/leaflet_sprite_overlay.js
export class SpriteOverlay extends L.Layer {
  constructor(options) {
    super();
    this.options = options;
    this._canvas = null;
    this._ctx = null;
    this._map = null;
    this._topLeft = null; // world pixel top-left of the canvas
  }

  onAdd(map) {
    this._map = map;

    this._canvas = L.DomUtil.create('canvas', 'leaflet-layer');
    this._canvas.style.pointerEvents = 'none';

    // Put on a custom pane above tiles
    const paneName = 'spritePane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = 650; // above tilePane
    }
    map.getPane(paneName).appendChild(this._canvas);

    this._ctx = this._canvas.getContext('2d');

    this._reset();
    map.on('move zoom resize', this._reset, this);
  }

  onRemove(map) {
    map.off('move zoom resize', this._reset, this);
    if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas);
    this._canvas = null;
    this._ctx = null;
    this._map = null;
    this._topLeft = null;
  }

  _reset() {
    if (!this._map || !this._canvas) return;

    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;

    // Use world pixel bounds for stable placement
    this._topLeft = this._map.getPixelBounds().min;

    // Position canvas in world pixel space
    L.DomUtil.setPosition(this._canvas, this._topLeft);

    this._draw();
  }

  _draw() {
    const {
      cols, rows,
      sw, ne,                 // projected meters (EPSG:3857)
      cellSizeMeters,
      masks,
      atlasImg,
      atlasTilePx,
      atlasMap
    } = this.options;

    const ctx = this._ctx;
    const map = this._map;
    if (!ctx || !map) return;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Compute NW corner in projected meters: (sw.x, ne.y)
    const nwProjected = L.point(sw.x, ne.y);
    const nwLatLng = L.CRS.EPSG3857.unproject(nwProjected);

    // Convert NW to world pixel coords at current zoom
    const zoom = map.getZoom();
    const nwWorldPx = map.project(nwLatLng, zoom);

    // Determine pixel size of one grid cell (10m) at this zoom
    const originLatLng = L.CRS.EPSG3857.unproject(L.point(sw.x, sw.y));
    const stepLatLng = L.CRS.EPSG3857.unproject(L.point(sw.x + cellSizeMeters, sw.y));
    const p0 = map.project(originLatLng, zoom);
    const p1 = map.project(stepLatLng, zoom);
    const cellPx = Math.max(1, Math.round(Math.abs(p1.x - p0.x)));

    // Visible region in world pixels
    const view = map.getPixelBounds();

    // Compute visible grid range (in grid coords)
    const minCol = Math.max(0, Math.floor((view.min.x - nwWorldPx.x) / cellPx) - 2);
    const maxCol = Math.min(cols - 1, Math.floor((view.max.x - nwWorldPx.x) / cellPx) + 2);
    const minRow = Math.max(0, Math.floor((view.min.y - nwWorldPx.y) / cellPx) - 2);
    const maxRow = Math.min(rows - 1, Math.floor((view.max.y - nwWorldPx.y) / cellPx) + 2);

    // Draw
    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const mask = masks[y * cols + x];
        if (!mask) continue;

        const entry = atlasMap[mask];
        if (!entry) continue;

        const sx = entry.tx * atlasTilePx;
        const sy = entry.ty * atlasTilePx;

        // World pixel location of this grid cell
        const wx = nwWorldPx.x + x * cellPx;
        const wy = nwWorldPx.y + y * cellPx;

        // Convert to canvas pixel coords by subtracting canvas top-left world pixel
        const dx = wx - this._topLeft.x;
        const dy = wy - this._topLeft.y;

        ctx.drawImage(atlasImg, sx, sy, atlasTilePx, atlasTilePx, dx, dy, cellPx, cellPx);
      }
    }
  }
}
