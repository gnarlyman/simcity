# Building Growth System

## Overview

In SimCity 4, players don't place individual buildings (except civic buildings). Instead, they zone areas and buildings **grow organically** based on demand, desirability, and infrastructure. This document details how buildings develop, grow through stages, and the factors that determine their characteristics.

## Building Development Process

### Development Requirements

For a building to develop on a zoned lot, it must meet these requirements:

```typescript
interface DevelopmentRequirements {
  // Mandatory
  hasPower: boolean;           // Must be connected to power grid
  hasRoadAccess: boolean;      // Within 4 tiles of road (8 for industrial)
  positiveDemand: boolean;     // RCI demand must be positive
  
  // Optional but affects speed/quality
  hasWater: boolean;           // Water service available
  desirability: number;        // Land desirability score
  landValue: number;           // Affects wealth level
}

function canDevelop(lot: Lot, demand: DemandState): boolean {
  // Check mandatory requirements
  if (!lot.hasPower) return false;
  if (!lot.hasRoadAccess) return false;
  
  const demandForType = getDemandForZoneType(lot.zoneType, demand);
  if (demandForType <= 0) return false;
  
  return true;
}
```

### Development Timeline

```
Zone Painted → Lot Formation → Development Check → Building Selection → Construction
     ↓              ↓                  ↓                   ↓              ↓
  Instant      1-3 ticks          Per tick           Based on        Staged
                                  (random)         lot/demand        growth
```

## Building Stages

### Stage System

All growable buildings in SimCity 4 are categorized by **stage**, representing population density. Higher stages mean larger, taller buildings with more capacity.

| Zone Type | Stage Range | Description |
|-----------|-------------|-------------|
| **Residential** | 1-8 | From small houses to high-rise apartments |
| **Commercial** | 1-8 | From small shops to skyscrapers |
| **Industrial** | 1-3 | From small factories to large plants |

### Stage Thresholds (Regional Population)

**Critical**: Building stages are unlocked by **regional population**, not city population. An empty city next to sprawling neighbors can have skyscrapers.

```typescript
// Approximate regional population thresholds for stages
const STAGE_THRESHOLDS = {
  residential: {
    1: 0,           // Always available
    2: 1000,
    3: 5000,
    4: 10000,
    5: 25000,
    6: 50000,
    7: 100000,
    8: 250000
  },
  commercial: {
    1: 0,
    2: 2000,
    3: 8000,
    4: 20000,
    5: 50000,
    6: 100000,
    7: 200000,
    8: 500000
  },
  industrial: {
    1: 0,
    2: 5000,
    3: 20000
  }
};

function getMaxStage(
  zoneCategory: string, 
  regionalPopulation: number
): number {
  const thresholds = STAGE_THRESHOLDS[zoneCategory];
  let maxStage = 1;
  
  for (const [stage, threshold] of Object.entries(thresholds)) {
    if (regionalPopulation >= threshold) {
      maxStage = parseInt(stage);
    }
  }
  
  return maxStage;
}
```

### Stage Characteristics

#### Residential Stages

| Stage | Building Type | Max Height | Population | Lot Sizes |
|-------|---------------|------------|------------|-----------|
| 1 | Small house | 1 story | 2-8 | 1x2, 2x2 |
| 2 | House | 1-2 stories | 8-20 | 1x2, 2x2, 2x3 |
| 3 | Large house/duplex | 2 stories | 15-40 | 2x2, 2x3, 3x3 |
| 4 | Small apartment | 3-4 stories | 30-80 | 2x2, 2x3, 3x3 |
| 5 | Apartment | 4-6 stories | 60-150 | 2x3, 3x3, 3x4 |
| 6 | Large apartment | 6-10 stories | 120-300 | 3x3, 3x4, 4x4 |
| 7 | High-rise | 10-20 stories | 250-600 | 3x3, 4x4, 4x6 |
| 8 | Skyscraper apartment | 20+ stories | 500-1500 | 4x4, 4x6, 6x6 |

