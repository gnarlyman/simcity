# Isometric Rendering Specifications

## Overview

This document specifies the isometric rendering system for the SimCity clone. The game uses a **2:1 dimetric projection** (commonly called "isometric" in games), where tiles are diamond-shaped with a 2:1 width-to-height ratio.

## Coordinate Systems

### Three Coordinate Spaces

```
┌─────────────────────────────────────────────────────────────────┐
│                     COORDINATE SYSTEMS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. WORLD SPACE (Grid)          2. ISOMETRIC SPACE              │
│     ┌───┬───┬───┐                    ◇                          │
│     │0,0│1,0│2,0│                   ╱ ╲                         │
│     ├───┼───┼───┤                  ◇   ◇                        │
│     │0,1│1,1│2,1│                 ╱ ╲ ╱ ╲                       │
│     ├───┼───┼───┤                ◇   ◇   ◇                      │
│     │0,2│1,2│2,2│               ╱ ╲ ╱ ╲ ╱ ╲                     │
│     └───┴───┴───┘              ◇   ◇   ◇   ◇                    │
│                                                                 │
│  3. SCREEN SPACE (Pixels)                                       │
│     ┌────────────────────┐                                      │
│     │  (0,0)             │                                      │
│     │    ┌─────┐         │                                      │
│     │    │     │         │                                      │
│     │    └─────┘         │                                      │
│     │         (1280,720) │                                      │
│     └────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Tile Dimensions

```typescript
// Core tile measurements
const TILE_WIDTH = 64;    // Pixels (horizontal span of diamond)
const TILE_HEIGHT = 32;   // Pixels (vertical span of diamond)
const TILE_DEPTH = 16;    // Pixels (height of one elevation level)

// Derived measurements
const HALF_TILE_WIDTH = TILE_WIDTH / 2;   // 32
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;  // 16
```

### Coordinate Transformation

```typescript
/**
 * Convert world grid coordinates to isometric screen coordinates
 */
function worldToIsometric(worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: (worldX - worldY) * HALF_TILE_WIDTH,
    y: (worldX + worldY) * HALF_TILE_HEIGHT
  };
}

/**
 * Convert isometric coordinates to world grid coordinates
 */
function isometricToWorld(isoX: number, isoY: number): { x: number; y: number } {
  return {
    x: (isoX / HALF_TILE_WIDTH + isoY / HALF_TILE_HEIGHT) / 2,
    y: (isoY / HALF_TILE_HEIGHT - isoX / HALF_TILE_WIDTH) / 2
  };
}

/**
 * Convert world coordinates to screen coordinates (with camera)
 */
function worldToScreen(
  worldX: number, 
  worldY: number, 
  worldZ: number,
  camera: IsometricCamera
): { x: number; y: number } {
  const iso = worldToIsometric(worldX, worldY);
  
  // Apply elevation (z-axis moves sprite up)
  const elevatedY = iso.y - worldZ * TILE_DEPTH;
  
  // Apply camera transform
  const screenX = (iso.x - camera.x) * camera.zoom + camera.viewportWidth / 2;
  const screenY = (elevatedY - camera.y) * camera.zoom + camera.viewportHeight / 2;
  
  return { x: screenX, y: screenY };
}

/**
 * Convert screen coordinates to world grid position
 */
function screenToWorld(
  screenX: number, 
  screenY: number, 
  camera: IsometricCamera
): { x: number; y: number } {
  // Reverse camera transform
  const isoX = (screenX - camera.viewportWidth / 2) / camera.zoom + camera.x;
  const isoY = (screenY - camera.viewportHeight / 2) / camera.zoom + camera.y;
  
  // Convert to world (assuming z = 0)
  return isometricToWorld(isoX, isoY);
}
```

## Tile Sprite Specifications

### Base Tile Format

```
                    (32, 0)
                       ◆
                      ╱ ╲
                     ╱   ╲
                    ╱     ╲
                   ╱       ╲
            (0, 16)◆         ◆(64, 16)
                   ╲       ╱
                    ╲     ╱
                     ╲   ╱
                      ╲ ╱
                       ◆
                    (32, 32)

