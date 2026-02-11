// engine/leaflet_sprite_overlay.js
export class SpriteOverlay extends L.Layer {
  constructor(options) {
    super();
    this.options = options;
    this._map = null;
    this._canvas = null;
    this._ctx = null;
  }

  onAdd(map) {
    this._map = map;

    // Ensure we draw above tiles
    const paneName = 'spritePane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = 650;
    }

    this._canvas = L.DomUtil.create('canvas', 'leaflet-layer');
    this._canvas.style.pointerEvents = 'none';
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
  }

  _reset() {
    if (!this._map || !this._canvas) return;

    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;

    // Anchor canvas to the map container (correct DOM positioning)
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    this._draw();
  }

  _draw() {
    const {
      cols, rows,
      sw, ne,                 // EPSG:3857 meters
      cellSizeMeters,
      masks,
      atlasImg,
      atlasTilePx,
      atlasMap
    } = this.options;

    const map = this._map;
    const ctx = this._ctx;
    if (!map || !ctx) return;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.imageSmoothingEnabled = false;

    // 1) Get current map bounds in EPSG:3857 meters
    const b = map.getBounds();
    const bSW = L.CRS.EPSG3857.project(b.getSouthWest());
    const bNE = L.CRS.EPSG3857.project(b.getNorthEast());

    // 2) Compute overlap between map bounds and our grid bounds
    const left = Math.max(sw.x, bSW.x);
    const right = Math.min(ne.x, bNE.x);
    const top = Math.min(ne.y, bNE.y);
    const bottom = Math.max(sw.y, bSW.y);

    // If no overlap, draw nothing
    if (left >= right || bottom >= top) return;

    // 3) Convert overlap bounds to grid indices
    const minCol = Math.max(0, Math.floor((left - sw.x) / cellSizeMeters) - 2);
    const maxCol = Math.min(cols - 1, Math.floor((right - sw.x) / cellSizeMeters) + 2);

    // rows are counted from the top (ne.y downward), matching your rasterizer
    const minRow = Math.max(0, Math.floor((ne.y - top) / cellSizeMeters) - 2);
    const maxRow = Math.min(rows - 1, Math.floor((ne.y - bottom) / cellSizeMeters) + 2);

    // 4) Compute how many pixels a 10m step is at current zoom (use local measurement)
    const testY = ne.y - minRow * cellSizeMeters;
    const p0LL = L.CRS.EPSG3857.unproject(L.point(sw.x, testY));
    const p1LL = L.CRS.EPSG3857.unproject(L.point(sw.x + cellSizeMeters, testY));
    const p0 = map.latLngToContainerPoint(p0LL);
    const p1 = map.latLngToContainerPoint(p1LL);
    const cellPx = Math.max(1, Math.round(Math.abs(p1.x - p0.x)));

    // 5) Draw sprites for visible cells
    for (let r = minRow; r <= maxRow; r++) {
      const yMeters = ne.y - r * cellSizeMeters; // NW corner y for this row

      for (let c = minCol; c <= maxCol; c++) {
        const mask = masks[r * cols + c];
        if (!mask) continue;

        const entry = atlasMap[mask];
        if (!entry) continue;

        const xMeters = sw.x + c * cellSizeMeters; // NW corner x for this col

        const ll = L.CRS.EPSG3857.unproject(L.point(xMeters, yMeters));
        const pt = map.latLngToContainerPoint(ll);

        const sx = entry.tx * atlasTilePx;
        const sy = entry.ty * atlasTilePx;

        ctx.drawImage(
          atlasImg,
          sx, sy, atlasTilePx, atlasTilePx,
          pt.x, pt.y,
          cellPx, cellPx
        );
      }
    }
  }
}