#### Commercial Stages

| Stage | Building Type | Max Height | Jobs | Lot Sizes |
|-------|---------------|------------|------|-----------|
| 1 | Small shop | 1 story | 5-15 | 1x1, 1x2, 2x2 |
| 2 | Shop | 1-2 stories | 15-40 | 1x2, 2x2, 2x3 |
| 3 | Store | 2-3 stories | 30-80 | 2x2, 2x3, 3x3 |
| 4 | Large store | 3-5 stories | 60-150 | 2x3, 3x3, 3x4 |
| 5 | Office building | 5-10 stories | 120-300 | 3x3, 3x4, 4x4 |
| 6 | Large office | 10-20 stories | 250-600 | 3x4, 4x4, 4x6 |
| 7 | Corporate tower | 20-40 stories | 500-1200 | 4x4, 4x6, 6x6 |
| 8 | Skyscraper | 40+ stories | 1000-3000 | 4x4, 4x6, 6x6 |

#### Industrial Stages

| Stage | Building Type | Lot Sizes | Jobs | Freight Output |
|-------|---------------|-----------|------|----------------|
| 1 | Small factory/barn | 3x3, 4x4 | 10-50 | Low |
| 2 | Factory | 4x4, 4x6, 6x6 | 40-150 | Medium |
| 3 | Large plant | 6x6, 6x8, 8x8 | 100-400 | High |

**Note**: Agriculture (IR) lots can be much larger (up to 8x8) and only appear in stage 1.

## Lot System

### Lot Formation

When zones are painted, the system forms **lots** - rectangular groups of cells that will host a single building:

```typescript
interface Lot {
  id: string;
  cells: GridPosition[];
  zoneType: ZoneType;
  size: { width: number; depth: number };
  orientation: Direction;      // Facing road
  frontage: GridPosition[];    // Cells touching road
  building: Building | null;
  developmentStage: number;
}

function formLots(zonedCells: ZoneCell[]): Lot[] {
  const lots: Lot[] = [];
  const assigned = new Set<string>();
  
  // Sort cells: prioritize those closest to roads
  const sortedCells = sortByRoadProximity(zonedCells);
  
  for (const cell of sortedCells) {
    if (assigned.has(cellKey(cell.position))) continue;
    
    // Try to form the largest possible lot
    const validSizes = getLotSizesForZone(cell.zoneType);
    
    for (const size of validSizes.reverse()) {  // Largest first
      const lotCells = tryFormRectangle(cell, size, zonedCells, assigned);
      
      if (lotCells && hasRoadFrontage(lotCells)) {
        const lot = createLot(lotCells, cell.zoneType);
        lots.push(lot);
        lotCells.forEach(c => assigned.add(cellKey(c.position)));
        break;
      }
    }
  }
  
  return lots;
}
```

### Lot Sizes by Density

#### Low Density

| Zone | Valid Lot Sizes |
|------|-----------------|
| R-Low | 1x2, 2x2, 2x3, 3x3 |
| C-Low | 1x1, 1x2, 2x2, 2x3 |
| I-Low (Ag) | 4x4, 6x6, 8x8 |

#### Medium Density

| Zone | Valid Lot Sizes |
|------|-----------------|
| R-Med | 2x2, 2x3, 3x3, 3x4 |
| C-Med | 2x2, 2x3, 3x3, 3x4 |
| I-Med | 3x3, 4x4, 4x6 |

#### High Density

| Zone | Valid Lot Sizes |
|------|-----------------|
| R-High | 3x3, 4x4, 4x6, 6x6 |
| C-High | 3x3, 4x4, 4x6, 6x6 |
| I-High | 4x4, 4x6, 6x6 |

### Lot Orientation

Lots orient toward the road they front:

```typescript
function determineLotOrientation(
  lotCells: GridPosition[], 
  roadCells: GridPosition[]
): Direction {
  // Find which edge of the lot touches road
  const frontage = findFrontage(lotCells, roadCells);
  
  // Return direction facing the road
  if (frontage.isNorth) return 'south';  // Building faces south toward road
  if (frontage.isSouth) return 'north';
  if (frontage.isEast) return 'west';
  if (frontage.isWest) return 'east';
  
  return 'south';  // Default
}
```