Tile Sprite: 64 × 32 pixels
Anchor Point: (32, 16) - center of diamond
```

### Tile Types and Sizes

| Tile Type | Width | Height | Anchor | Notes |
|-----------|-------|--------|--------|-------|
| Flat ground | 64 | 32 | (32, 16) | Standard tile |
| Slope (low) | 64 | 40 | (32, 24) | 8px elevation |
| Slope (steep) | 64 | 48 | (32, 32) | 16px elevation |
| Cliff face | 64 | 64 | (32, 48) | Vertical wall |
| Water | 64 | 32 | (32, 16) | Animated |

### Building Sprite Format

Buildings extend above the base tile:

```
           Building Sprite
        ┌─────────────────────┐
        │    Building Top     │
        │                     │
        │    Building Body    │
        │                     │
        ├─────────────────────┤ ← Base line (anchor Y)
        │◇◇◇ Base Tile ◇◇◇│
        └─────────────────────┘

Anchor Point: Bottom center of base tile footprint
```

### Multi-Tile Buildings

Buildings can span multiple tiles:

```typescript
interface BuildingSprite {
  // Sprite dimensions
  width: number;
  height: number;
  
  // Anchor point (pixel offset from top-left)
  anchorX: number;
  anchorY: number;
  
  // Footprint in tiles
  footprintWidth: number;   // X direction
  footprintDepth: number;   // Y direction
  
  // Sorting offset (for proper z-ordering)
  sortOffset: number;
}

// Example: 2x2 tile building
const apartment2x2: BuildingSprite = {
  width: 128,
  height: 96,
  anchorX: 64,
  anchorY: 80,
  footprintWidth: 2,
  footprintDepth: 2,
  sortOffset: 0
};
```

## Sprite Sheet Organization

### Naming Convention

```
{category}_{type}_{variant}_{state}

Examples:
- terrain_grass_flat_default
- terrain_grass_slope_n
- zone_residential_low_empty
- building_house_small_stage1
- road_straight_ns_default
- road_intersection_4way_default
```

### Sprite Sheet Layout

```typescript
interface SpriteSheetConfig {
  name: string;
  image: string;
  tileWidth: number;
  tileHeight: number;
  frames: FrameDefinition[];
}

interface FrameDefinition {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX?: number;  // Default: width/2
  anchorY?: number;  // Default: height - 16
}

// Example sheet configuration
const terrainSheet: SpriteSheetConfig = {
  name: 'terrain',
  image: 'assets/sprites/terrain.png',
  tileWidth: 64,
  tileHeight: 32,
  frames: [
    { name: 'grass_flat', x: 0, y: 0, width: 64, height: 32 },
    { name: 'grass_slope_n', x: 64, y: 0, width: 64, height: 48 },
    { name: 'grass_slope_e', x: 128, y: 0, width: 64, height: 48 },
    { name: 'grass_slope_s', x: 192, y: 0, width: 64, height: 48 },
    { name: 'grass_slope_w', x: 256, y: 0, width: 64, height: 48 },
    { name: 'water_0', x: 0, y: 48, width: 64, height: 32 },
    { name: 'water_1', x: 64, y: 48, width: 64, height: 32 },
    { name: 'water_2', x: 128, y: 48, width: 64, height: 32 },
    // ... more frames
  ]
};
```

## Depth Sorting (Z-Order)

### Painter's Algorithm

Isometric rendering requires correct back-to-front ordering:

```typescript
/**
 * Calculate sort key for an entity
 * Higher values = rendered later (on top)
 */
function calculateSortKey(worldX: number, worldY: number, worldZ: number): number {
  // Primary sort: isometric depth (sum of x + y)
  // Secondary sort: elevation (z)
  return (worldX + worldY) * 1000 + worldZ;
}

/**
 * Sort entities for rendering
 */
function sortForRendering(entities: RenderEntity[]): RenderEntity[] {
  return entities.sort((a, b) => {
    const keyA = calculateSortKey(a.worldX, a.worldY, a.worldZ);
    const keyB = calculateSortKey(b.worldX, b.worldY, b.worldZ);
    return keyA - keyB;
  });
}
```

### Multi-Tile Entity Sorting

For entities spanning multiple tiles, use the frontmost tile:

```typescript
function getEntitySortPosition(entity: RenderEntity): { x: number; y: number } {
  // Use the frontmost (highest x + y) tile of the footprint
  const footprint = entity.footprint;
  return {
    x: entity.worldX + footprint.width - 1,
    y: entity.worldY + footprint.depth - 1
  };
}
```

### Render Layers

Separate layers for different entity types:

```typescript
const RENDER_LAYERS = [
  'terrain',      // Ground tiles
  'water',        // Water surface (with animation)
  'zones',        // Zone overlays
  'underground',  // Pipes, subway (when visible)
  'roads',        // Roads, rails
  'buildings',    // All buildings
  'vehicles',     // Cars, trains, planes
  'effects',      // Smoke, fire, particles
  'overlay',      // Selection, highlights
  'ui'            // World-space UI elements
] as const;

