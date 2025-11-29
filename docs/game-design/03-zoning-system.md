# Zoning System

## Overview

The zoning system is the primary city-building mechanic in SimCity 4. Players designate areas of land for specific types of development, and buildings grow organically within those zones based on demand, desirability, and infrastructure availability.

**Key Principle**: Players don't place individual buildings (except civic buildings). Instead, they paint zones, and the simulation determines what develops.

## Zone Types

### The RCI Model

SimCity 4 uses three primary zone categories:

| Zone | Code | Color | Purpose |
|------|------|-------|---------|
| **Residential** | R | Green | Housing for Sims |
| **Commercial** | C | Blue | Shops, offices, services |
| **Industrial** | I | Yellow | Manufacturing, production, jobs |

### Density Levels

Each zone type has three density variants:

```typescript
enum ZoneDensity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

interface ZoneType {
  category: 'residential' | 'commercial' | 'industrial';
  density: ZoneDensity;
  color: string;
  maxBuildingHeight: number;  // In stories
  minLotSize: number;         // In cells
  maxLotSize: number;         // In cells
}
```

### Residential Zones (R)

| Density | Symbol | Color | Building Types | Max Height |
|---------|--------|-------|----------------|------------|
| **Low (R§)** | R$ | Light Green | Single-family homes, duplexes | 1-2 stories |
| **Medium (R§§)** | R$$ | Green | Apartments, townhouses | 3-6 stories |
| **High (R§§§)** | R$$$ | Dark Green | High-rise apartments, condos | 7-20+ stories |

**Residential produces**: Population, demand for jobs and commerce

### Commercial Zones (C)

| Density | Symbol | Color | Building Types | Max Height |
|---------|--------|-------|----------------|------------|
| **Low (C§)** | C$ | Light Blue | Small shops, gas stations | 1-2 stories |
| **Medium (C§§)** | C$$ | Blue | Strip malls, offices | 3-8 stories |
| **High (C§§§)** | C$$$ | Dark Blue | Skyscrapers, corporate HQs | 10-50+ stories |

**Commercial provides**: Jobs (CS - Commercial Services, CO - Commercial Offices), shopping for Sims

### Industrial Zones (I)

Industrial is more complex with sub-types based on tech level:

| Sub-Type | Symbol | Color | Characteristics |
|----------|--------|-------|-----------------|
| **Agriculture (I-A)** | IA | Light Yellow | Farms, low pollution, large lots |
| **Dirty (I-D)** | ID | Brown | Factories, high pollution |
| **Manufacturing (I-M)** | IM | Orange | Medium pollution, skilled workers |
| **High-Tech (I-HT)** | IHT | Light Blue | Low pollution, educated workers |

```typescript
enum IndustrialType {
  AGRICULTURE = 'agriculture',
  DIRTY = 'dirty',
  MANUFACTURING = 'manufacturing',
  HIGH_TECH = 'high-tech'
}

interface IndustrialZone extends ZoneType {
  industrialType: IndustrialType;
  pollutionLevel: number;       // 0.0 - 1.0
  educationRequirement: number; // Minimum EQ needed
  freightGeneration: number;    // Freight trips per job
}
```

**Industrial provides**: Jobs, goods, freight traffic, pollution

## Zone Placement

### Placement Rules

```typescript
interface ZonePlacementRules {
  // Must have road access
  requiresRoadAccess: boolean;
  
  // Distance from road (in cells)
  maxDistanceFromRoad: number;
  
  // Minimum lot dimensions
  minWidth: number;
  minDepth: number;
  
  // Can only place on valid terrain
  requiresBuildableTerrain: boolean;
  
  // Cannot overlap existing zones/buildings
  requiresEmptyLand: boolean;
}

const ZONE_PLACEMENT_RULES: ZonePlacementRules = {
  requiresRoadAccess: true,
  maxDistanceFromRoad: 4,  // Cells
  minWidth: 1,
  minDepth: 1,
  requiresBuildableTerrain: true,
  requiresEmptyLand: true
};
```

