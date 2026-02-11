// engine/leaflet_sprite_overlay.js
export class SpriteOverlay extends L.Layer {
  constructor(options) {
    super();
    this.options = options;
    this._canvas = null;
    this._ctx = null;
    this._map = null;
  }

  onAdd(map) {
    this._map = map;

    this._canvas = L.DomUtil.create('canvas', 'leaflet-layer');
    this._canvas.style.pointerEvents = 'none';
    this._ctx = this._canvas.getContext('2d');

    const paneName = 'spritePane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = 650; // above tilePane (usually 200)
    }
    map.getPane(paneName).appendChild(this._canvas);

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

    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    this._draw();
  }

  _draw() {
    const {
      cols, rows,
      sw, ne,            
      cellSizeMeters,
      masks,
      atlasImg,
      atlasTilePx,
      atlasMap
    } = this.options;

    const ctx = this._ctx;
    const map = this._map;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.imageSmoothingEnabled = false;

    // NW corner in projected meters is (sw.x, ne.y)
    const nwProjected = L.point(sw.x, ne.y);
    const nwLatLng = L.CRS.EPSG3857.unproject(nwProjected);
    const nwPx = map.latLngToContainerPoint(nwLatLng);

    // How many pixels is one grid cell at current zoom?
    const originLatLng = L.CRS.EPSG3857.unproject(L.point(sw.x, sw.y));
    const stepLatLng = L.CRS.EPSG3857.unproject(L.point(sw.x + cellSizeMeters, sw.y));
    const p0 = map.latLngToContainerPoint(originLatLng);
    const p1 = map.latLngToContainerPoint(stepLatLng);
    const cellPx = Math.max(1, Math.round(Math.abs(p1.x - p0.x)));

    // Figure out visible grid range
    const view = map.getPixelBounds();
    const minCol = Math.max(0, Math.floor((view.min.x - nwPx.x) / cellPx) - 2);
    const maxCol = Math.min(cols - 1, Math.floor((view.max.x - nwPx.x) / cellPx) + 2);
    const minRow = Math.max(0, Math.floor((view.min.y - nwPx.y) / cellPx) - 2);
    const maxRow = Math.min(rows - 1, Math.floor((view.max.y - nwPx.y) / cellPx) + 2);

    // Draw visible sprites
    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const mask = masks[y * cols + x];
        if (!mask) continue;

        const entry = atlasMap[mask];
        if (!entry) continue;

        const sx = entry.tx * atlasTilePx;
        const sy = entry.ty * atlasTilePx;

        const dx = nwPx.x + x * cellPx;
        const dy = nwPx.y + y * cellPx;

        ctx.drawImage(
          atlasImg,
          sx, sy, atlasTilePx, atlasTilePx,
          dx, dy, cellPx, cellPx
        );
      }
    }
  }
}
