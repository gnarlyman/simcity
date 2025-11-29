# RCI Demand System

## Overview

The RCI (Residential, Commercial, Industrial) demand system is the economic heart of SimCity 4. It determines what types of development the city needs and drives organic growth. Understanding this system is essential for reproducing authentic city-building behavior.

## The Demand Model

### Visual Representation

In SimCity 4, demand is shown as a bar graph in the UI:

```
        R   C   I
       ┌─┐ ┌─┐ ┌─┐
       │█│ │ │ │█│  ← Positive demand (need more)
       │█│ │ │ │█│
    ───┼─┼─┼─┼─┼─┼───  ← Zero line
       │ │ │█│ │ │
       │ │ │█│ │ │  ← Negative demand (oversupply)
       └─┘ └─┘ └─┘

R = Residential (green)
C = Commercial (blue)
I = Industrial (yellow)
```

### Demand Range

```typescript
// Demand is measured on a scale
const DEMAND_MIN = -5000;
const DEMAND_MAX = 5000;

interface DemandState {
  residential: {
    low: number;     // R§ demand
    medium: number;  // R§§ demand
    high: number;    // R§§§ demand
  };
  commercial: {
    low: number;     // CS§ (services)
    medium: number;  // CO§§ (offices)
    high: number;    // CO§§§ (offices)
  };
  industrial: {
    agriculture: number;  // I-A
    dirty: number;        // I-D
    manufacturing: number; // I-M
    highTech: number;     // I-HT
  };
}
```

## Demand Calculation

### Residential Demand

Residential demand is driven by available jobs and commercial services:

```typescript
function calculateResidentialDemand(city: CityState): number {
  // Base demand from jobs
  const totalJobs = city.commercialJobs + city.industrialJobs;
  const employed = city.population * city.employmentRate;
  const jobDemand = totalJobs - employed;
  
  // Regional influence (from connected cities)
  const regionalDemand = calculateRegionalResidentialDemand(city);
  
  // Modifiers
  let demand = jobDemand + regionalDemand;
  
  // Reduce demand if:
  // - High crime rate
  demand *= 1 - (city.avgCrimeRate * 0.5);
  
  // - High pollution
  demand *= 1 - (city.avgPollution * 0.3);
  
  // - Poor services
  const serviceScore = calculateServiceScore(city);
  demand *= serviceScore;
  
  // - High taxes
  const taxPenalty = calculateTaxPenalty(city.residentialTaxRate);
  demand *= taxPenalty;
  
  return clamp(demand, DEMAND_MIN, DEMAND_MAX);
}
```

### Residential Wealth-Level Demand

Each wealth level has separate demand:

```typescript
function calculateResidentialDemandByWealth(city: CityState): {
  low: number;
  medium: number;
  high: number;
} {
  // Low-wealth: Basic job access
  const lowDemand = city.industrialDirtyJobs + city.commercialServicesJobs
    - city.lowWealthPopulation;
  
  // Medium-wealth: Office jobs, good schools
  const mediumDemand = city.commercialOfficeJobs + city.industrialManufacturingJobs
    - city.mediumWealthPopulation;
  mediumDemand *= city.hasGoodSchools ? 1.0 : 0.5;
  
  // High-wealth: High-tech jobs, excellent services
  const highDemand = city.commercialHighOfficeJobs + city.industrialHighTechJobs
    - city.highWealthPopulation;
  highDemand *= city.hasExcellentServices ? 1.0 : 0.3;
  highDemand *= city.hasLowPollution ? 1.0 : 0.2;
  
  return {
    low: clamp(lowDemand, DEMAND_MIN, DEMAND_MAX),
    medium: clamp(mediumDemand, DEMAND_MIN, DEMAND_MAX),
    high: clamp(highDemand, DEMAND_MIN, DEMAND_MAX)
  };
}
```

### Commercial Demand

Commercial demand is driven by population (customers) and freight transport:

```typescript
function calculateCommercialDemand(city: CityState): number {
  // Commercial Services (CS) - needs customers
  const customerBase = city.population;
  const existingCS = city.commercialServicesCapacity;
  const csDemand = (customerBase * CS_RATIO) - existingCS;
  
  // Commercial Offices (CO) - needs educated workers
  const educatedWorkers = city.population * city.educationLevel;
  const existingCO = city.commercialOfficeCapacity;
  const coDemand = (educatedWorkers * CO_RATIO) - existingCO;
  
  // Freight requirement (goods from industry)
  const freightNeeded = city.industrialOutput * FREIGHT_COMMERCIAL_RATIO;
  const freightAvailable = calculateFreightCapacity(city);
  const freightModifier = Math.min(1, freightAvailable / freightNeeded);
  
  // Tax penalty
  const taxPenalty = calculateTaxPenalty(city.commercialTaxRate);
  
  const totalDemand = (csDemand + coDemand) * freightModifier * taxPenalty;
  
  return clamp(totalDemand, DEMAND_MIN, DEMAND_MAX);
}

const CS_RATIO = 0.15;  // 1 CS job per ~7 residents
const CO_RATIO = 0.10;  // 1 CO job per 10 educated workers
const FREIGHT_COMMERCIAL_RATIO = 0.5;
```

