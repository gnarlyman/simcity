# Technical Architecture

## Overview

This document describes the technical architecture for the SimCity clone, designed for web-based deployment with automated testing and iterative AI-assisted development.

## Technology Stack

### Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | TypeScript 5.x | Type-safe JavaScript |
| **Renderer** | PixiJS 8.x | WebGL 2D rendering |
| **Build Tool** | Vite 5.x | Fast dev server, HMR |
| **Testing** | Vitest + Puppeteer | Unit & E2E testing |
| **State Management** | Custom ECS | Entity-Component-System |

### Supporting Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `simplex-noise` | ^4.0 | Terrain generation |
| `pathfinding` | ^0.4 | A* pathfinding |
| `tweakpane` | ^4.0 | Debug UI |
| `eventemitter3` | ^5.0 | Event system |

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │     UI      │  │   Input     │  │   Audio     │             │
│  │  Components │  │   Handler   │  │   Manager   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    GAME ENGINE                               ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               ││
│  │  │  Render   │  │Simulation │  │   State   │               ││
│  │  │  System   │  │   Loop    │  │  Manager  │               ││
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               ││
│  │        │              │              │                       ││
│  │        ▼              ▼              ▼                       ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │                 GAME SYSTEMS                         │   ││
│  │  │  Terrain│Zone│Transport│Utility│Service│Finance│Sim │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                          │                                   ││
│  │                          ▼                                   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │                   DATA LAYER                         │   ││
│  │  │     Grid│Entities│Components│Events│Config          │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
/simcity
├── docs/                    # Documentation
│   ├── game-design/         # Game design documents
│   ├── technical/           # Technical specifications
│   └── visual/              # Visual specifications
├── src/
│   ├── core/                # Core engine
│   │   ├── Engine.ts        # Main game loop
│   │   ├── ECS.ts           # Entity-Component-System
│   │   ├── EventBus.ts      # Event system
│   │   └── StateManager.ts  # Save/Load state
│   ├── systems/             # Game systems
│   │   ├── TerrainSystem.ts
│   │   ├── ZoneSystem.ts
│   │   ├── TransportSystem.ts
│   │   ├── UtilitySystem.ts
│   │   ├── BuildingSystem.ts
│   │   ├── SimulationSystem.ts
│   │   └── FinanceSystem.ts
│   ├── rendering/           # Rendering
│   │   ├── Renderer.ts      # PixiJS wrapper
│   │   ├── IsometricCamera.ts
│   │   ├── TileRenderer.ts
│   │   ├── SpriteManager.ts
│   │   └── layers/          # Render layers
│   ├── ui/                  # User interface
│   │   ├── UIManager.ts
│   │   ├── Toolbar.ts
│   │   ├── InfoPanel.ts
│   │   └── components/
│   ├── input/               # Input handling
│   │   ├── InputManager.ts
│   │   ├── MouseHandler.ts
│   │   └── KeyboardHandler.ts
│   ├── data/                # Data structures
│   │   ├── Grid.ts
│   │   ├── types.ts
│   │   └── constants.ts
│   ├── utils/               # Utilities
│   │   ├── math.ts
│   │   ├── noise.ts
│   │   └── pathfinding.ts
│   └── main.ts              # Entry point
├── assets/
│   ├── sprites/             # Sprite sheets
│   ├── tiles/               # Tile graphics
│   ├── ui/                  # UI assets
│   └── audio/               # Sound effects
├── tests/
│   ├── unit/                # Unit tests
│   ├── e2e/                 # Puppeteer tests
│   └── snapshots/           # Visual regression
├── public/                  # Static files
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Core Systems

### Entity-Component-System (ECS)

The game uses a simplified ECS architecture for flexibility:

