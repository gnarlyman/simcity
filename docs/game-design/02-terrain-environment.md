# Terrain & Environment System

## Overview

Every SimCity 4 city begins as an undeveloped wilderness. The terrain system provides the physical foundation upon which all city development occurs. Understanding terrain is essential because it affects:

- Where buildings can be placed
- How roads and infrastructure are routed
- Water flow and flooding
- Land value and desirability
- Visual aesthetics of the city

## Starting Wilderness State

When a new city is created, the map consists of:

### Initial Elements
| Element | Description |
|---------|-------------|
| **Ground Terrain** | Base elevation mesh with grass/dirt textures |
| **Elevation Variation** | Hills, valleys, plateaus, cliffs |
| **Water Bodies** | Rivers, lakes, ponds, ocean coastline |
| **Trees** | Scattered vegetation, forests, individual trees |
| **Wildlife** | Deer, birds (cosmetic, no gameplay impact) |
| **Ambient Sounds** | Wind, birds, water (audio design) |

### No Man-Made Elements
The starting wilderness contains **zero** human development:
- No roads or paths
- No buildings
- No power lines
- No zones
- No population

## Elevation System

### Height Model
SimCity 4 uses a heightmap-based terrain system:

```
Height Range: 0 to 1000 meters (internal units)
Sea Level: ~250 meters (configurable per region)
Typical Land: 250-400 meters
Mountains: 400-800 meters
Maximum Buildable Slope: ~45 degrees
```

### Data Structure
```typescript
interface TerrainCell {
  elevation: number;        // Height in meters (0-1000)
  waterDepth: number;       // Depth below sea level (0 if above water)
  surfaceType: SurfaceType; // Grass, dirt, rock, sand, etc.
  treeCount: number;        // Number of trees on this cell
  moisture: number;         // Affects vegetation (0.0-1.0)
}

enum SurfaceType {
  GRASS = 'grass',
  DIRT = 'dirt', 
  ROCK = 'rock',
  SAND = 'sand',
  SNOW = 'snow',        // High elevation
  MUD = 'mud',          // Near water
  UNDERWATER = 'underwater'
}
```

### Elevation Effects on Gameplay

| Elevation Feature | Gameplay Impact |
|-------------------|-----------------|
| **Flat land** | Easiest to build on, no extra cost |
| **Gentle slopes** | Buildable with slight cost increase |
| **Steep slopes** | Difficult/impossible to build, requires terraforming |
| **Cliffs** | Cannot build, natural barriers |
| **Peaks** | Limited building, high land value for certain uses |
| **Valleys** | May flood, good for reservoirs |
| **Underwater** | Cannot zone, only water-specific structures |

### Slope Calculation Algorithm

```typescript
function calculateSlope(cell: GridPosition): number {
  const neighbors = getAdjacentCells(cell);
  const centerElevation = getElevation(cell);
  
  let maxDifference = 0;
  for (const neighbor of neighbors) {
    const diff = Math.abs(getElevation(neighbor) - centerElevation);
    maxDifference = Math.max(maxDifference, diff);
  }
  
  // Convert to degrees (assuming 1 cell = 16 meters)
  const slopeAngle = Math.atan(maxDifference / 16) * (180 / Math.PI);
  return slopeAngle;
}

function isBuildable(cell: GridPosition): boolean {
  const slope = calculateSlope(cell);
  const isUnderwater = getWaterDepth(cell) > 0;
  
  return slope <= MAX_BUILDABLE_SLOPE && !isUnderwater;
}

const MAX_BUILDABLE_SLOPE = 45; // degrees
```

## Water System

### Water Body Types

| Type | Characteristics |
|------|-----------------|
| **Ocean** | Infinite water at map edge, saltwater |
| **Lake** | Enclosed fresh water body |
| **River** | Flowing water connecting bodies |
| **Pond** | Small isolated water body |
| **Stream** | Narrow water channel |

### Water Properties

```typescript
interface WaterBody {
  id: string;
  type: 'ocean' | 'lake' | 'river' | 'pond' | 'stream';
  cells: GridPosition[];       // All cells this water occupies
  surfaceLevel: number;        // Water surface elevation
  flowDirection?: Vector2;     // For rivers/streams
  flowRate?: number;           // Cubic meters per second
  salinity: number;            // 0 = fresh, 1 = salt
  pollution: number;           // Pollution level (0.0-1.0)
}
```

### Water Level and Flooding

```
Sea Level Mechanics:
- Water fills all terrain below sea level
- Rivers flow from high elevation to low
- Heavy rain can temporarily raise water levels
- Flooding damages buildings near water
```

### Water Effects on Gameplay