## Wealth Level Determination

### Wealth Tiers

Buildings develop at one of three wealth levels based on local conditions:

| Wealth | Symbol | Description | Determines |
|--------|--------|-------------|------------|
| **Low (§)** | $ | Working class | R$, CS$ |
| **Medium (§§)** | $$ | Middle class | R$$, CS$$, CO$$ |
| **High (§§§)** | $$$ | Wealthy | R$$$, CS$$$, CO$$$ |

### Wealth Calculation

```typescript
interface WealthFactors {
  landValue: number;              // Primary factor (0-255)
  pollution: number;              // Air pollution (0-255)
  crime: number;                  // Crime rate (0-100%)
  traffic: number;                // Traffic congestion (0-100%)
  nearbyDesirables: number;       // Parks, water, landmarks
  nearbyUndesirables: number;     // Industry, power plants
}

function calculateWealth(factors: WealthFactors): WealthLevel {
  // Land value is the dominant factor
  let score = factors.landValue / 255;
  
  // Negative modifiers
  score -= factors.pollution / 255 * 0.3;
  score -= factors.crime * 0.3;
  score -= factors.traffic * 0.1;
  score -= factors.nearbyUndesirables * 0.2;
  
  // Positive modifiers
  score += factors.nearbyDesirables * 0.2;
  
  // Clamp and convert to wealth level
  score = Math.max(0, Math.min(1, score));
  
  if (score < 0.33) return 'low';
  if (score < 0.66) return 'medium';
  return 'high';
}
```

### Land Value Factors

Land value is itself determined by:

| Factor | Effect on Land Value |
|--------|---------------------|
| **Parks nearby** | Strong positive |
| **Water frontage** | Strong positive |
| **Landmarks** | Strong positive |
| **Good services** | Moderate positive |
| **Low crime** | Moderate positive |
| **Good transit** | Moderate positive |
| **Industry nearby** | Strong negative |
| **Pollution** | Strong negative |
| **Crime** | Moderate negative |
| **Distance from center** | Slight negative |

## Building Selection

### Building Pool

When a lot develops, the game selects a building from a pool matching:
- Zone type and density
- Wealth level
- Lot size
- Current stage threshold

```typescript
interface BuildingDefinition {
  id: string;
  name: string;
  
  // Zone requirements
  zoneType: ZoneType;
  density: DensityLevel;
  wealthLevel: WealthLevel;
  
  // Size
  lotWidth: number;
  lotDepth: number;
  height: number;           // In stories
  
  // Stage
  minStage: number;
  maxStage: number;
  
  // Stats
  capacity: number;         // Population or jobs
  landValueEffect: number;  // Effect on nearby land value
  pollutionGenerated: number;
  
  // Visual
  modelId: string;
  textureVariants: string[];
}

function selectBuilding(
  lot: Lot, 
  wealthLevel: WealthLevel, 
  maxStage: number
): BuildingDefinition | null {
  // Find all matching buildings
  const candidates = BUILDING_POOL.filter(b => 
    b.zoneType === lot.zoneType.category &&
    b.density === lot.zoneType.density &&
    b.wealthLevel === wealthLevel &&
    b.lotWidth === lot.size.width &&
    b.lotDepth === lot.size.depth &&
    b.minStage <= maxStage
  );
  
  if (candidates.length === 0) return null;
  
  // Random selection weighted by stage appropriateness
  return weightedRandomSelect(candidates, maxStage);
}
```

### Building Variety

SimCity 4 includes hundreds of building models to ensure visual variety:

```typescript
// Example building counts per category (approximate)
const BUILDING_VARIETY = {
  residential: {
    low_density: {
      low_wealth: 45,
      medium_wealth: 60,
      high_wealth: 50
    },
    medium_density: {
      low_wealth: 35,
      medium_wealth: 45,
      high_wealth: 40
    },
    high_density: {
      low_wealth: 30,
      medium_wealth: 40,
      high_wealth: 55
    }
  },
  commercial: {
    // Similar structure...
  },
  industrial: {
    agriculture: 20,
    dirty: 35,
    manufacturing: 30,
    high_tech: 40
  }
};
```

## Growth and Upgrade

### Building Upgrade Process

Existing buildings can **upgrade** to larger/higher stage buildings when:

1. Demand remains positive
2. Regional population crosses stage threshold
3. Land value has increased
4. Random upgrade chance succeeds

```typescript
function checkUpgrade(building: Building, city: CityState): boolean {
  // Must have positive demand
  const demand = getDemandForBuilding(building, city.demand);
  if (demand <= 0) return false;
  
  // Check if higher stage now available
  const currentStage = building.stage;
  const maxStage = getMaxStage(building.zoneCategory, city.regionalPopulation);
  
  if (maxStage <= currentStage) return false;
  
  // Check land value improvement
  const currentLandValue = getLandValue(building.lot.cells[0]);
  const potentialValue = calculatePotentialValue(building.lot);
  
  if (potentialValue < currentLandValue * 1.2) return false;
  
  // Random chance
  const upgradeChance = BASE_UPGRADE_CHANCE * (demand / 1000);
  return Math.random() < upgradeChance;
}

const BASE_UPGRADE_CHANCE = 0.02;  // 2% base per tick
```

### Redevelopment

Buildings can be **demolished and replaced** with entirely different buildings:

```typescript
function checkRedevelopment(building: Building, city: CityState): boolean {
  // Only possible with significant improvement potential
  const currentValue = building.landValue;
  const potentialValue = calculatePotentialValue(building.lot);
  
  // Require 50%+ improvement potential
  if (potentialValue < currentValue * 1.5) return false;
  
  // Higher stages prefer larger lots
  if (building.lot.size.width < 3 && city.maxStage > 5) {
    // Small lot in high-stage city - likely to redevelop
    return Math.random() < 0.05;
  }
  
  return Math.random() < 0.01;  // 1% base chance
}
```

## Abandonment and Decay

### Abandonment Triggers

Buildings become abandoned when conditions deteriorate:

```typescript
interface AbandonmentCauses {
  negativeDemand: boolean;      // Zone demand < 0
  noJobs: boolean;              // R: No jobs to go to
  noWorkers: boolean;           // C/I: No workers available
  noCustomers: boolean;         // C: No shoppers
  highCrime: boolean;           // Crime > 50%
  noPower: boolean;             // Power disconnected
  noWater: boolean;             // Water disconnected (some zones)
  highPollution: boolean;       // Pollution intolerable for type
  highTaxes: boolean;           // Tax rate too high
  trafficCongestion: boolean;   // Can't access building
}

function checkAbandonment(building: Building, city: CityState): boolean {
  // Count abandonment factors
  let factorCount = 0;
  
  if (getDemand(building.zoneType, city.demand) < -500) factorCount++;
  if (building.occupancy < 0.2) factorCount++;  // Less than 20% occupied
  if (getCrime(building.position) > 0.5) factorCount++;
  if (!building.hasPower) factorCount += 2;  // Critical
  if (getPollution(building.position) > building.pollutionTolerance) factorCount++;
  
  // More factors = higher abandonment chance
  const abandonmentChance = factorCount * 0.02;
  
  return Math.random() < abandonmentChance;
}
```

### Abandoned Building Behavior