type RenderLayer = typeof RENDER_LAYERS[number];

interface RenderEntity {
  layer: RenderLayer;
  sprite: PIXI.Sprite;
  worldX: number;
  worldY: number;
  worldZ: number;
  sortOffset: number;  // Fine-tuning within layer
}
```

## Camera System

### Camera State

```typescript
interface CameraState {
  // Position in isometric space
  x: number;
  y: number;
  
  // Zoom level
  zoom: number;
  
  // Viewport dimensions
  viewportWidth: number;
  viewportHeight: number;
}

class IsometricCamera {
  // Current state
  private state: CameraState;
  
  // Constraints
  readonly minZoom = 0.25;
  readonly maxZoom = 4.0;
  readonly zoomStep = 0.1;
  
  // Smoothing
  private targetX: number;
  private targetY: number;
  private targetZoom: number;
  readonly smoothing = 0.15;
  
  update(deltaTime: number): void {
    // Smooth interpolation
    this.state.x += (this.targetX - this.state.x) * this.smoothing;
    this.state.y += (this.targetY - this.state.y) * this.smoothing;
    this.state.zoom += (this.targetZoom - this.state.zoom) * this.smoothing;
  }
  
  pan(deltaX: number, deltaY: number): void {
    this.targetX += deltaX / this.state.zoom;
    this.targetY += deltaY / this.state.zoom;
  }
  
  zoomAt(screenX: number, screenY: number, delta: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    
    this.targetZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, this.targetZoom * (1 + delta * this.zoomStep))
    );
    
    // Keep world point under cursor after zoom
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.targetX += (worldBefore.x - worldAfter.x) * HALF_TILE_WIDTH;
    this.targetY += (worldBefore.y - worldAfter.y) * HALF_TILE_HEIGHT;
  }
  
  centerOn(worldX: number, worldY: number): void {
    const iso = worldToIsometric(worldX, worldY);
    this.targetX = iso.x;
    this.targetY = iso.y;
  }
}
```

### View Culling

Only render visible tiles:

```typescript
function getVisibleTiles(camera: IsometricCamera, mapWidth: number, mapHeight: number): TileBounds {
  // Get screen corners in world space
  const corners = [
    camera.screenToWorld(0, 0),
    camera.screenToWorld(camera.viewportWidth, 0),
    camera.screenToWorld(0, camera.viewportHeight),
    camera.screenToWorld(camera.viewportWidth, camera.viewportHeight)
  ];
  
  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }
  
  // Add padding for partially visible tiles and tall buildings
  const padding = 5;
  
  return {
    minX: Math.max(0, Math.floor(minX) - padding),
    maxX: Math.min(mapWidth - 1, Math.ceil(maxX) + padding),
    minY: Math.max(0, Math.floor(minY) - padding),
    maxY: Math.min(mapHeight - 1, Math.ceil(maxY) + padding)
  };
}
```

## Terrain Rendering

### Elevation Handling

```typescript
interface TerrainTile {
  baseElevation: number;     // Base height level (0-15)
  slopeType: SlopeType;      // Flat, N, S, E, W, corners
  surfaceType: SurfaceType;  // Grass, dirt, rock, etc.
}

enum SlopeType {
  FLAT = 'flat',
  SLOPE_N = 'slope_n',   // Rises to north
  SLOPE_S = 'slope_s',
  SLOPE_E = 'slope_e',
  SLOPE_W = 'slope_w',
  CORNER_NE = 'corner_ne',  // Inner corners
  CORNER_NW = 'corner_nw',
  CORNER_SE = 'corner_se',
  CORNER_SW = 'corner_sw',
  CORNER_INV_NE = 'corner_inv_ne',  // Outer corners
  CORNER_INV_NW = 'corner_inv_nw',
  CORNER_INV_SE = 'corner_inv_se',
  CORNER_INV_SW = 'corner_inv_sw',
  CLIFF_N = 'cliff_n',
  CLIFF_S = 'cliff_s',
  CLIFF_E = 'cliff_e',
  CLIFF_W = 'cliff_w'
}
```

### Terrain Tile Selection

```typescript
function selectTerrainSprite(tile: TerrainTile, neighbors: NeighborElevations): string {
  const { baseElevation, surfaceType, slopeType } = tile;
  
  // Determine slope based on neighbor elevations
  const calculatedSlope = calculateSlopeType(baseElevation, neighbors);
  
  // Build sprite name
  return `terrain_${surfaceType}_${calculatedSlope}`;
}