### Road Access Requirement

All zones require road access to develop:

```typescript
function hasRoadAccess(cell: GridPosition, maxDistance: number): boolean {
  // BFS to find nearest road
  const visited = new Set<string>();
  const queue: Array<{ pos: GridPosition; dist: number }> = [
    { pos: cell, dist: 0 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.pos.x},${current.pos.y}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    if (current.dist > maxDistance) continue;
    
    if (isRoad(current.pos)) {
      return true;
    }
    
    for (const neighbor of getAdjacentCells(current.pos)) {
      queue.push({ pos: neighbor, dist: current.dist + 1 });
    }
  }
  
  return false;
}
```

### Zone Painting Tool

The player uses a drag tool to paint zones:

```typescript
interface ZonePaintTool {
  currentZoneType: ZoneType;
  brushSize: 1 | 2 | 3 | 4;  // Width in cells
  
  // Drag painting state
  isDragging: boolean;
  dragStart: GridPosition | null;
  dragCurrent: GridPosition | null;
  
  // Preview
  previewCells: GridPosition[];
  validCells: GridPosition[];
  invalidCells: GridPosition[];
}

function paintZone(
  start: GridPosition,
  end: GridPosition,
  zoneType: ZoneType,
  brushSize: number
): ZoneCell[] {
  const cells: ZoneCell[] = [];
  
  // Get all cells in the painted rectangle
  const paintedCells = getRectangleCells(start, end, brushSize);
  
  for (const cell of paintedCells) {
    if (canZone(cell, zoneType)) {
      cells.push({
        position: cell,
        zoneType: zoneType,
        developed: false,
        building: null,
        lotId: null
      });
    }
  }
  
  return cells;
}
```

### Zoning Costs

| Zone Density | Cost per Tile | Notes |
|--------------|---------------|-------|
| Low Density | §1 | Cheapest |
| Medium Density | §2 | |
| High Density | §3 | Most expensive |
| De-zone | §0 | Free |

## Zone Data Structure

### Cell-Level Data

```typescript
interface ZoneCell {
  position: GridPosition;
  zoneType: ZoneType | null;       // null = unzoned
  developed: boolean;              // Has building?
  building: Building | null;       // Reference to building
  lotId: string | null;            // Which lot this cell belongs to
  desirability: number;            // Calculated desirability
  landValue: number;               // Calculated land value
  roadAccess: boolean;             // Has road access?
  utilities: {
    power: boolean;
    water: boolean;
  };
}
```

### Lot System

Multiple zone cells can combine into a single lot for larger buildings:

```typescript
interface Lot {
  id: string;
  cells: GridPosition[];           // All cells in this lot
  zoneType: ZoneType;
  size: { width: number; depth: number };
  orientation: 'north' | 'south' | 'east' | 'west';  // Facing road
  frontage: GridPosition[];        // Cells touching road
  building: Building | null;
  developmentStage: number;        // 0 = empty, 1-3 = stages
}

// Lot size configurations by density
const LOT_SIZES = {
  residential: {
    low: [
      { width: 1, depth: 2 },
      { width: 2, depth: 2 },
      { width: 2, depth: 3 },
      { width: 3, depth: 3 }
    ],
    medium: [
      { width: 2, depth: 2 },
      { width: 2, depth: 3 },
      { width: 3, depth: 3 },
      { width: 3, depth: 4 }
    ],
    high: [
      { width: 3, depth: 3 },
      { width: 4, depth: 4 },
      { width: 4, depth: 6 }
    ]
  },
  commercial: {
    low: [
      { width: 1, depth: 1 },
      { width: 2, depth: 2 },
      { width: 2, depth: 3 }
    ],
    medium: [
      { width: 2, depth: 3 },
      { width: 3, depth: 3 },
      { width: 3, depth: 4 }
    ],
    high: [
      { width: 3, depth: 4 },
      { width: 4, depth: 4 },
      { width: 4, depth: 6 }
    ]
  },
  industrial: {
    low: [  // Agriculture
      { width: 4, depth: 4 },
      { width: 6, depth: 6 },
      { width: 8, depth: 8 }
    ],
    medium: [
      { width: 3, depth: 3 },
      { width: 4, depth: 4 },
      { width: 4, depth: 6 }
    ],
    high: [
      { width: 4, depth: 4 },
      { width: 4, depth: 6 },
      { width: 6, depth: 6 }
    ]
  }
};
```