```typescript
interface AbandonedBuilding extends Building {
  abandonedAt: number;          // Game time when abandoned
  condition: number;            // 0-100, decreases over time
  
  // Visual state
  showGraffiti: boolean;
  showBrokenWindows: boolean;
  showOvergrowth: boolean;
}

function updateAbandonedBuilding(building: AbandonedBuilding, deltaTime: number): void {
  // Condition deteriorates
  building.condition -= deltaTime * DECAY_RATE;
  
  // Visual changes at thresholds
  if (building.condition < 80) building.showBrokenWindows = true;
  if (building.condition < 50) building.showGraffiti = true;
  if (building.condition < 30) building.showOvergrowth = true;
  
  // Building collapses at 0
  if (building.condition <= 0) {
    demolishBuilding(building);
    createRubble(building.lot);
  }
}

const DECAY_RATE = 0.1;  // Per game day
```

### Reoccupation

Abandoned buildings can be reoccupied if conditions improve:

```typescript
function checkReoccupation(
  abandoned: AbandonedBuilding, 
  city: CityState
): boolean {
  // Demand must be positive
  if (getDemand(abandoned.zoneType, city.demand) <= 0) return false;
  
  // Building must not be too decayed
  if (abandoned.condition < 50) return false;
  
  // Infrastructure must be restored
  if (!abandoned.hasPower) return false;
  
  // Crime must be reasonable
  if (getCrime(abandoned.position) > 0.4) return false;
  
  // Random chance based on demand
  const demand = getDemand(abandoned.zoneType, city.demand);
  const reoccupationChance = demand / 5000 * 0.1;
  
  return Math.random() < reoccupationChance;
}
```

## Industrial Building Specifics

### Agriculture (IR)

Agricultural buildings have unique characteristics:

```typescript
interface AgriculturalBuilding extends Building {
  farmType: 'crops' | 'livestock' | 'orchard';
  fieldTiles: GridPosition[];    // Surrounding field area
  
  // Agriculture-specific
  waterPollutionGenerated: number;
  airPollutionTolerance: number;  // Cannot tolerate air pollution
}

// Agriculture restrictions
const AGRICULTURE_RULES = {
  maxCitySize: 50000,           // Farms stop appearing in large cities
  maxAirPollution: 10,          // Very sensitive to air pollution
  minLotSize: { width: 4, depth: 4 },
  workersRequired: 'R$',        // Only low-wealth workers
  
  // Cannot build near:
  exclusionZones: ['highway', 'heavy_industry', 'airport']
};
```

### Dirty Industry (ID)

```typescript
interface DirtyIndustryBuilding extends Building {
  // Heavy pollution output
  airPollutionGenerated: number;    // High
  waterPollutionGenerated: number;  // High
  noisePollutionGenerated: number;  // Medium
  
  // Low requirements
  educationRequired: number;         // Low (EQ < 70)
  workerWealth: 'R$';               // Only low-wealth
}
```

### Manufacturing (IM)

```typescript
interface ManufacturingBuilding extends Building {
  // Medium pollution
  airPollutionGenerated: number;    // Medium
  waterPollutionGenerated: number;  // Low-Medium
  
  // Medium requirements
  educationRequired: number;         // Medium (EQ 50-130)
  workerWealth: 'R$' | 'R$$';       // Low and medium wealth
  
  freightGeneration: number;         // Medium freight output
}
```

### High-Tech (IHT)

```typescript
interface HighTechBuilding extends Building {
  // No pollution
  airPollutionGenerated: 0;
  waterPollutionGenerated: 0;
  
  // High requirements
  educationRequired: number;         // High (EQ > 100)
  workerWealth: 'R$$' | 'R$$$';     // Medium and high wealth
  
  // Sensitive to pollution
  airPollutionTolerance: number;    // Low - cannot tolerate pollution
  
  freightGeneration: number;         // Low (knowledge-based)
}
```

## Development Speed

### Factors Affecting Speed

```typescript
function calculateDevelopmentSpeed(
  lot: Lot, 
  city: CityState
): number {
  let speed = 1.0;  // Base speed
  
  // Positive modifiers
  const demand = getDemand(lot.zoneType, city.demand);
  speed *= 1 + (demand / 2000);  // High demand = faster
  
  if (lot.hasWater) speed *= 1.5;  // Water service speeds development
  
  // Negative modifiers
  if (getPollution(lot.cells[0]) > 50) speed *= 0.7;
  if (getCrime(lot.cells[0]) > 30) speed *= 0.8;
  if (getTrafficCongestion(lot.cells[0]) > 50) speed *= 0.6;
  
  return Math.max(0.1, speed);  // Minimum 10% speed
}
```