```typescript
// Entity is just an ID
type EntityId = number;

// Components are plain data objects
interface Component {
  type: string;
}

interface PositionComponent extends Component {
  type: 'position';
  x: number;
  y: number;
  z: number;
}

interface ZoneComponent extends Component {
  type: 'zone';
  category: 'residential' | 'commercial' | 'industrial';
  density: 'low' | 'medium' | 'high';
  developed: boolean;
}

// Systems process entities with specific components
interface System {
  name: string;
  requiredComponents: string[];
  update(entities: EntityId[], deltaTime: number): void;
}

// World manages all entities and systems
class World {
  private entities: Map<EntityId, Map<string, Component>>;
  private systems: System[];
  private nextEntityId: number;
  
  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;
  addComponent(entity: EntityId, component: Component): void;
  getComponent<T extends Component>(entity: EntityId, type: string): T | null;
  query(componentTypes: string[]): EntityId[];
  update(deltaTime: number): void;
}
```

### Event System

Decoupled communication via events:

```typescript
interface GameEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

interface ZoneCreatedEvent extends GameEvent {
  type: 'zone:created';
  data: {
    entityId: EntityId;
    position: GridPosition;
    zoneType: ZoneType;
  };
}

interface BuildingDevelopedEvent extends GameEvent {
  type: 'building:developed';
  data: {
    entityId: EntityId;
    buildingType: string;
    population: number;
    jobs: number;
  };
}

class EventBus {
  on<T extends GameEvent>(type: string, handler: (event: T) => void): void;
  off<T extends GameEvent>(type: string, handler: (event: T) => void): void;
  emit<T extends GameEvent>(event: T): void;
}
```

### Game Loop

Fixed timestep simulation with variable rendering:

```typescript
class Engine {
  private readonly SIMULATION_TICK = 100; // ms
  private accumulator = 0;
  private lastTime = 0;
  private speed: SimulationSpeed = 'normal';
  
  private speedMultipliers = {
    paused: 0,
    slow: 0.5,
    normal: 1,
    fast: 4
  };
  
  update(currentTime: number): void {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Add to accumulator (scaled by speed)
    const multiplier = this.speedMultipliers[this.speed];
    this.accumulator += deltaTime * multiplier;
    
    // Fixed timestep simulation updates
    while (this.accumulator >= this.SIMULATION_TICK) {
      this.simulate(this.SIMULATION_TICK);
      this.accumulator -= this.SIMULATION_TICK;
    }
    
    // Variable timestep rendering (always 60fps)
    this.render(deltaTime);
  }
  
  private simulate(dt: number): void {
    // Update all simulation systems in order
    for (const system of this.simulationSystems) {
      system.update(dt);
    }
  }
  
  private render(dt: number): void {
    this.renderer.render(this.world, this.camera);
  }
}
```

## Data Layer

### Grid System

The city is built on a 2D grid:

```typescript
interface GridPosition {
  x: number;  // Column
  y: number;  // Row
}

class Grid<T> {
  private data: T[][];
  readonly width: number;
  readonly height: number;
  
  constructor(width: number, height: number, defaultValue: () => T);
  
  get(pos: GridPosition): T;
  set(pos: GridPosition, value: T): void;
  
  isValid(pos: GridPosition): boolean;
  getNeighbors(pos: GridPosition, diagonal?: boolean): GridPosition[];
  
  forEach(callback: (value: T, pos: GridPosition) => void): void;
  map<U>(callback: (value: T, pos: GridPosition) => U): Grid<U>;
}

// Specialized grids
type TerrainGrid = Grid<TerrainCell>;
type ZoneGrid = Grid<ZoneCell>;
type UtilityGrid = Grid<UtilityCell>;
```

### Chunk System

For large maps, use chunks for efficient access:

```typescript
const CHUNK_SIZE = 32;

interface Chunk<T> {
  x: number;  // Chunk coordinate
  y: number;
  data: Grid<T>;
  dirty: boolean;
  lastAccess: number;
}

class ChunkedGrid<T> {
  private chunks: Map<string, Chunk<T>>;
  private loadedChunks: number;
  private maxLoadedChunks: number;
  
  get(pos: GridPosition): T {
    const chunk = this.getOrLoadChunk(pos);
    const localPos = this.toLocalPosition(pos);
    return chunk.data.get(localPos);
  }
  
  private getOrLoadChunk(pos: GridPosition): Chunk<T> {
    const chunkPos = this.toChunkPosition(pos);
    const key = `${chunkPos.x},${chunkPos.y}`;
    
    if (!this.chunks.has(key)) {
      this.loadChunk(chunkPos);
    }
    
    const chunk = this.chunks.get(key)!;
    chunk.lastAccess = Date.now();
    return chunk;
  }
  
  private evictOldChunks(): void {
    // LRU eviction when at capacity
  }
}
```