function calculateSlopeType(elevation: number, neighbors: NeighborElevations): SlopeType {
  const { n, s, e, w, ne, nw, se, sw } = neighbors;
  
  // Check for slopes
  const northHigher = n > elevation;
  const southHigher = s > elevation;
  const eastHigher = e > elevation;
  const westHigher = w > elevation;
  
  // Cardinal slopes
  if (northHigher && !southHigher && !eastHigher && !westHigher) return SlopeType.SLOPE_N;
  if (southHigher && !northHigher && !eastHigher && !westHigher) return SlopeType.SLOPE_S;
  if (eastHigher && !northHigher && !southHigher && !westHigher) return SlopeType.SLOPE_E;
  if (westHigher && !northHigher && !southHigher && !eastHigher) return SlopeType.SLOPE_W;
  
  // Corner slopes
  if (northHigher && eastHigher) return SlopeType.CORNER_NE;
  if (northHigher && westHigher) return SlopeType.CORNER_NW;
  if (southHigher && eastHigher) return SlopeType.CORNER_SE;
  if (southHigher && westHigher) return SlopeType.CORNER_SW;
  
  return SlopeType.FLAT;
}
```

## Water Rendering

### Animated Water

```typescript
interface WaterRenderer {
  frameCount: number;
  frameDuration: number;  // ms per frame
  currentFrame: number;
  elapsedTime: number;
  
  update(deltaTime: number): void;
  getSpriteName(): string;
}

class AnimatedWater implements WaterRenderer {
  frameCount = 4;
  frameDuration = 250;
  currentFrame = 0;
  elapsedTime = 0;
  
  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    
    if (this.elapsedTime >= this.frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.elapsedTime = 0;
    }
  }
  
  getSpriteName(): string {
    return `water_${this.currentFrame}`;
  }
}
```

### Water Depth Visualization

```typescript
function getWaterSprite(depth: number): string {
  // Deeper water = darker shade
  if (depth <= 1) return 'water_shallow';
  if (depth <= 3) return 'water_medium';
  return 'water_deep';
}
```

## Road Rendering

### Auto-Tiling System

Roads automatically connect to adjacent roads:

```typescript
interface RoadNeighbors {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

function selectRoadSprite(neighbors: RoadNeighbors): string {
  const { n, s, e, w } = neighbors;
  const count = [n, s, e, w].filter(Boolean).length;
  
  // No connections (shouldn't happen in normal play)
  if (count === 0) return 'road_single';
  
  // End pieces
  if (count === 1) {
    if (n) return 'road_end_s';
    if (s) return 'road_end_n';
    if (e) return 'road_end_w';
    if (w) return 'road_end_e';
  }
  
  // Straight roads
  if (count === 2) {
    if (n && s) return 'road_straight_ns';
    if (e && w) return 'road_straight_ew';
    
    // Corners
    if (n && e) return 'road_corner_ne';
    if (n && w) return 'road_corner_nw';
    if (s && e) return 'road_corner_se';
    if (s && w) return 'road_corner_sw';
  }
  
  // T-intersections
  if (count === 3) {
    if (!n) return 'road_t_s';
    if (!s) return 'road_t_n';
    if (!e) return 'road_t_w';
    if (!w) return 'road_t_e';
  }
  
  // 4-way intersection
  return 'road_intersection_4way';
}
```

## Building Rendering

### Growth Stages

Buildings can have multiple visual stages:

```typescript
interface BuildingVisual {
  type: string;
  stage: number;       // 1, 2, or 3
  style: string;       // Visual variant
  condition: string;   // normal, abandoned, under_construction
}

function getBuildingSprite(building: BuildingVisual): string {
  const { type, stage, style, condition } = building;
  
  if (condition === 'under_construction') {
    return `building_construction_stage${stage}`;
  }
  
  if (condition === 'abandoned') {
    return `building_${type}_${style}_abandoned`;
  }
  
  return `building_${type}_${style}_stage${stage}`;
}
```

### Building Footprints

```typescript
const BUILDING_FOOTPRINTS: Record<string, { width: number; depth: number }> = {
  // Residential
  'house_small': { width: 1, depth: 1 },
  'house_medium': { width: 2, depth: 1 },
  'house_large': { width: 2, depth: 2 },
  'apartment_low': { width: 2, depth: 2 },
  'apartment_mid': { width: 2, depth: 3 },
  'apartment_high': { width: 3, depth: 3 },
  'condo_tower': { width: 2, depth: 2 },
  
  // Commercial
  'shop_small': { width: 1, depth: 1 },
  'shop_medium': { width: 2, depth: 1 },
  'office_low': { width: 2, depth: 2 },
  'office_mid': { width: 3, depth: 3 },
  'office_high': { width: 3, depth: 4 },
  'skyscraper': { width: 4, depth: 4 },
  
  // Industrial
  'farm': { width: 4, depth: 4 },
  'factory_small': { width: 2, depth: 2 },
  'factory_large': { width: 4, depth: 4 },
  'warehouse': { width: 3, depth: 2 },
  
  // Civic
  'power_plant': { width: 4, depth: 4 },
  'police_station': { width: 2, depth: 2 },
  'fire_station': { width: 2, depth: 2 },
  'hospital': { width: 4, depth: 4 },
  'school': { width: 3, depth: 3 }
};
```

## Performance Optimization

### Sprite Batching

```typescript
class TileBatcher {
  private batches: Map<string, PIXI.ParticleContainer>;
  private maxParticles = 10000;
  