### Construction Animation

```typescript
enum ConstructionPhase {
  GROUNDWORK = 0,      // Foundation/excavation
  FRAMING = 1,         // Structure going up
  EXTERIOR = 2,        // Walls/windows
  FINISHING = 3,       // Final details
  COMPLETE = 4         // Occupancy begins
}

interface ConstructionState {
  phase: ConstructionPhase;
  progress: number;    // 0-100 for current phase
  
  // Visual representation
  showCranes: boolean;
  showScaffolding: boolean;
  constructionParticles: boolean;
}

function updateConstruction(
  building: Building, 
  speed: number, 
  deltaTime: number
): void {
  if (building.constructionState.phase >= ConstructionPhase.COMPLETE) return;
  
  building.constructionState.progress += speed * deltaTime * CONSTRUCTION_RATE;
  
  if (building.constructionState.progress >= 100) {
    building.constructionState.phase++;
    building.constructionState.progress = 0;
    
    if (building.constructionState.phase === ConstructionPhase.COMPLETE) {
      onConstructionComplete(building);
    }
  }
}

const CONSTRUCTION_RATE = 5;  // Per game day
```

## Building Statistics

### Population and Jobs

```typescript
interface BuildingStats {
  // Residential
  population: number;
  households: number;
  
  // Commercial/Industrial
  jobs: number;
  jobsByWealth: {
    low: number;
    medium: number;
    high: number;
  };
  
  // Common
  landValueContribution: number;
  taxRevenue: number;
  
  // Services needed
  powerConsumption: number;
  waterConsumption: number;
  garbageGeneration: number;
}

function calculateBuildingStats(building: Building): BuildingStats {
  const definition = getBuildingDefinition(building.definitionId);
  const occupancyRate = building.occupancy;  // 0-1
  
  return {
    population: Math.floor(definition.capacity * occupancyRate),
    households: Math.floor(definition.capacity / definition.avgHouseholdSize),
    jobs: building.zoneCategory !== 'residential' 
      ? Math.floor(definition.jobs * occupancyRate) 
      : 0,
    // ... etc
  };
}
```

## Configuration

```typescript
const BUILDING_GROWTH_CONFIG = {
  // Development
  baseDevelopmentChance: 0.1,
  developmentTickInterval: 100,  // ms
  
  // Stages
  stageThresholds: STAGE_THRESHOLDS,
  
  // Upgrade
  baseUpgradeChance: 0.02,
  upgradeValueThreshold: 1.2,  // 20% improvement needed
  
  // Abandonment
  baseAbandonmentChance: 0.01,
  abandonmentDemandThreshold: -500,
  decayRate: 0.1,
  
  // Construction
  constructionRate: 5,
  constructionPhases: 4,
  
  // Lot formation
  maxRoadDistance: {
    residential: 4,
    commercial: 4,
    industrial: 8
  }
};
```

## Summary

The building growth system creates organic city development through:

1. **Lot Formation**: Zones automatically divide into buildable lots based on density and road access
2. **Stage System**: Building size/density limited by regional population (1-8 for R/C, 1-3 for I)
3. **Wealth Determination**: Land value and local conditions determine wealth tier
4. **Building Selection**: Random selection from matching building pool provides variety
5. **Growth/Upgrade**: Buildings can upgrade when demand is high and stages unlock
6. **Abandonment**: Negative conditions cause buildings to become abandoned and decay

This creates the characteristic SimCity experience where players influence development through zoning and infrastructure, but don't directly control individual buildings.

## References

- StrategyWiki SimCity 4 Guide: Zoning and Demand (Stages section)
- SimCity 4 Building Data Files (Exemplar properties)
- SimCity 4 Prima Official Game Guide