| Effect | Description |
|--------|-------------|
| **Unbuildable** | Cannot zone or build on water tiles |
| **Water Pumps** | Must be placed adjacent to fresh water |
| **Pollution Sink** | Water absorbs and spreads pollution |
| **Desirability** | Waterfront property has higher land value |
| **Transportation** | Enables ferries and seaports |
| **Recreation** | Beaches, marinas increase desirability |

## Vegetation System

### Tree Types

SimCity 4 includes various tree species that vary by:
- Climate/biome setting
- Elevation
- Proximity to water

```typescript
enum TreeType {
  // Deciduous
  OAK = 'oak',
  MAPLE = 'maple',
  ELM = 'elm',
  
  // Coniferous  
  PINE = 'pine',
  SPRUCE = 'spruce',
  FIR = 'fir',
  
  // Tropical
  PALM = 'palm',
  
  // Other
  WILLOW = 'willow',    // Near water
  CACTUS = 'cactus'     // Desert biome
}

interface Tree {
  type: TreeType;
  position: Vector3;      // Precise position within cell
  size: number;           // Growth stage (0.0-1.0)
  health: number;         // Affected by pollution
}
```

### Tree Distribution Algorithm

Trees are procedurally distributed based on:

```typescript
function generateTreeDistribution(cell: GridPosition): number {
  const elevation = getElevation(cell);
  const moisture = getMoisture(cell);
  const slope = calculateSlope(cell);
  
  // Base density from noise
  let density = simplexNoise2D(cell.x * 0.1, cell.y * 0.1);
  
  // Modify by moisture (more water = more trees)
  density *= lerp(0.2, 1.0, moisture);
  
  // Reduce on steep slopes
  density *= 1.0 - (slope / 90);
  
  // Reduce at high elevations (tree line)
  if (elevation > TREE_LINE_ELEVATION) {
    density *= 1.0 - ((elevation - TREE_LINE_ELEVATION) / 200);
  }
  
  // No trees underwater
  if (isUnderwater(cell)) {
    density = 0;
  }
  
  return Math.max(0, Math.min(1, density));
}

const TREE_LINE_ELEVATION = 600; // meters
```

### Tree Effects on Gameplay

| Effect | Description |
|--------|-------------|
| **Air Pollution Reduction** | Trees absorb air pollution |
| **Desirability Boost** | Increases residential land value |
| **Bulldozing Cost** | Must clear trees before building |
| **Regrowth** | Trees slowly regrow on undeveloped land |
| **Fire Hazard** | Forests can catch and spread fire |

## Terrain Modification (Terraforming)

### Mayor Mode Terraforming
In SimCity 4 Mayor Mode, terrain modification is limited:

| Action | Availability |
|--------|--------------|
| **God Mode Terraforming** | Only before city is founded |
| **Mayor Mode** | Cannot directly modify terrain |
| **Automatic Leveling** | Roads/buildings auto-level small slopes |
| **Retaining Walls** | Auto-generated for elevation changes |

### Auto-Leveling Behavior

When placing roads or zones on slopes:

```typescript
function autoLevelTerrain(
  placement: PlacementArea,
  targetElevation: number
): TerrainModification[] {
  const modifications: TerrainModification[] = [];
  
  for (const cell of placement.cells) {
    const currentElevation = getElevation(cell);
    const difference = currentElevation - targetElevation;
    
    if (Math.abs(difference) <= AUTO_LEVEL_THRESHOLD) {
      modifications.push({
        cell,
        oldElevation: currentElevation,
        newElevation: targetElevation,
        type: difference > 0 ? 'cut' : 'fill'
      });
    }
  }
  
  return modifications;
}

const AUTO_LEVEL_THRESHOLD = 8; // meters
```

### Retaining Walls

Generated automatically when:
- Road meets steep elevation change
- Zone borders significant slope
- Building requires level foundation

```typescript
interface RetainingWall {
  startPosition: GridPosition;
  endPosition: GridPosition;
  height: number;           // Wall height in meters
  material: 'concrete' | 'stone' | 'brick';
  side: 'north' | 'south' | 'east' | 'west';
}
```

## Biome System

### Climate Types

SimCity 4 supports different terrain themes:

| Biome | Characteristics |
|-------|-----------------|
| **Temperate** | Green grass, deciduous trees, moderate water |
| **Desert** | Tan/brown ground, cacti, minimal vegetation |
| **Tropical** | Lush green, palm trees, more water |
| **Snow/Arctic** | White ground, evergreen trees, frozen water |

### Biome Configuration

```typescript
interface BiomeConfig {
  name: string;
  groundTextures: {
    low: string;      // Below sea level
    mid: string;      // Normal elevation
    high: string;     // Mountains
  };
  treeTypes: TreeType[];
  waterColor: string;
  skyColor: string;
  ambientSounds: string[];
  seasonalVariation: boolean;
}

const TEMPERATE_BIOME: BiomeConfig = {
  name: 'Temperate',
  groundTextures: {
    low: 'sand',
    mid: 'grass',
    high: 'rock'
  },
  treeTypes: [TreeType.OAK, TreeType.MAPLE, TreeType.PINE],
  waterColor: '#3498db',
  skyColor: '#87ceeb',
  ambientSounds: ['birds', 'wind', 'crickets'],
  seasonalVariation: true
};
```