### Lot Formation Algorithm

```typescript
function formLots(zoneCells: ZoneCell[]): Lot[] {
  const lots: Lot[] = [];
  const assigned = new Set<string>();
  
  // Sort cells by proximity to road (front-first)
  const sortedCells = sortByRoadProximity(zoneCells);
  
  for (const cell of sortedCells) {
    if (assigned.has(cellKey(cell))) continue;
    
    // Try to form the largest possible lot
    const possibleSizes = LOT_SIZES[cell.zoneType.category][cell.zoneType.density];
    
    for (const size of possibleSizes.reverse()) {
      const lotCells = tryFormLot(cell, size, zoneCells, assigned);
      
      if (lotCells && hasRoadFrontage(lotCells)) {
        const lot: Lot = {
          id: generateId(),
          cells: lotCells.map(c => c.position),
          zoneType: cell.zoneType,
          size: size,
          orientation: determineLotOrientation(lotCells),
          frontage: getLotFrontage(lotCells),
          building: null,
          developmentStage: 0
        };
        
        lots.push(lot);
        lotCells.forEach(c => assigned.add(cellKey(c)));
        break;
      }
    }
  }
  
  return lots;
}
```

## De-Zoning

### De-Zone Tool

Players can remove zones to return land to wilderness:

```typescript
function deZone(cells: GridPosition[]): DeZoneResult {
  const result: DeZoneResult = {
    cellsDeZoned: [],
    buildingsDestroyed: [],
    refund: 0
  };
  
  for (const cell of cells) {
    const zoneCell = getZoneCell(cell);
    if (!zoneCell || !zoneCell.zoneType) continue;
    
    // If developed, destroy building first
    if (zoneCell.building) {
      result.buildingsDestroyed.push(zoneCell.building);
      destroyBuilding(zoneCell.building);
    }
    
    // Remove zone
    zoneCell.zoneType = null;
    zoneCell.lotId = null;
    result.cellsDeZoned.push(cell);
  }
  
  return result;
}
```

### De-Zone vs Bulldoze

| Action | Effect | Cost |
|--------|--------|------|
| **De-Zone** | Removes zone + building | Free |
| **Bulldoze Building Only** | Removes building, keeps zone | §10+ |
| **Bulldoze Zone** | Same as de-zone | Free |

## Zone Development Requirements

### Basic Requirements (All Zones)

For a zone to develop, it needs:

1. **Road Access**: Within 4 tiles of a road
2. **Positive Demand**: RCI demand bar must be positive
3. **Power**: Connected to power grid
4. **Water** (optional but affects desirability): Connected to water supply

```typescript
interface DevelopmentRequirements {
  roadAccess: boolean;
  demandPositive: boolean;
  hasPower: boolean;
  hasWater: boolean;
  
  // Calculated
  canDevelop: boolean;
  developmentSpeed: number;  // 0.0 - 1.0
}

function checkDevelopmentRequirements(lot: Lot): DevelopmentRequirements {
  const requirements: DevelopmentRequirements = {
    roadAccess: hasRoadAccess(lot.frontage[0], 4),
    demandPositive: getDemand(lot.zoneType) > 0,
    hasPower: isPowered(lot.cells[0]),
    hasWater: hasWaterService(lot.cells[0]),
    canDevelop: false,
    developmentSpeed: 0
  };
  
  // Must have road, demand, and power
  requirements.canDevelop = 
    requirements.roadAccess && 
    requirements.demandPositive && 
    requirements.hasPower;
  
  if (requirements.canDevelop) {
    // Water boosts development speed
    requirements.developmentSpeed = requirements.hasWater ? 1.0 : 0.5;
  }
  
  return requirements;
}
```

