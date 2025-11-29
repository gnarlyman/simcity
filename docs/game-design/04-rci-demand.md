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
    low: number;     // R$ demand (low-wealth)
    medium: number;  // R$$ demand (medium-wealth)
    high: number;    // R$$$ demand (high-wealth)
  };
  commercial: {
    services: {
      low: number;     // CS$ (low-wealth services)
      medium: number;  // CS$$ (medium-wealth services)
      high: number;    // CS$$$ (high-wealth services)
    };
    offices: {
      medium: number;  // CO$$ (medium-wealth offices)
      high: number;    // CO$$$ (high-wealth offices)
    };
  };
  industrial: {
    agriculture: number;     // IR (I-Ag, farms)
    dirty: number;           // ID (dirty/polluting)
    manufacturing: number;   // IM (manufacturing)
    highTech: number;        // IHT (high-tech)
  };
}
```

## Zone Types and Wealth Levels

### Residential Zones

Residential zones house your Sims. Three wealth tiers with distinct preferences:

| Type | Symbol | Description | Workers For | Preferences |
|------|--------|-------------|-------------|-------------|
| **R$** | Low-wealth | Small houses, apartments, tenements | Industry, agriculture, CS$ | Mass transit, tolerates pollution |
| **R$$** | Medium-wealth | Larger homes, townhouses | Manufacturing, offices, services | Good schools, health facilities |
| **R$$$** | High-wealth | Villas, luxury condos | High-tech, CO$$$ | Parks, low pollution, excellent services |

### Commercial Zones

Commercial zones are divided into two categories: **Services** and **Offices**.

#### Commercial Services (CS)
Stores, hotels, gas stations - provide goods and services directly to customers.

| Type | Symbol | Description | Notes |
|------|--------|-------------|-------|
| **CS$** | Low-wealth services | Small stores, gas stations | Served by R$ workers, tolerates some pollution |
| **CS$$** | Medium-wealth services | Shopping malls, inns | Larger buildings |
| **CS$$$** | High-wealth services | Boutiques, spas | Requires wealthy customers |

#### Commercial Offices (CO)
Business offices and corporate headquarters. **Note: There is no CO$ (low-wealth office).**

| Type | Symbol | Description | Notes |
|------|--------|-------------|-------|
| **CO$$** | Medium-wealth offices | Small businesses | Cannot tolerate pollution |
| **CO$$$** | High-wealth offices | Corporate headquarters, skyscrapers | Requires traffic, no pollution |

**Important**: Commercial services (CS$, CS$$, CS$$$) have **unlimited demand caps** and can always grow. Commercial offices (CO$$, CO$$$) have demand caps that must be raised.

### Industrial Zones

Industrial zones provide jobs and produce freight. Four distinct types based on education level:

| Type | Symbol | Pollution | Workers | Education Requirement |
|------|--------|-----------|---------|----------------------|
| **IR** (Agriculture) | Farms | Low air, high water | R$ only | Very low EQ |
| **ID** (Dirty) | Factories, refineries | Very high | R$ only | Low EQ |
| **IM** (Manufacturing) | Production facilities | Medium | R$, R$$ | Medium EQ |
| **IHT** (High-Tech) | Research, pharma | None | R$$, R$$$ | High EQ (100+) |

**Key Mechanics:**
- Agriculture (IR) cannot tolerate air pollution but produces water pollution
- Agriculture demand decreases as city grows (other zones satisfy it)
- Dirty industry (ID) produces maximum pollution
- High-tech (IHT) requires educated workers (EQ 100+) and clean environment
- To force high-tech only: raise taxes on ID and IM to 20%

## Demand Generation

### Residential Demand

Residential demand is **driven by available jobs**:

```typescript
function calculateResidentialDemand(city: CityState): number {
  // Jobs create demand for residents to fill them
  const totalJobs = city.commercialJobs + city.industrialJobs + city.civicJobs;
  const employed = city.population * city.employmentRate;
  const jobDemand = totalJobs - employed;
  
  // Modifiers reduce demand
  let demand = jobDemand;
  
  // High crime repels residents
  demand *= 1 - (city.avgCrimeRate * 0.5);
  
  // Pollution reduces residential appeal
  demand *= 1 - (city.avgPollution * 0.3);
  
  // Poor services reduce demand
  const serviceScore = calculateServiceScore(city);
  demand *= serviceScore;
  
  // High taxes drive away residents
  const taxPenalty = calculateTaxPenalty(city.residentialTaxRate);
  demand *= taxPenalty;
  
  return clamp(demand, DEMAND_MIN, DEMAND_MAX);
}
```

**Wealth-specific demand:**
- **R$**: Demand from industrial dirty jobs + CS$ jobs
- **R$$**: Demand from offices + manufacturing + services, requires good schools
- **R$$$**: Demand from high-tech + CO$$$, requires excellent services and low pollution

### Commercial Demand

Commercial demand is **driven by population** (customers):

```typescript
function calculateCommercialDemand(city: CityState): number {
  // Commercial services need customers (population)
  const customerBase = city.population;
  
  // Commercial offices need educated workers
  const educatedWorkers = city.population * city.educationLevel;
  
  // Services demand: population creates shoppers
  const servicesDemand = customerBase * CS_RATIO;
  
  // Offices demand: educated population
  // Wealthier sims demand more office jobs
  const officesDemand = educatedWorkers * CO_RATIO * city.avgWealthLevel;
  
  return clamp(servicesDemand + officesDemand, DEMAND_MIN, DEMAND_MAX);
}