## Rendering System

### PixiJS Integration

```typescript
import * as PIXI from 'pixi.js';

class Renderer {
  private app: PIXI.Application;
  private layers: Map<string, PIXI.Container>;
  private camera: IsometricCamera;
  
  constructor(canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio
    });
    
    this.initLayers();
  }
  
  private initLayers(): void {
    // Render order (back to front)
    const layerNames = [
      'terrain',
      'water',
      'zones',
      'roads',
      'buildings',
      'vehicles',
      'effects',
      'ui-world',  // World-space UI (selection boxes)
      'debug'
    ];
    
    for (const name of layerNames) {
      const container = new PIXI.Container();
      this.app.stage.addChild(container);
      this.layers.set(name, container);
    }
  }
  
  getLayer(name: string): PIXI.Container {
    return this.layers.get(name)!;
  }
}
```

### Isometric Camera

```typescript
class IsometricCamera {
  // World position (center of view)
  x: number = 0;
  y: number = 0;
  
  // Zoom level
  zoom: number = 1;
  minZoom: number = 0.25;
  maxZoom: number = 4;
  
  // Viewport size
  viewportWidth: number;
  viewportHeight: number;
  
  // Convert world position to screen position
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    // Isometric transformation
    const isoX = (worldX - worldY) * (TILE_WIDTH / 2);
    const isoY = (worldX + worldY) * (TILE_HEIGHT / 2);
    
    // Apply camera transform
    const screenX = (isoX - this.x) * this.zoom + this.viewportWidth / 2;
    const screenY = (isoY - this.y) * this.zoom + this.viewportHeight / 2;
    
    return { x: screenX, y: screenY };
  }
  
  // Convert screen position to world position
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Reverse camera transform
    const isoX = (screenX - this.viewportWidth / 2) / this.zoom + this.x;
    const isoY = (screenY - this.viewportHeight / 2) / this.zoom + this.y;
    
    // Reverse isometric transformation
    const worldX = (isoX / (TILE_WIDTH / 2) + isoY / (TILE_HEIGHT / 2)) / 2;
    const worldY = (isoY / (TILE_HEIGHT / 2) - isoX / (TILE_WIDTH / 2)) / 2;
    
    return { x: worldX, y: worldY };
  }
  
  // Get visible grid bounds for culling
  getVisibleBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const topLeft = this.screenToWorld(0, 0);
    const topRight = this.screenToWorld(this.viewportWidth, 0);
    const bottomLeft = this.screenToWorld(0, this.viewportHeight);
    const bottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    
    return {
      minX: Math.floor(Math.min(topLeft.x, bottomLeft.x)) - 1,
      maxX: Math.ceil(Math.max(topRight.x, bottomRight.x)) + 1,
      minY: Math.floor(Math.min(topLeft.y, topRight.y)) - 1,
      maxY: Math.ceil(Math.max(bottomLeft.y, bottomRight.y)) + 1
    };
  }
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
```

### Sprite Management