### Zone-Specific Requirements

#### Residential
- Lower crime rates → Higher-wealth development
- Good schools → Attracts families
- Parks/recreation → Increases desirability
- Low pollution → Required for high-wealth

#### Commercial
- Customer base (nearby population)
- Highway access (for freight)
- Low crime
- Landmarks/plazas increase desirability

#### Industrial
- Freight connections (roads, rail, seaport)
- Lower education = Dirty industry
- Higher education = High-tech industry
- Tolerates higher pollution

## Wealth Levels

### The Three Wealth Tiers

SimCity 4 models economic stratification:

| Wealth | Symbol | Tax Class | Population Type |
|--------|--------|-----------|-----------------|
| **Low (§)** | $ | R§, C§ | Working class, budget shoppers |
| **Medium (§§)** | $$ | R$$, C$$ | Middle class |
| **High (§§§)** | $$$ | R$$$, C$$$ | Wealthy, luxury consumers |

### Wealth Determination

What determines the wealth level of development:

```typescript
interface WealthFactors {
  landValue: number;          // Primary factor
  pollution: number;          // Negative for high wealth
  crime: number;              // Negative for high wealth  
  traffic: number;            // Negative for high wealth
  nearbyDesirables: number;   // Parks, water, landmarks
  nearbyUndesirables: number; // Industry, power plants
}

function calculateWealthLevel(factors: WealthFactors): 'low' | 'medium' | 'high' {
  let score = 0;
  
  // Land value is the primary factor
  score += factors.landValue * 0.4;
  
  // Negative factors
  score -= factors.pollution * 0.2;
  score -= factors.crime * 0.2;
  score -= factors.traffic * 0.1;
  
  // Positive factors
  score += factors.nearbyDesirables * 0.15;
  score -= factors.nearbyUndesirables * 0.15;
  
  // Map to wealth level
  if (score < 0.33) return 'low';
  if (score < 0.66) return 'medium';
  return 'high';
}
```

## Zone Visualization

### Zone Colors (Standard)

```typescript
const ZONE_COLORS = {
  residential: {
    low: '#90EE90',      // Light green
    medium: '#228B22',   // Forest green
    high: '#006400'      // Dark green
  },
  commercial: {
    low: '#ADD8E6',      // Light blue
    medium: '#4169E1',   // Royal blue
    high: '#00008B'      // Dark blue
  },
  industrial: {
    low: '#FFFFE0',      // Light yellow
    medium: '#FFD700',   // Gold
    high: '#DAA520'      // Goldenrod
  },
  unzoned: '#8B4513'     // Saddle brown (dirt)
};
```

### Zone Display Modes

| Mode | Display |
|------|---------|
| **Normal** | Zones shown as colored overlay on terrain |
| **Data View** | Solid colors with building outlines |
| **Building View** | Buildings shown, zones hidden |
| **Grid View** | Cell grid visible |

### Isometric Zone Tiles

```typescript
interface ZoneTileSpec {
  baseSize: { width: 64, height: 32 };  // Standard iso tile
  
  // Empty zone appearance
  empty: {
    pattern: 'solid' | 'striped' | 'grid';
    opacity: 0.5;
  };
  
  // Developed zone (building visible)
  developed: {
    showZoneColor: boolean;  // Tint ground under building?
    outlineColor: string;    // Building lot outline
  };
}
```

## Algorithm: Zone Development Tick

Each simulation tick, process zone development:

```typescript
function processZoneDevelopment(deltaTime: number): void {
  const lots = getAllUndevelopedLots();
  
  for (const lot of lots) {
    // Check if can develop
    const requirements = checkDevelopmentRequirements(lot);
    if (!requirements.canDevelop) continue;
    
    // Calculate development probability
    const probability = calculateDevelopmentProbability(lot);
    
    // Roll for development
    if (Math.random() < probability * deltaTime) {
      developLot(lot);
    }
  }
}

function calculateDevelopmentProbability(lot: Lot): number {
  const demand = getDemand(lot.zoneType);
  const desirability = calculateDesirability(lot);
  const competition = countCompetingLots(lot);
  
  // Base probability from demand
  let probability = demand / 100;  // 0-1 range
  
  // Modified by desirability
  probability *= desirability;
  
  // Reduced by competition
  probability /= (1 + competition * 0.1);
  
  // Clamp to reasonable range
  return Math.max(0, Math.min(0.1, probability));
}

function developLot(lot: Lot): void {
  // Determine building based on lot size and zone type
  const building = selectBuildingForLot(lot);
  
  // Create building
  lot.building = createBuilding(building, lot);
  lot.developmentStage = 1;
  
  // Update zone cells
  for (const cell of lot.cells) {
    const zoneCell = getZoneCell(cell);
    zoneCell.developed = true;
    zoneCell.building = lot.building;
  }
  
  // Update city stats
  updatePopulation(lot.building.population);
  updateJobs(lot.building.jobs);
}
```

## Special Zone Behaviors

### Zone Abandonment

Buildings can become abandoned when:

```typescript
interface AbandonmentCauses {
  noJobs: boolean;           // R-zone: no jobs available
  noWorkers: boolean;        // C/I-zone: no workers
  noCustomers: boolean;      // C-zone: no shoppers
  highCrime: boolean;        // Crime rate > 50%
  noPower: boolean;          // Power disconnected
  noWater: boolean;          // Water disconnected
  highPollution: boolean;    // Pollution intolerable
  highTaxes: boolean;        // Tax rate too high
  lowLandValue: boolean;     // Land value crashed
}

function checkAbandonment(building: Building): boolean {
  const causes = getAbandonmentCauses(building);
  return Object.values(causes).some(v => v);
}
```

### Zone Redevelopment

Existing buildings can be replaced with larger ones:

```typescript
function canRedevelop(lot: Lot): boolean {
  // Must have positive demand
  if (getDemand(lot.zoneType) <= 0) return false;
  
  // Must have increased land value
  const currentValue = lot.building?.landValue || 0;
  const potentialValue = calculatePotentialLandValue(lot);
  
  if (potentialValue <= currentValue * 1.2) return false;
  
  // Check if larger building is available
  const largerBuilding = findLargerBuilding(lot);
  return largerBuilding !== null;
}
```

## Data Overlays for Zones

### Zone-Related Data Views

| Overlay | Visualization |
|---------|---------------|
| **Zoning** | RCI colors showing zone types |
| **Density** | Light to dark by density level |
| **Development** | Green (developed) / Red (empty) |
| **Desirability** | Color gradient by desirability score |
| **Land Value** | Color gradient by §/§§/§§§ |
| **Road Access** | Show distance to nearest road |

## Configuration Constants

```typescript
const ZONE_CONFIG = {
  // Development
  developmentTickInterval: 100,  // ms
  maxDevelopmentProbability: 0.1,
  minDemandForDevelopment: 1,
  
  // Road access
  maxRoadDistance: 4,            // cells
  
  // Abandonment
  abandonmentCheckInterval: 5000, // ms
  abandonmentProbability: 0.05,
  
  // Costs
  zoneCostPerTile: {
    low: 1,
    medium: 2,
    high: 3
  },
  
  // Visual
  zoneOverlayOpacity: 0.5,
  emptyZonePattern: 'striped'
};