  constructor() {
    this.batches = new Map();
  }
  
  getBatch(sheetName: string): PIXI.ParticleContainer {
    if (!this.batches.has(sheetName)) {
      const container = new PIXI.ParticleContainer(this.maxParticles, {
        position: true,
        uvs: true,
        tint: true
      });
      this.batches.set(sheetName, container);
    }
    return this.batches.get(sheetName)!;
  }
  
  clear(): void {
    for (const batch of this.batches.values()) {
      batch.removeChildren();
    }
  }
}
```

### Chunk-Based Rendering

```typescript
interface RenderChunk {
  x: number;
  y: number;
  sprites: PIXI.Container;
  dirty: boolean;
  visible: boolean;
}

class ChunkedRenderer {
  private chunks: Map<string, RenderChunk>;
  readonly chunkSize = 16;  // 16x16 tiles per chunk
  
  updateVisibility(camera: IsometricCamera): void {
    const visibleBounds = getVisibleTiles(camera, this.mapWidth, this.mapHeight);
    
    for (const [key, chunk] of this.chunks) {
      const chunkInView = this.isChunkInBounds(chunk, visibleBounds);
      chunk.sprites.visible = chunkInView;
    }
  }
  
  rebuildChunk(chunkX: number, chunkY: number): void {
    const key = `${chunkX},${chunkY}`;
    const chunk = this.chunks.get(key);
    if (!chunk || !chunk.dirty) return;
    
    chunk.sprites.removeChildren();
    
    // Add all tile sprites in this chunk
    for (let y = 0; y < this.chunkSize; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        const worldX = chunkX * this.chunkSize + x;
        const worldY = chunkY * this.chunkSize + y;
        
        const sprite = this.createTileSprite(worldX, worldY);
        chunk.sprites.addChild(sprite);
      }
    }
    
    chunk.dirty = false;
  }
}
```

## Debug Visualization

### Grid Overlay

```typescript
function createGridOverlay(width: number, height: number): PIXI.Graphics {
  const graphics = new PIXI.Graphics();
  graphics.lineStyle(1, 0x888888, 0.5);
  
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      const { x: sx, y: sy } = worldToIsometric(x, y);
      
      // Draw tile outline
      graphics.moveTo(sx, sy - HALF_TILE_HEIGHT);
      graphics.lineTo(sx + HALF_TILE_WIDTH, sy);
      graphics.lineTo(sx, sy + HALF_TILE_HEIGHT);
      graphics.lineTo(sx - HALF_TILE_WIDTH, sy);
      graphics.lineTo(sx, sy - HALF_TILE_HEIGHT);
    }
  }
  
  return graphics;
}
```

### Tile Highlight

```typescript
function createTileHighlight(worldX: number, worldY: number, color: number): PIXI.Graphics {
  const { x, y } = worldToIsometric(worldX, worldY);
  
  const graphics = new PIXI.Graphics();
  graphics.beginFill(color, 0.4);
  graphics.lineStyle(2, color, 1);
  
  graphics.moveTo(x, y - HALF_TILE_HEIGHT);
  graphics.lineTo(x + HALF_TILE_WIDTH, y);
  graphics.lineTo(x, y + HALF_TILE_HEIGHT);
  graphics.lineTo(x - HALF_TILE_WIDTH, y);
  graphics.closePath();
  
  graphics.endFill();
  
  return graphics;
}