const CS_RATIO = 0.15;  // 1 CS job per ~7 residents
const CO_RATIO = 0.10;  // 1 CO job per 10 educated workers
```

### Industrial Demand

Industrial demand is **driven by population count and education level**:

```typescript
function calculateIndustrialDemand(city: CityState): number {
  // Workers available create demand for industrial jobs
  const population = city.population;
  const educationLevel = city.averageEQ;  // 0-200 scale
  
  // Low education = dirty industry demand
  // High education = high-tech demand
  let demand = population * INDUSTRIAL_RATIO;
  
  // Freight capacity matters
  const freightCapacity = calculateFreightCapacity(city);
  demand *= Math.min(1, freightCapacity / city.industrialOutput);
  
  return clamp(demand, DEMAND_MIN, DEMAND_MAX);
}
```

**Education determines industrial type distribution:**

| Average EQ | Dominant Industry Types |
|------------|------------------------|
| 0-50 | Agriculture, Dirty Industry |
| 50-100 | Dirty Industry, Manufacturing |
| 100-150 | Manufacturing, High-Tech |
| 150-200 | High-Tech dominant |

## Demand Caps

### What Are Demand Caps?

Demand caps are **artificial limits** on how high demand can rise. Even if conditions would create high demand, it's capped until certain requirements are met. This forces balanced city development.

```typescript
interface DemandCap {
  zoneType: string;
  maxDemand: number;
  currentCap: number;
  capRaisedBy: string[];  // What raises this cap
}
```

### Residential Demand Caps

Residential demand caps are raised by **parks and recreation facilities**:

| Zone | Cap Raised By |
|------|---------------|
| **R$** | All parks, plazas |
| **R$$** | Parks, Houses of Worship, Radio Station |
| **R$$$** | Country Club, large parks |

**Key reward buildings that raise residential caps:**
- **Farmer's Market**: Tremendously raises residential cap
- **Houses of Worship**: Each raises R$$ cap
- **Country Club**: Raises R$$$ cap
- **Radio Station**: Raises residential cap
- **Television Studio**: Similar to Radio Station
- **Tourist Trap**: Raises residential cap
- **Resort Hotel**: Raises residential cap
- **Minor/Major League Stadium**: Huge relief for residential cap

### Commercial Demand Caps

**Commercial Services (CS)**: Have **unlimited caps** - they can always grow regardless of other conditions.

**Commercial Offices (CO)**: Caps are raised by:

| Method | Effect |
|--------|--------|
| **Neighbor connections** | Each road/rail connection to neighbor raises cap |
| **Airport** | Passengers transported raise CO cap |
| **Convention Center** | Raises CO cap |
| **Stock Exchange** | Major CO cap boost |
| **City Zoo** | Raises commercial cap |

### Industrial Demand Caps

| Industry Type | Cap Raised By |
|---------------|---------------|
| **Agriculture (IR)** | Satisfied by everything except agriculture and CS$ - no cap raisers exist |
| **Dirty/Manufacturing (ID, IM)** | Freight leaving city (self-sustaining with neighbor connections) |
| **High-Tech (IHT)** | Advanced Research Center |

**Important Notes:**
- Seaports do NOT count toward industrial demand cap (known bug)
- Army Base business deal raises IM cap
- Agriculture cap cannot be raised; demand naturally decreases as city grows

## Demand Cap Strategy

### Raising Caps

```typescript
function calculateEffectiveDemand(
  rawDemand: number, 
  demandCap: number
): number {
  // Demand is limited by the cap
  return Math.min(rawDemand, demandCap);
}

// Example cap boosters
const RESIDENTIAL_CAP_BOOSTERS = {
  'small_park': 50,
  'large_park': 200,
  'plaza': 100,
  'farmers_market': 500,
  'house_of_worship': 150,
  'country_club': 300,
  'minor_league_stadium': 400,
  'major_league_stadium': 800,
  'radio_station': 200,
  'tourist_trap': 250
};