## Terrain Generation

### Procedural Generation Algorithm

For creating new maps:

```typescript
function generateTerrain(
  width: number,
  height: number,
  config: TerrainGenerationConfig
): TerrainGrid {
  const grid = new TerrainGrid(width, height);
  
  // 1. Base elevation using multiple octaves of noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let elevation = 0;
      let amplitude = 1;
      let frequency = config.baseFrequency;
      
      for (let octave = 0; octave < config.octaves; octave++) {
        elevation += simplexNoise2D(x * frequency, y * frequency) * amplitude;
        amplitude *= config.persistence;
        frequency *= config.lacunarity;
      }
      
      // Normalize and scale
      elevation = (elevation + 1) / 2; // 0 to 1
      elevation = elevation * config.heightRange + config.baseHeight;
      
      grid.setElevation(x, y, elevation);
    }
  }
  
  // 2. Carve rivers
  if (config.riverCount > 0) {
    carveRivers(grid, config.riverCount);
  }
  
  // 3. Create lakes
  fillDepressions(grid, config.seaLevel);
  
  // 4. Generate vegetation
  generateVegetation(grid, config.biome);
  
  return grid;
}

interface TerrainGenerationConfig {
  baseFrequency: number;    // Starting noise frequency
  octaves: number;          // Noise layers
  persistence: number;      // Amplitude reduction per octave
  lacunarity: number;       // Frequency increase per octave
  heightRange: number;      // Max elevation difference
  baseHeight: number;       // Base elevation (sea level)
  seaLevel: number;         // Water surface level
  riverCount: number;       // Number of rivers to generate
  biome: BiomeConfig;       // Biome settings
}
```

## Visual Specifications

### Isometric Terrain Tiles

| Tile Type | Size | Variants |
|-----------|------|----------|
| **Flat** | 64×32 px | By surface type |
| **Slope North** | 64×48 px | Low, medium, steep |
| **Slope South** | 64×48 px | Low, medium, steep |
| **Slope East** | 64×48 px | Low, medium, steep |
| **Slope West** | 64×48 px | Low, medium, steep |
| **Corner (inner)** | 64×48 px | 4 orientations |
| **Corner (outer)** | 64×48 px | 4 orientations |
| **Cliff** | 64×64 px | 4 orientations |

### Water Rendering

```typescript
interface WaterRenderConfig {
  baseColor: string;
  shallowColor: string;
  deepColor: string;
  transparency: number;
  waveAmplitude: number;
  waveFrequency: number;
  reflectionStrength: number;
  foamEnabled: boolean;
  foamColor: string;
}
```

### Tree Sprites

| Tree Size | Sprite Dimensions | LOD Levels |
|-----------|-------------------|------------|
| **Small** | 16×24 px | 1 |
| **Medium** | 24×36 px | 2 |
| **Large** | 32×48 px | 3 |
| **Forest cluster** | 64×48 px | 2 |

## Data Overlays

### Terrain-Related Overlays

| Overlay | Visualization |
|---------|---------------|
| **Elevation** | Color gradient from low (blue) to high (white) |
| **Slope** | Green (flat) to red (steep) |
| **Water Depth** | Blue gradient by depth |
| **Tree Density** | Green intensity |
| **Buildable Area** | Green (yes) / Red (no) |

## Performance Considerations

### Terrain LOD (Level of Detail)

```typescript
interface TerrainLOD {
  level: number;
  cellsPerTile: number;    // How many cells per rendered tile
  treeRendering: 'individual' | 'clustered' | 'billboard';
  waterDetail: 'full' | 'simplified' | 'flat';
  maxRenderDistance: number;
}

const LOD_LEVELS: TerrainLOD[] = [
  { level: 0, cellsPerTile: 1, treeRendering: 'individual', waterDetail: 'full', maxRenderDistance: 50 },
  { level: 1, cellsPerTile: 2, treeRendering: 'clustered', waterDetail: 'simplified', maxRenderDistance: 100 },
  { level: 2, cellsPerTile: 4, treeRendering: 'billboard', waterDetail: 'flat', maxRenderDistance: 200 }
];
```

### Chunked Loading

Large maps should use chunked terrain loading:

```typescript
const CHUNK_SIZE = 32; // 32x32 cells per chunk

interface TerrainChunk {
  x: number;              // Chunk coordinates
  y: number;
  cells: TerrainCell[][];
  mesh: RenderMesh;
  trees: Tree[];
  loaded: boolean;
  lastAccessTime: number;
}