### Industrial Demand

Industrial demand is driven by freight connections and worker availability:

```typescript
function calculateIndustrialDemand(city: CityState): number {
  // Workers available
  const availableWorkers = city.population - city.employed;
  const workerDemand = availableWorkers * WORKER_TO_INDUSTRY_RATIO;
  
  // Regional demand (exports)
  const regionalDemand = calculateRegionalIndustrialDemand(city);
  
  // Freight capacity affects demand
  const freightCapacity = calculateFreightCapacity(city);
  const freightModifier = Math.min(1, freightCapacity / city.industrialOutput);
  
  // Tax penalty
  const taxPenalty = calculateTaxPenalty(city.industrialTaxRate);
  
  const baseDemand = workerDemand + regionalDemand;
  const totalDemand = baseDemand * freightModifier * taxPenalty;
  
  return clamp(totalDemand, DEMAND_MIN, DEMAND_MAX);
}

const WORKER_TO_INDUSTRY_RATIO = 0.3;
```

### Industrial Type Distribution

The education level determines which industrial types develop:

```typescript
function calculateIndustrialTypeDistribution(city: CityState): {
  agriculture: number;
  dirty: number;
  manufacturing: number;
  highTech: number;
} {
  const educationQuotient = city.averageEQ;  // 0-200 scale
  
  // Agriculture: Always some demand, peaks at low EQ
  const agricultureDemand = 500 * (1 - educationQuotient / 200);
  
  // Dirty Industry: Low EQ cities
  const dirtyDemand = educationQuotient < 70
    ? 800 * (1 - educationQuotient / 70)
    : 0;
  
  // Manufacturing: Medium EQ cities
  const manufacturingDemand = educationQuotient >= 50 && educationQuotient < 130
    ? 600 * (1 - Math.abs(educationQuotient - 90) / 40)
    : 0;
  
  // High-Tech: High EQ cities
  const highTechDemand = educationQuotient >= 100
    ? 700 * ((educationQuotient - 100) / 100)
    : 0;
  
  // Apply city's industrial demand to distribution
  const totalBaseDemand = agricultureDemand + dirtyDemand + manufacturingDemand + highTechDemand;
  const industrialDemand = city.industrialDemand;
  
  return {
    agriculture: (agricultureDemand / totalBaseDemand) * industrialDemand,
    dirty: (dirtyDemand / totalBaseDemand) * industrialDemand,
    manufacturing: (manufacturingDemand / totalBaseDemand) * industrialDemand,
    highTech: (highTechDemand / totalBaseDemand) * industrialDemand
  };
}
```

## Demand Caps

### What Are Demand Caps?

Demand caps are artificial limits on how high demand can go until certain conditions are met. They force balanced city development.

```typescript
interface DemandCap {
  type: string;
  currentCap: number;
  condition: string;
  nextThreshold: number;
}

const RESIDENTIAL_CAPS: DemandCap[] = [
  { type: 'R§', currentCap: 500, condition: 'none', nextThreshold: 0 },
  { type: 'R§§', currentCap: 100, condition: 'mayor_house', nextThreshold: 1 },
  { type: 'R§§§', currentCap: 0, condition: 'country_club', nextThreshold: 1 }
];
```

### Common Demand Cap Conditions

| Zone Type | Cap Condition | Requirement |
|-----------|---------------|-------------|
| **R§§** | Mayor's House | Build mayor's house reward |
| **R§§§** | Country Club | Build country club reward |
| **C§§** | Chamber of Commerce | Build chamber of commerce |
| **C§§§** | Stock Exchange | Build stock exchange |
| **I-HT** | Research Center | Build research center |

### Unlocking Caps