```typescript
interface SpriteSheet {
  texture: PIXI.Texture;
  frames: Map<string, PIXI.Rectangle>;
}

class SpriteManager {
  private sheets: Map<string, SpriteSheet>;
  private spritePool: Map<string, PIXI.Sprite[]>;
  
  async loadSheet(name: string, url: string, frameData: FrameData[]): Promise<void> {
    const texture = await PIXI.Assets.load(url);
    const frames = new Map<string, PIXI.Rectangle>();
    
    for (const frame of frameData) {
      frames.set(frame.name, new PIXI.Rectangle(
        frame.x, frame.y, frame.width, frame.height
      ));
    }
    
    this.sheets.set(name, { texture, frames });
  }
  
  getSprite(sheet: string, frame: string): PIXI.Sprite {
    const poolKey = `${sheet}:${frame}`;
    
    // Try pool first
    const pool = this.spritePool.get(poolKey);
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    
    // Create new sprite
    const sheetData = this.sheets.get(sheet)!;
    const frameRect = sheetData.frames.get(frame)!;
    const texture = new PIXI.Texture({
      source: sheetData.texture.source,
      frame: frameRect
    });
    
    return new PIXI.Sprite(texture);
  }
  
  releaseSprite(sprite: PIXI.Sprite, sheet: string, frame: string): void {
    const poolKey = `${sheet}:${frame}`;
    let pool = this.spritePool.get(poolKey);
    if (!pool) {
      pool = [];
      this.spritePool.set(poolKey, pool);
    }
    pool.push(sprite);
  }
}
```

## State Management

### Save/Load System

```typescript
interface GameState {
  version: string;
  timestamp: number;
  city: {
    name: string;
    population: number;
    funds: number;
    date: GameDate;
  };
  terrain: SerializedTerrain;
  zones: SerializedZone[];
  buildings: SerializedBuilding[];
  roads: SerializedRoad[];
  utilities: SerializedUtilities;
  simulation: SimulationState;
}

class StateManager {
  serialize(world: World): GameState {
    return {
      version: GAME_VERSION,
      timestamp: Date.now(),
      city: this.serializeCity(world),
      terrain: this.serializeTerrain(world),
      zones: this.serializeZones(world),
      buildings: this.serializeBuildings(world),
      roads: this.serializeRoads(world),
      utilities: this.serializeUtilities(world),
      simulation: this.serializeSimulation(world)
    };
  }
  
  deserialize(state: GameState, world: World): void {
    // Validate version
    if (!this.isCompatible(state.version)) {
      throw new Error(`Incompatible save version: ${state.version}`);
    }
    
    // Load in dependency order
    this.deserializeTerrain(state.terrain, world);
    this.deserializeRoads(state.roads, world);
    this.deserializeZones(state.zones, world);
    this.deserializeBuildings(state.buildings, world);
    this.deserializeUtilities(state.utilities, world);
    this.deserializeSimulation(state.simulation, world);
  }
  
  async saveToFile(state: GameState): Promise<void> {
    const json = JSON.stringify(state);
    const blob = new Blob([json], { type: 'application/json' });
    // Use File System Access API or download
  }
  
  async loadFromFile(): Promise<GameState> {
    // Use File System Access API or file input
  }
}
```

## Testing Architecture

### Unit Tests (Vitest)

```typescript
// tests/unit/zone-system.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ZoneSystem } from '../../src/systems/ZoneSystem';
import { World } from '../../src/core/ECS';

describe('ZoneSystem', () => {
  let world: World;
  let zoneSystem: ZoneSystem;
  
  beforeEach(() => {
    world = new World();
    zoneSystem = new ZoneSystem(world);
  });
  
  describe('zone placement', () => {
    it('should create zone entity with correct components', () => {
      const position = { x: 10, y: 10 };
      const entityId = zoneSystem.createZone(position, {
        category: 'residential',
        density: 'low'
      });
      
      expect(world.getComponent(entityId, 'position')).toEqual({
        type: 'position',
        x: 10,
        y: 10,
        z: 0
      });
      
      expect(world.getComponent(entityId, 'zone')).toMatchObject({
        category: 'residential',
        density: 'low',
        developed: false
      });
    });
    
    it('should require road access for development', () => {
      const zoneId = zoneSystem.createZone({ x: 50, y: 50 }, {
        category: 'residential',
        density: 'low'
      });
      
      // No road nearby
      expect(zoneSystem.canDevelop(zoneId)).toBe(false);
      
      // Add road
      world.createRoad({ x: 50, y: 51 });
      expect(zoneSystem.canDevelop(zoneId)).toBe(true);
    });
  });
});
```

### E2E Tests (Puppeteer)