const COMMERCIAL_OFFICE_CAP_BOOSTERS = {
  'neighbor_connection_road': 100,
  'neighbor_connection_rail': 150,
  'neighbor_connection_highway': 200,
  'airport_passenger': 0.1,  // Per passenger
  'convention_center': 500,
  'stock_exchange': 800,
  'city_zoo': 300
};

const INDUSTRIAL_CAP_BOOSTERS = {
  'freight_exported': 0.5,  // Per unit of freight
  'advanced_research_center': 1000,  // High-tech only
  'army_base': 500  // Manufacturing only
};
```

## Factors Affecting Demand

### Positive Factors

| Factor | Zones Affected | Effect |
|--------|----------------|--------|
| **Available jobs** | R | More jobs = more residential demand |
| **Population** | C | More people = more commercial demand |
| **Educated workforce** | CO, IHT | Higher EQ = demand for offices/high-tech |
| **Road connections** | All | Better access increases demand |
| **Rail/Highway connections** | C, I | Freight capacity boosts demand |
| **Airports** | CO | Boosts commercial office demand |
| **Seaports** | I | Boosts industrial demand (but not cap) |
| **Parks** | R | Raises residential cap |
| **Good schools** | R$$, R$$$ | Attracts higher-wealth residents |
| **Low taxes** | All | Lower taxes increase demand |

### Negative Factors

| Factor | Zones Affected | Effect |
|--------|----------------|--------|
| **High crime** | R, C | Crime > 50% severely reduces demand |
| **Pollution** | R, CO, IHT | Pollution kills high-wealth demand |
| **Traffic congestion** | All | Reduces desirability |
| **High taxes** | All | Above 9% starts reducing demand |
| **No power** | All | No development without power |
| **No water** | All | Slows development speed |
| **Unemployment** | R | High unemployment reduces R demand |
| **Oversupply** | All | Too much zoned = negative demand |

### Tax Rate Effects

```typescript
function calculateTaxPenalty(taxRate: number): number {
  // Tax rates are 0-20%
  // Optimal rate is 7-9%
  
  if (taxRate <= 9) {
    // Low taxes: slight bonus
    return 1.0 + (9 - taxRate) * 0.01;  // Max 1.09 at 0%
  } else if (taxRate <= 12) {
    // Moderate taxes: linear decline
    return 1.0 - (taxRate - 9) * 0.05;  // 0.85 at 12%
  } else {
    // High taxes: steep decline
    return 0.85 - (taxRate - 12) * 0.1;  // Near 0 at 20%
  }
}
```

## Demand Update Algorithm

### Update Cycle

```typescript
class DemandSystem {
  private lastUpdate = 0;
  private demandState: DemandState;
  
  // Demand updates every simulation tick
  update(gameTime: number, city: CityState): void {
    // Calculate raw demands
    const rawResidential = this.calculateResidentialDemand(city);
    const rawCommercial = this.calculateCommercialDemand(city);
    const rawIndustrial = this.calculateIndustrialDemand(city);
    
    // Apply demand caps
    const cappedResidential = this.applyResidentialCaps(rawResidential, city);
    const cappedCommercial = this.applyCommercialCaps(rawCommercial, city);
    const cappedIndustrial = this.applyIndustrialCaps(rawIndustrial, city);
    
    // Smooth transition (demand doesn't jump instantly)
    this.demandState.residential = this.smoothTransition(
      this.demandState.residential,
      cappedResidential,
      DEMAND_TRANSITION_RATE
    );
    
    // Emit event for UI update
    this.eventBus.emit({
      type: 'demand:updated',
      data: this.demandState
    });
  }
  
  private smoothTransition(
    current: number, 
    target: number, 
    rate: number
  ): number {
    return current + (target - current) * rate;
  }
}

const DEMAND_TRANSITION_RATE = 0.1;  // 10% per tick
```

## Demand and Development

### Development Triggers

Buildings only develop when demand is positive:

```typescript
function canZoneDevelop(lot: Lot, demandState: DemandState): boolean {
  const demand = getDemandForZoneType(lot.zoneType, demandState);
  
  // Must have positive demand
  if (demand <= 0) return false;
  
  // Must have infrastructure
  if (!lot.hasPower) return false;
  if (!lot.hasRoadAccess) return false;
  
  // Water is optional but speeds development
  const waterBonus = lot.hasWater ? 1.0 : 0.5;
  
  // Higher demand = higher chance of development
  const probability = (demand / DEMAND_MAX) * waterBonus;
  
  return Math.random() < probability * BASE_DEVELOPMENT_CHANCE;
}