```typescript
function checkCapUnlock(city: CityState, cap: DemandCap): boolean {
  switch (cap.condition) {
    case 'none':
      return true;
      
    case 'mayor_house':
      return city.hasBuilding('mayors_house');
      
    case 'country_club':
      return city.hasBuilding('country_club') && city.avgLandValue > 50;
      
    case 'chamber_of_commerce':
      return city.commercialJobs > 1000;
      
    case 'stock_exchange':
      return city.commercialJobs > 10000 && city.avgEducation > 100;
      
    case 'research_center':
      return city.hasBuilding('research_center') && city.avgEducation > 120;
      
    default:
      return true;
  }
}

function getEffectiveDemand(rawDemand: number, cap: number): number {
  return Math.min(rawDemand, cap);
}
```

## Factors Affecting Demand

### Positive Factors

| Factor | Affects | Effect |
|--------|---------|--------|
| **Jobs available** | R | More jobs = more residential demand |
| **Population** | C | More people = more commercial demand |
| **Road connections** | All | Better access increases demand |
| **Rail connections** | C, I | Freight capacity boosts demand |
| **Airport** | C | Boosts high-end commercial |
| **Seaport** | I | Major industrial boost |
| **Good services** | R | Parks, schools attract residents |
| **Low taxes** | All | Lower taxes increase demand |

### Negative Factors

| Factor | Affects | Effect |
|--------|---------|--------|
| **Crime** | R, C | High crime repels development |
| **Pollution** | R | Pollution kills residential demand |
| **Traffic** | All | Congestion reduces desirability |
| **High taxes** | All | High taxes drive away development |
| **No utilities** | All | No power/water = no development |
| **Unemployment** | R | High unemployment reduces R demand |
| **Oversupply** | All | Too much zone = negative demand |

### Tax Rate Effects

```typescript
function calculateTaxPenalty(taxRate: number): number {
  // Tax rates are 0-20%
  // Optimal rate is around 7-9%
  
  if (taxRate <= 9) {
    // Low taxes: slight bonus up to 9%
    return 1.0 + (9 - taxRate) * 0.01;  // Max 1.09
  } else if (taxRate <= 12) {
    // Moderate taxes: linear decline
    return 1.0 - (taxRate - 9) * 0.05;  // 0.85 at 12%
  } else {
    // High taxes: steep decline
    return 0.85 - (taxRate - 12) * 0.1;  // Can go negative
  }
}
```

## Demand Update Algorithm

### Update Frequency

```typescript
const DEMAND_UPDATE_INTERVAL = 10000;  // 10 seconds game time

class DemandSystem {
  private lastUpdate = 0;
  private demandState: DemandState;
  
  update(gameTime: number, city: CityState): void {
    if (gameTime - this.lastUpdate < DEMAND_UPDATE_INTERVAL) {
      return;
    }
    
    this.lastUpdate = gameTime;
    
    // Calculate raw demands
    const rawResidential = this.calculateResidentialDemand(city);
    const rawCommercial = this.calculateCommercialDemand(city);
    const rawIndustrial = this.calculateIndustrialDemand(city);
    
    // Apply demand caps
    const cappedResidential = this.applyResidentialCaps(rawResidential, city);
    const cappedCommercial = this.applyCommercialCaps(rawCommercial, city);
    const cappedIndustrial = this.applyIndustrialCaps(rawIndustrial, city);
    
    // Smooth transition (don't jump instantly)
    this.demandState.residential = this.smoothTransition(
      this.demandState.residential,
      cappedResidential,
      0.1
    );
    this.demandState.commercial = this.smoothTransition(
      this.demandState.commercial,
      cappedCommercial,
      0.1
    );
    this.demandState.industrial = this.smoothTransition(
      this.demandState.industrial,
      cappedIndustrial,
      0.1
    );
    
    // Emit demand changed event
    this.eventBus.emit({
      type: 'demand:updated',
      data: this.demandState
    });
  }
  
  private smoothTransition(current: number, target: number, rate: number): number {
    return current + (target - current) * rate;
  }
}
```

## Demand and Development

### How Demand Triggers Development

```typescript
function canZoneDevelop(lot: Lot, demandState: DemandState): boolean {
  const demand = getDemandForZoneType(lot.zoneType, demandState);
  
  // Must have positive demand
  if (demand <= 0) return false;
  
  // Must have infrastructure
  if (!lot.hasPower) return false;
  if (!lot.hasRoadAccess) return false;
  
  // Calculate development probability based on demand
  const probability = demand / DEMAND_MAX;  // 0 to 1
  
  return Math.random() < probability * BASE_DEVELOPMENT_CHANCE;
}

const BASE_DEVELOPMENT_CHANCE = 0.1;  // 10% base chance per tick
```

### Development Speed

```typescript
function getDevelopmentSpeed(demand: number): number {
  // Demand affects how fast buildings grow
  // Higher demand = faster development
  
  if (demand < 0) return 0;
  if (demand < 500) return 0.5;
  if (demand < 1500) return 1.0;
  if (demand < 3000) return 1.5;
  return 2.0;  // Max speed
}
```

