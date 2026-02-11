# SimCit-ify Engine Notes (MVP)

## Core decisions
- Grid cell size: 10 meters (future: LOD by zoom)
- Render mode: static tiles first (future: dynamic canvas/WebGL)
- Style target: SimCity 2000-ish pixel art (top-down)

## MVP 1 scope
- Roads only
- Fake road input (hand-authored grid) to validate autotiling + sprite selection

## Tile vocabulary (roads)
Road connectivity uses 4-neighbor adjacency:
- N = 1
- E = 2
- S = 4
- W = 8
Bitmask = sum of connected directions

Required masks:
- Endcaps: 1,2,4,8
- Straights: 5 (N+S), 10 (E+W)
- Corners: 3 (N+E), 6 (E+S), 12 (S+W), 9 (W+N)
- T-junctions: 7 (N+E+S), 14 (E+S+W), 13 (N+S+W), 11 (N+E+W)
- 4-way: 15 (N+E+S+W)

## Rendering rule
For each road cell:
1) compute bitmask from neighbor road presence
2) pick sprite by bitmask
3) draw sprite for that cell

## Next upgrades
- Replace fake roads with OSM roads (Overpass) -> rasterize to grid
- Add landcover background tiles (ESA WorldCover)
- Add zoning overrides + density decorators
- Animated tiles later (water/trees) using 2-3 frame cycling