const BASE_DEVELOPMENT_CHANCE = 0.1;  // 10% base per tick
```

### Abandonment from Negative Demand

```typescript
function checkAbandonment(building: Building, demandState: DemandState): boolean {
  const demand = getDemandForBuildingType(building.type, demandState);
  
  // Only negative demand triggers abandonment
  if (demand >= 0) return false;
  
  // More negative = higher abandonment chance
  const abandonmentChance = Math.abs(demand) / DEMAND_MAX * BASE_ABANDONMENT_RATE;
  
  // Older buildings more likely to be abandoned
  const ageModifier = building.age > 50 ? 1.5 : 1.0;
  
  return Math.random() < abandonmentChance * ageModifier;
}

const BASE_ABANDONMENT_RATE = 0.05;
```

## Regional Demand (Multi-City)

### Regional Effects

In SimCity 4, cities in a region influence each other:

```typescript
interface RegionalDemand {
  // Commuters can work in neighboring cities
  commuterDemand: number;
  
  // Trade increases commercial demand
  tradeDemand: number;
  
  // Shared industrial freight
  freightDemand: number;
  
  // Regional population affects building stages
  regionalPopulation: number;
}

function calculateRegionalInfluence(
  city: CityState, 
  neighbors: CityState[]
): RegionalDemand {
  let result = {
    commuterDemand: 0,
    tradeDemand: 0,
    freightDemand: 0,
    regionalPopulation: city.population
  };
  
  for (const neighbor of neighbors) {
    const connection = getConnectionStrength(city, neighbor);
    
    // Workers can commute to jobs in neighboring cities
    if (neighbor.availableJobs > 0) {
      result.commuterDemand += neighbor.availableJobs * connection * 0.1;
    }
    
    // Population drives commercial trade
    result.tradeDemand += neighbor.population * connection * 0.01;
    
    // Industrial freight sharing
    result.freightDemand += neighbor.commercialDemand * connection * 0.1;
    
    // Sum regional population for stage calculation
    result.regionalPopulation += neighbor.population;
  }
  
  return result;
}
```

### Building Stages and Regional Population

**Critical**: Building stages (1-8) are determined by **regional population**, not city population. A small city next to large neighbors can have skyscrapers.

See [05-building-growth.md](./05-building-growth.md) for detailed stage thresholds.

## Ordinances Affecting Demand

Several city ordinances modify demand:

| Ordinance | Effect |
|-----------|--------|
| **Legalize Gambling** | Enables Casino, increases crime |
| **Pro-Reading Campaign** | Boosts education, affects industrial type |
| **Clean Air Act** | Reduces pollution but increases industrial costs |
| **Carpool Incentive** | Reduces traffic, improves desirability |
| **Tourism Promotion** | Boosts commercial services demand |

## Configuration

```typescript
const DEMAND_CONFIG = {
  // Range
  minDemand: -5000,
  maxDemand: 5000,
  
  // Base ratios
  jobsPerResident: 0.5,
  commercialPerPopulation: 0.15,
  industrialPerWorker: 0.3,
  
  // Tax thresholds
  optimalTaxRate: 8,
  moderateTaxThreshold: 12,
  highTaxThreshold: 20,
  
  // Development thresholds
  minimumDevelopmentDemand: 100,
  fastDevelopmentDemand: 2000,
  
  // Abandonment
  abandonmentDemandThreshold: -500,
  baseAbandonmentChance: 0.05,
  
  // Smoothing
  demandTransitionRate: 0.1,
  
  // EQ thresholds for industry types
  dirtyIndustryMaxEQ: 70,
  manufacturingMinEQ: 50,
  manufacturingMaxEQ: 130,
  highTechMinEQ: 100
};
```

## Summary

The RCI demand system creates a dynamic economy where:

1. **Residential demand** is driven by available jobs
2. **Commercial demand** is driven by population (customers) and their wealth/education
3. **Industrial demand** is driven by population and education level
4. **Commercial Services** have unlimited caps; **Offices** require cap boosters
5. **Demand caps** ensure balanced development through parks, connections, and rewards
6. **Negative factors** (crime, pollution, high taxes) reduce demand
7. **Regional connections** enable commuting, trade, and affect building stages

This creates the characteristic gameplay loop:
1. Zone industrial → Creates jobs
2. Zone residential → Workers move in
3. Zone commercial → Services for population
4. Build parks/rewards → Raise demand caps
5. Repeat while managing services, utilities, and budgets

## References

- StrategyWiki SimCity 4 Guide: Zoning and Demand
- StrategyWiki SimCity 4 Guide: Reward Buildings
- SimCity 4 Prima Official Game Guide