### Abandonment From Negative Demand

```typescript
function checkAbandonment(building: Building, demandState: DemandState): boolean {
  const demand = getDemandForBuildingType(building.type, demandState);
  
  // Negative demand triggers abandonment check
  if (demand >= 0) return false;
  
  // More negative = higher chance
  const abandonmentChance = Math.abs(demand) / DEMAND_MAX * BASE_ABANDONMENT_CHANCE;
  
  // Building age also matters
  const ageModifier = building.age > 50 ? 1.5 : 1.0;
  
  return Math.random() < abandonmentChance * ageModifier;
}

const BASE_ABANDONMENT_CHANCE = 0.05;  // 5% base chance
```

## Regional Demand (Multi-City)

### City Connections

In SimCity 4, cities in a region can trade:

```typescript
interface RegionalConnection {
  neighborCity: string;
  connectionType: 'road' | 'rail' | 'highway' | 'air' | 'sea';
  capacity: number;
  distance: number;
}

function calculateRegionalDemand(city: CityState, neighbors: CityState[]): {
  residential: number;
  commercial: number;
  industrial: number;
} {
  let residentialBonus = 0;
  let commercialBonus = 0;
  let industrialBonus = 0;
  
  for (const neighbor of neighbors) {
    const connection = getConnection(city, neighbor);
    if (!connection) continue;
    
    // Commuter demand (residential)
    if (neighbor.unemploymentRate < city.unemploymentRate) {
      residentialBonus += (neighbor.availableJobs - neighbor.population) 
        * connection.capacity * 0.1;
    }
    
    // Commercial trade
    commercialBonus += neighbor.population * 0.01 * connection.capacity;
    
    // Industrial freight
    industrialBonus += neighbor.commercialDemand * 0.1 * connection.capacity;
  }
  
  return {
    residential: residentialBonus,
    commercial: commercialBonus,
    industrial: industrialBonus
  };
}
```

## UI Display

### Demand Bar Visualization

```typescript
interface DemandBarConfig {
  width: number;
  height: number;
  maxValue: number;
  colors: {
    residential: string;
    commercial: string;
    industrial: string;
    background: string;
    zeroLine: string;
  };
}

function renderDemandBar(
  ctx: CanvasRenderingContext2D,
  demand: number,
  config: DemandBarConfig,
  x: number,
  y: number,
  color: string
): void {
  const { width, height, maxValue } = config;
  const halfHeight = height / 2;
  
  // Background
  ctx.fillStyle = config.background;
  ctx.fillRect(x, y, width, height);
  
  // Demand bar
  const barHeight = (Math.abs(demand) / maxValue) * halfHeight;
  ctx.fillStyle = color;
  
  if (demand > 0) {
    // Positive: draw upward from center
    ctx.fillRect(x, y + halfHeight - barHeight, width, barHeight);
  } else {
    // Negative: draw downward from center
    ctx.fillRect(x, y + halfHeight, width, barHeight);
  }
  
  // Zero line
  ctx.strokeStyle = config.zeroLine;
  ctx.beginPath();
  ctx.moveTo(x, y + halfHeight);
  ctx.lineTo(x + width, y + halfHeight);
  ctx.stroke();
}
```

## Configuration

```typescript
const DEMAND_CONFIG = {
  // Update frequency
  updateIntervalMs: 10000,
  
  // Demand range
  minDemand: -5000,
  maxDemand: 5000,
  
  // Base ratios
  jobsPerResident: 0.5,
  commercialPerPopulation: 0.15,
  industrialPerWorker: 0.3,
  
  // Tax thresholds
  optimalTaxRate: 8,
  highTaxThreshold: 12,
  
  // Development thresholds
  minimumDevelopmentDemand: 100,
  fastDevelopmentDemand: 2000,
  
  // Abandonment
  abandonmentDemandThreshold: -500,
  baseAbandonmentChance: 0.05,
  
  // Smoothing
  demandTransitionRate: 0.1
};
```

## Summary

The RCI demand system creates a dynamic economy where:

1. **Residential demand** is driven by available jobs
2. **Commercial demand** is driven by population (customers)
3. **Industrial demand** is driven by worker availability and freight capacity
4. **Demand caps** ensure balanced development
5. **Negative factors** (crime, pollution, taxes) reduce demand
6. **Regional connections** allow inter-city trade

This creates the characteristic gameplay loop:
- Zone industrial → Creates jobs
- Zone residential → Workers move in
- Zone commercial → Services for population
- Repeat while managing services, utilities, and budgets