```typescript
// tests/e2e/city-building.test.ts
import puppeteer, { Browser, Page } from 'puppeteer';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('City Building E2E', () => {
  let browser: Browser;
  let page: Page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#game-canvas');
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  it('should display empty terrain on new game', async () => {
    await page.click('[data-test="new-game"]');
    await page.waitForSelector('[data-test="game-loaded"]');
    
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('new-game-terrain');
  });
  
  it('should zone residential area', async () => {
    // Select residential zone tool
    await page.click('[data-test="tool-zone-residential-low"]');
    
    // Drag to create zone
    const canvas = await page.$('#game-canvas');
    const box = await canvas!.boundingBox();
    
    await page.mouse.move(box!.x + 400, box!.y + 300);
    await page.mouse.down();
    await page.mouse.move(box!.x + 500, box!.y + 400);
    await page.mouse.up();
    
    // Verify zone created
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('residential-zone-created');
  });
});
```

### Visual Regression

```typescript
// tests/e2e/visual-regression.ts
import { toMatchImageSnapshot } from 'jest-image-snapshot';

expect.extend({ toMatchImageSnapshot });

async function captureGameState(page: Page, name: string): Promise<void> {
  const screenshot = await page.screenshot({
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 720 }
  });
  
  expect(screenshot).toMatchImageSnapshot({
    customSnapshotIdentifier: name,
    failureThreshold: 0.01,
    failureThresholdType: 'percent'
  });
}
```

## Configuration

### Environment Config

```typescript
// src/config/environment.ts
export const config = {
  // Rendering
  targetFPS: 60,
  maxDeltaTime: 100,
  
  // Simulation
  simulationTickMs: 100,
  
  // Map
  defaultMapSize: 128,
  chunkSize: 32,
  maxLoadedChunks: 64,
  
  // Isometric
  tileWidth: 64,
  tileHeight: 32,
  
  // Debug
  showFPS: import.meta.env.DEV,
  showGrid: false,
  showChunkBorders: false
};
```

### Runtime Config (Tweakpane)

```typescript
// src/debug/DebugPanel.ts
import { Pane } from 'tweakpane';

export function createDebugPanel(engine: Engine): Pane {
  const pane = new Pane({ title: 'Debug' });
  
  // Simulation
  const simFolder = pane.addFolder({ title: 'Simulation' });
  simFolder.addBinding(engine, 'speed', {
    options: {
      paused: 'paused',
      slow: 'slow',
      normal: 'normal',
      fast: 'fast'
    }
  });
  
  // Rendering
  const renderFolder = pane.addFolder({ title: 'Rendering' });
  renderFolder.addBinding(config, 'showGrid');
  renderFolder.addBinding(config, 'showChunkBorders');
  
  // Stats
  const statsFolder = pane.addFolder({ title: 'Stats' });
  statsFolder.addMonitor(engine.stats, 'fps');
  statsFolder.addMonitor(engine.stats, 'entities');
  statsFolder.addMonitor(engine.stats, 'drawCalls');
  
  return pane;
}
```

## Performance Guidelines

### Optimization Strategies

1. **Object Pooling**: Reuse sprites and objects
2. **Spatial Hashing**: Fast spatial queries
3. **View Culling**: Only render visible tiles
4. **Dirty Flags**: Only update changed regions
5. **Web Workers**: Offload pathfinding calculations

### Memory Management

```typescript
// Object pool pattern
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  
  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 100) {
    this.factory = factory;
    this.reset = reset;
    
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }
  
  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }
  
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

### Profiling

```typescript
class Profiler {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();
  
  start(name: string): void {
    this.marks.set(name, performance.now());
  }
  
  end(name: string): void {
    const start = this.marks.get(name);
    if (start) {
      const duration = performance.now() - start;
      let samples = this.measurements.get(name);
      if (!samples) {
        samples = [];
        this.measurements.set(name, samples);
      }
      samples.push(duration);
      if (samples.length > 100) samples.shift();
    }
  }
  
  getAverage(name: string): number {
    const samples = this.measurements.get(name);
    if (!samples || samples.length === 0) return 0;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }
}
