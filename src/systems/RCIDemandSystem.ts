/**
 * RCI Demand System
 * 
 * Calculates and manages Residential, Commercial, and Industrial demand.
 * Implements the needs system where RCI zones depend on each other.
 * Enforces infrastructure requirements (road access, power) for development.
 * Handles building functionality and grace periods for lost infrastructure.
 */

import type { 
  GridPosition, 
  DemandState, 
  ZoneCategory, 
  ZoneDensity,
  EntityId,
  BuildingComponent,
  PositionComponent,
  BuildingStatus,
  InfrastructureIssues
} from '../data/types';
import { BaseSystem, World } from '../core/ECS';
import { EventBus, EventTypes } from '../core/EventBus';
import { 
  DEMAND_MIN, 
  DEMAND_MAX, 
  DEMAND_UPDATE_INTERVAL,
  DEMAND_TRANSITION_RATE,
  MIN_DEVELOPMENT_DEMAND,
  FAST_DEVELOPMENT_DEMAND,
  BASE_DEVELOPMENT_CHANCE,
  INFRASTRUCTURE_GRACE_PERIOD,
  BASE_RESIDENTIAL_DEMAND,
  BASE_COMMERCIAL_DEMAND,
  BASE_INDUSTRIAL_DEMAND,
  COMMERCIAL_PER_POPULATION_RATIO,
  INDUSTRIAL_PER_POPULATION_RATIO,
  RESIDENTIAL_WORKERS,
  COMMERCIAL_JOBS,
  INDUSTRIAL_JOBS
} from '../data/constants';
import { ZoneSystem } from './ZoneSystem';
import { PowerSystem } from './PowerSystem';
import { posKey } from '../data/Grid';

/**
 * Building tracking info
 */
interface TrackedBuilding {
  entityId: EntityId;
  position: GridPosition;
  category: ZoneCategory;
  density: ZoneDensity;
  population: number;
  jobs: number;
  status: BuildingStatus;
  infrastructureIssues: InfrastructureIssues;
  infrastructureLostAt: number | null;
  isContributing: boolean;
}

/**
 * RCI Demand System class
 */
export class RCIDemandSystem extends BaseSystem {
  name = 'RCIDemandSystem';
  requiredComponents: string[] = [];
  priority = 20;

  /** 
   * RCI Valves - Cumulative demand values (SimCity-style)
   * Positive = growth demand, Negative = decline
   * These accumulate over time based on city balance
   */
  private resValve = 0;
  private comValve = 0;
  private indValve = 0;

  /** Valve ranges (from Micropolis source) */
  private readonly RES_VALVE_RANGE = 2000;
  private readonly COM_VALVE_RANGE = 1500;
  private readonly IND_VALVE_RANGE = 1500;

  /** Current demand state (derived from valves) */
  private demandState: DemandState = {
    residential: { low: 0, medium: 0, high: 0 },
    commercial: { low: 0, medium: 0, high: 0 },
    industrial: { agriculture: 0, dirty: 0, manufacturing: 0, highTech: 0 },
  };

  /** Target demand (smoothly transitions to this) */
  private targetDemand: DemandState = {
    residential: { low: 0, medium: 0, high: 0 },
    commercial: { low: 0, medium: 0, high: 0 },
    industrial: { agriculture: 0, dirty: 0, manufacturing: 0, highTech: 0 },
  };

  /** Historical population data (for calculating growth rate) */
  private lastResPop = 0;
  private lastComPop = 0;
  private lastIndPop = 0;

  /** Event bus */
  private eventBus: EventBus | null = null;

  /** Zone system reference */
  private zoneSystem: ZoneSystem | null = null;

  /** Power system reference */
  private powerSystem: PowerSystem | null = null;

  /** Time accumulator for demand updates */
  private updateAccumulator = 0;

  /** Time accumulator for development checks */
  private developmentAccumulator = 0;

  /** Development check interval (ms) */
  private developmentInterval = 1000;

  /** Infrastructure check interval (ms) */
  private infrastructureCheckInterval = 500;

  /** Infrastructure check accumulator */
  private infrastructureAccumulator = 0;

  /** All tracked buildings */
  private buildings: Map<EntityId, TrackedBuilding> = new Map();

  /** Total contributing population */
  private contributingPopulation = 0;

  /** Total contributing jobs */
  private contributingCommercialJobs = 0;
  private contributingIndustrialJobs = 0;

  /** Current game time (for grace period tracking) */
  private currentTime = 0;

  /**
   * Initialize the system
   */
  init(world: World): void {
    this.eventBus = world.getEventBus();
    this.zoneSystem = world.getSystem<ZoneSystem>('ZoneSystem');
    this.powerSystem = world.getSystem<PowerSystem>('PowerSystem');
    
    // Set initial demand to encourage development
    this.setInitialDemand();
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventBus) return;

    // Listen for building development
    this.eventBus.on(EventTypes.BUILDING_DEVELOPED, (event) => {
      const { entityId, position, buildingType, population, jobs } = event.data as {
        entityId: EntityId;
        position: GridPosition;
        buildingType: string;
        population: number;
        jobs: number;
      };
      
      // Parse building type (format: category_density)
      const [category, density] = buildingType.split('_') as [ZoneCategory, ZoneDensity];
      
      // Create tracked building
      const building: TrackedBuilding = {
        entityId,
        position,
        category,
        density,
        population,
        jobs,
        status: 'functional',
        infrastructureIssues: { noRoadAccess: false, noPower: false },
        infrastructureLostAt: null,
        isContributing: true,
      };
      
      this.buildings.set(entityId, building);
      this.updateContributingStats();
      
      // Immediately recalculate and emit demand after building development
      this.calculateDemand();
    });

    // Listen for building abandonment/demolition
    this.eventBus.on(EventTypes.BUILDING_ABANDONED, (event) => {
      const { entityId } = event.data as { entityId: EntityId };
      this.buildings.delete(entityId);
      this.updateContributingStats();
    });
  }

  /**
   * Set initial demand values
   * Initialize valves to create starting demand
   */
  private setInitialDemand(): void {
    // Initialize valves to create initial demand
    // In SimCity, empty cities start with positive R and I demand
    this.resValve = 500;  // Initial residential demand
    this.comValve = 100;  // Low commercial initially (need population first)
    this.indValve = 400;  // Good industrial to create jobs

    // Calculate initial demand from valves
    const resDemand = this.valveToDemand(this.resValve, this.RES_VALVE_RANGE);
    const comDemand = this.valveToDemand(this.comValve, this.COM_VALVE_RANGE);
    const indDemand = this.valveToDemand(this.indValve, this.IND_VALVE_RANGE);

    // Set target demand
    this.targetDemand.residential.low = this.clampDemand(resDemand * 0.6);
    this.targetDemand.residential.medium = 0;
    this.targetDemand.residential.high = 0;

    this.targetDemand.commercial.low = this.clampDemand(comDemand * 0.6);
    this.targetDemand.commercial.medium = 0;
    this.targetDemand.commercial.high = 0;

    this.targetDemand.industrial.dirty = this.clampDemand(indDemand * 0.4);
    this.targetDemand.industrial.manufacturing = this.clampDemand(indDemand * 0.3);
    this.targetDemand.industrial.agriculture = this.clampDemand(indDemand * 0.2);
    this.targetDemand.industrial.highTech = 0;

    // Copy to current state
    this.demandState = JSON.parse(JSON.stringify(this.targetDemand));
  }

  /**
   * Update the system
   */
  update(world: World, deltaTime: number): void {
    this.currentTime += deltaTime;

    // Check infrastructure status periodically
    this.infrastructureAccumulator += deltaTime;
    if (this.infrastructureAccumulator >= this.infrastructureCheckInterval) {
      this.infrastructureAccumulator = 0;
      this.checkBuildingInfrastructure();
    }

    // Update demand calculations periodically
    this.updateAccumulator += deltaTime;
    if (this.updateAccumulator >= DEMAND_UPDATE_INTERVAL) {
      this.updateAccumulator = 0;
      this.calculateDemand();
    }

    // Smooth transition current demand toward target
    this.transitionDemand(deltaTime);

    // Check for development periodically
    this.developmentAccumulator += deltaTime;
    if (this.developmentAccumulator >= this.developmentInterval) {
      this.developmentAccumulator = 0;
      this.processDevelopment(world);
    }
  }

  /**
   * Check infrastructure status for all buildings
   */
  private checkBuildingInfrastructure(): void {
    if (!this.zoneSystem || !this.powerSystem) return;

    const poweredPositions = this.powerSystem.getPoweredPositions();

    for (const building of this.buildings.values()) {
      const zoneCell = this.zoneSystem.getZoneCell(building.position);
      if (!zoneCell) continue;

      // Check infrastructure issues
      const hadIssues = building.infrastructureIssues.noRoadAccess || building.infrastructureIssues.noPower;
      
      building.infrastructureIssues.noRoadAccess = !zoneCell.roadAccess;
      building.infrastructureIssues.noPower = !poweredPositions.has(posKey(building.position));

      const hasIssues = building.infrastructureIssues.noRoadAccess || building.infrastructureIssues.noPower;

      // Handle infrastructure state transitions
      if (hasIssues && !hadIssues) {
        // Just lost infrastructure - start grace period
        building.infrastructureLostAt = this.currentTime;
        building.status = 'non_functional';
        building.isContributing = false;
        this.updateContributingStats();
        
        console.log(`Building at (${building.position.x}, ${building.position.y}) lost infrastructure`);
      } else if (!hasIssues && hadIssues) {
        // Infrastructure restored
        building.infrastructureLostAt = null;
        building.status = 'functional';
        building.isContributing = true;
        this.updateContributingStats();
        
        console.log(`Building at (${building.position.x}, ${building.position.y}) infrastructure restored`);
      } else if (hasIssues && building.infrastructureLostAt !== null) {
        // Check if grace period expired
        const timeSinceLost = this.currentTime - building.infrastructureLostAt;
        if (timeSinceLost >= INFRASTRUCTURE_GRACE_PERIOD && building.status !== 'abandoned') {
          building.status = 'abandoned';
          
          // Emit abandonment event
          if (this.eventBus) {
            this.eventBus.emit({
              type: EventTypes.BUILDING_ABANDONED,
              timestamp: Date.now(),
              data: {
                entityId: building.entityId,
                position: building.position,
                reason: building.infrastructureIssues.noRoadAccess ? 'no_road' : 'no_power',
              },
            });
          }
          
          console.log(`Building at (${building.position.x}, ${building.position.y}) abandoned due to infrastructure loss`);
        }
      }
    }
  }

  /**
   * Update contributing stats from all functional buildings
   */
  private updateContributingStats(): void {
    let population = 0;
    let commercialJobs = 0;
    let industrialJobs = 0;

    for (const building of this.buildings.values()) {
      if (building.isContributing) {
        if (building.category === 'residential') {
          population += building.population;
        } else if (building.category === 'commercial') {
          commercialJobs += building.jobs;
        } else if (building.category === 'industrial') {
          industrialJobs += building.jobs;
        }
      }
    }

    this.contributingPopulation = population;
    this.contributingCommercialJobs = commercialJobs;
    this.contributingIndustrialJobs = industrialJobs;
  }

  /**
   * Calculate demand using REAL SimCity/Micropolis formula
   * 
   * Based on the open-source Micropolis simulate.cpp setValves() function.
   * Key concepts:
   * - Employment drives residential (jobs available vs workers)
   * - Labor base affects commercial and industrial
   * - Internal market drives commercial
   * - Valves accumulate over time (not reset each cycle)
   */
  private calculateDemand(): void {
    // Get current city stats
    const resPop = this.contributingPopulation;
    const comPop = this.contributingCommercialJobs;
    const indPop = this.contributingIndustrialJobs;
    
    // Micropolis parameters
    const birthRate = 0.02;
    const laborBaseMax = 1.3;
    const internalMarketDenom = 3.7;
    const projectedIndPopMin = 5.0;
    const resRatioDefault = 1.3;
    const resRatioMax = 2.0;
    const comRatioMax = 2.0;
    const indRatioMax = 2.0;
    const taxTableScale = 600;
    
    // Normalize residential population (Micropolis divides by 8)
    const normalizedResPop = resPop / 8;
    
    // Calculate employment ratio
    let employment = 1.0;
    if (normalizedResPop > 0) {
      employment = (comPop + indPop) / normalizedResPop;
    }
    
    // Migration based on employment
    const migration = normalizedResPop * (employment - 1);
    const births = normalizedResPop * birthRate;
    const projectedResPop = normalizedResPop + migration + births;
    
    // Calculate labor base (workers per job)
    let laborBase = 1.0;
    const totalJobs = comPop + indPop;
    if (totalJobs > 0) {
      laborBase = this.lastResPop / totalJobs;
    }
    laborBase = Math.max(0, Math.min(laborBaseMax, laborBase));
    
    // Internal market drives commercial demand
    const internalMarket = (normalizedResPop + comPop + indPop) / internalMarketDenom;
    
    // Projected populations
    const projectedComPop = internalMarket * laborBase;
    let projectedIndPop = indPop * laborBase * 1.0; // External market factor = 1.0
    projectedIndPop = Math.max(projectedIndPop, projectedIndPopMin);
    
    // Calculate ratios (projected vs actual)
    let resRatio: number;
    if (normalizedResPop > 0) {
      resRatio = projectedResPop / normalizedResPop;
    } else {
      resRatio = resRatioDefault;
    }
    
    let comRatio: number;
    if (comPop > 0) {
      comRatio = projectedComPop / comPop;
    } else {
      comRatio = projectedComPop;
    }
    
    let indRatio: number;
    if (indPop > 0) {
      indRatio = projectedIndPop / indPop;
    } else {
      indRatio = projectedIndPop;
    }
    
    // Cap ratios
    resRatio = Math.min(resRatio, resRatioMax);
    comRatio = Math.min(comRatio, comRatioMax);
    indRatio = Math.min(indRatio, indRatioMax);
    
    // Tax effect (simplified - assume low tax)
    const taxEffect = 50; // Middle of tax table
    
    // Convert ratios to valve changes
    const resChange = (resRatio - 1) * taxTableScale + taxEffect;
    const comChange = (comRatio - 1) * taxTableScale + taxEffect;
    const indChange = (indRatio - 1) * taxTableScale + taxEffect;
    
    // CUMULATIVE valve updates (this is the key SimCity mechanic!)
    this.resValve = this.clampValve(this.resValve + resChange, this.RES_VALVE_RANGE);
    this.comValve = this.clampValve(this.comValve + comChange, this.COM_VALVE_RANGE);
    this.indValve = this.clampValve(this.indValve + indChange, this.IND_VALVE_RANGE);
    
    // Save current population for next cycle
    this.lastResPop = resPop;
    this.lastComPop = comPop;
    this.lastIndPop = indPop;
    
    // Convert valves to target demand state
    // Distribute demand across density levels
    const resDemand = this.valveToDemand(this.resValve, this.RES_VALVE_RANGE);
    const comDemand = this.valveToDemand(this.comValve, this.COM_VALVE_RANGE);
    const indDemand = this.valveToDemand(this.indValve, this.IND_VALVE_RANGE);
    
    // Residential distribution (more low density at start)
    this.targetDemand.residential.low = this.clampDemand(resDemand * 0.6);
    this.targetDemand.residential.medium = this.clampDemand(
      resPop > 50 ? resDemand * 0.3 : 0
    );
    this.targetDemand.residential.high = this.clampDemand(
      resPop > 200 ? resDemand * 0.1 : 0
    );
    
    // Commercial distribution
    this.targetDemand.commercial.low = this.clampDemand(comDemand * 0.6);
    this.targetDemand.commercial.medium = this.clampDemand(
      resPop > 100 ? comDemand * 0.3 : 0
    );
    this.targetDemand.commercial.high = this.clampDemand(
      resPop > 500 ? comDemand * 0.1 : 0
    );
    
    // Industrial distribution
    this.targetDemand.industrial.dirty = this.clampDemand(indDemand * 0.4);
    this.targetDemand.industrial.manufacturing = this.clampDemand(indDemand * 0.3);
    this.targetDemand.industrial.agriculture = this.clampDemand(indDemand * 0.2);
    this.targetDemand.industrial.highTech = this.clampDemand(
      resPop > 300 ? indDemand * 0.1 : 0
    );

    // Emit demand updated event
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.DEMAND_UPDATED,
        timestamp: Date.now(),
        data: this.demandState,
      });
    }
  }

  /**
   * Clamp valve to range
   */
  private clampValve(value: number, range: number): number {
    return Math.max(-range, Math.min(range, value));
  }

  /**
   * Convert valve value to demand (0 to DEMAND_MAX)
   */
  private valveToDemand(valve: number, range: number): number {
    // Valve ranges from -range to +range
    // Convert to 0 to DEMAND_MAX, with 0 at valve=0
    if (valve <= 0) {
      return 0;
    }
    return (valve / range) * DEMAND_MAX;
  }

  /**
   * Clamp demand value to valid range
   */
  private clampDemand(value: number): number {
    return Math.max(DEMAND_MIN, Math.min(DEMAND_MAX, value));
  }

  /**
   * Smoothly transition current demand toward target
   */
  private transitionDemand(deltaTime: number): void {
    const rate = DEMAND_TRANSITION_RATE * (deltaTime / 1000);

    // Residential
    this.demandState.residential.low = this.lerp(
      this.demandState.residential.low,
      this.targetDemand.residential.low,
      rate
    );
    this.demandState.residential.medium = this.lerp(
      this.demandState.residential.medium,
      this.targetDemand.residential.medium,
      rate
    );
    this.demandState.residential.high = this.lerp(
      this.demandState.residential.high,
      this.targetDemand.residential.high,
      rate
    );

    // Commercial
    this.demandState.commercial.low = this.lerp(
      this.demandState.commercial.low,
      this.targetDemand.commercial.low,
      rate
    );
    this.demandState.commercial.medium = this.lerp(
      this.demandState.commercial.medium,
      this.targetDemand.commercial.medium,
      rate
    );
    this.demandState.commercial.high = this.lerp(
      this.demandState.commercial.high,
      this.targetDemand.commercial.high,
      rate
    );

    // Industrial
    this.demandState.industrial.agriculture = this.lerp(
      this.demandState.industrial.agriculture,
      this.targetDemand.industrial.agriculture,
      rate
    );
    this.demandState.industrial.dirty = this.lerp(
      this.demandState.industrial.dirty,
      this.targetDemand.industrial.dirty,
      rate
    );
    this.demandState.industrial.manufacturing = this.lerp(
      this.demandState.industrial.manufacturing,
      this.targetDemand.industrial.manufacturing,
      rate
    );
    this.demandState.industrial.highTech = this.lerp(
      this.demandState.industrial.highTech,
      this.targetDemand.industrial.highTech,
      rate
    );
  }

  /**
   * Linear interpolation
   */
  private lerp(current: number, target: number, rate: number): number {
    return current + (target - current) * rate;
  }

  /**
   * Process building development
   */
  private processDevelopment(world: World): void {
    if (!this.zoneSystem || !this.powerSystem) return;

    const poweredPositions = this.powerSystem.getPoweredPositions();

    // Get undeveloped zones for each category
    const residentialZones = this.zoneSystem.getUndevelopedZones('residential');
    const commercialZones = this.zoneSystem.getUndevelopedZones('commercial');
    const industrialZones = this.zoneSystem.getUndevelopedZones('industrial');

    // Try to develop zones based on demand (with infrastructure requirements)
    this.tryDevelopZones(world, residentialZones, 'residential', poweredPositions);
    this.tryDevelopZones(world, commercialZones, 'commercial', poweredPositions);
    this.tryDevelopZones(world, industrialZones, 'industrial', poweredPositions);
  }

  /**
   * Try to develop zones of a specific category
   * REQUIRES: Road access AND Power
   */
  private tryDevelopZones(
    world: World,
    zones: Array<{ 
      position: GridPosition; 
      zoneType: { density: ZoneDensity } | null; 
      roadAccess: boolean; 
      utilities: { power: boolean; water: boolean } 
    }>,
    category: ZoneCategory,
    poweredPositions: Set<string>
  ): void {
    for (const zone of zones) {
      if (!zone.zoneType) continue;

      // HARD REQUIREMENT: Must have road access
      if (!zone.roadAccess) {
        continue;
      }

      // HARD REQUIREMENT: Must have power
      const hasPower = poweredPositions.has(posKey(zone.position));
      if (!hasPower) {
        continue;
      }

      const density = zone.zoneType.density;
      const demand = this.getDemandForZone(category, density);

      // Skip if demand is too low
      if (demand < MIN_DEVELOPMENT_DEMAND) continue;

      // Calculate development chance based on demand
      const baseChance = BASE_DEVELOPMENT_CHANCE;
      const demandBonus = Math.min(1, (demand - MIN_DEVELOPMENT_DEMAND) / (FAST_DEVELOPMENT_DEMAND - MIN_DEVELOPMENT_DEMAND));
      
      // Water provides a small bonus but is not required
      const waterBonus = zone.utilities.water ? 0.2 : 0;

      const finalChance = baseChance * (0.5 + demandBonus * 0.5 + waterBonus);

      // Roll for development
      if (Math.random() < finalChance) {
        this.developBuilding(world, zone.position, category, density);
      }
    }
  }

  /**
   * Get demand value for a specific zone type
   */
  private getDemandForZone(category: ZoneCategory, density: ZoneDensity): number {
    switch (category) {
      case 'residential':
        return this.demandState.residential[density];
      case 'commercial':
        return this.demandState.commercial[density];
      case 'industrial':
        // Map density to industrial type (simplified)
        if (density === 'low') return this.demandState.industrial.agriculture;
        if (density === 'medium') return this.demandState.industrial.manufacturing;
        return this.demandState.industrial.dirty;
      default:
        return 0;
    }
  }

  /**
   * Develop a building at a position
   */
  private developBuilding(
    world: World,
    position: GridPosition,
    category: ZoneCategory,
    density: ZoneDensity
  ): void {
    // Create building entity
    const entityId = world.createEntity();

    // Add position component
    world.addComponent(entityId, {
      type: 'position',
      x: position.x,
      y: position.y,
      z: 0,
    } as PositionComponent);

    // Calculate population/jobs based on density
    const { population, jobs } = this.calculateBuildingCapacity(category, density);

    // Add building component with infrastructure tracking
    world.addComponent(entityId, {
      type: 'building',
      buildingType: `${category}_${density}`,
      stage: 1,
      style: 'default',
      condition: 'normal',
      population: category === 'residential' ? population : 0,
      jobs: category !== 'residential' ? jobs : 0,
      status: 'functional',
      infrastructureIssues: { noRoadAccess: false, noPower: false },
      infrastructureLostAt: null,
      isContributing: true,
    } as BuildingComponent);

    // Mark zone as developed
    this.zoneSystem?.setDeveloped(position, entityId);

    // Emit event (building tracking is handled in event listener)
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.BUILDING_DEVELOPED,
        timestamp: Date.now(),
        data: {
          entityId,
          position,
          buildingType: `${category}_${density}`,
          population: category === 'residential' ? population : 0,
          jobs: category !== 'residential' ? jobs : 0,
        },
      });
    }

    console.log(`Building developed at (${position.x}, ${position.y}): ${category} ${density}`);
  }

  /**
   * Calculate building capacity based on type
   */
  private calculateBuildingCapacity(
    category: ZoneCategory,
    density: ZoneDensity
  ): { population: number; jobs: number } {
    switch (category) {
      case 'residential':
        return { population: RESIDENTIAL_WORKERS[density], jobs: 0 };
      case 'commercial':
        return { population: 0, jobs: COMMERCIAL_JOBS[density] };
      case 'industrial':
        return { population: 0, jobs: INDUSTRIAL_JOBS[density] };
      default:
        return { population: 0, jobs: 0 };
    }
  }

  /**
   * Get current demand state
   */
  getDemandState(): Readonly<DemandState> {
    return this.demandState;
  }

  /**
   * Get demand value for a category (normalized -1 to 1)
   * Uses the valve system directly for more responsive feedback
   */
  getNormalizedDemand(category: ZoneCategory): number {
    let valve = 0;
    let range = 0;
    
    switch (category) {
      case 'residential':
        valve = this.resValve;
        range = this.RES_VALVE_RANGE;
        break;
      case 'commercial':
        valve = this.comValve;
        range = this.COM_VALVE_RANGE;
        break;
      case 'industrial':
        valve = this.indValve;
        range = this.IND_VALVE_RANGE;
        break;
    }
    
    // Valve ranges from -range to +range
    // Normalize to -1 to 1
    return Math.max(-1, Math.min(1, valve / range));
  }

  /**
   * Get raw valve values (for debugging/display)
   */
  getValves(): { residential: number; commercial: number; industrial: number } {
    return {
      residential: this.resValve,
      commercial: this.comValve,
      industrial: this.indValve,
    };
  }

  /**
   * Get population count (only from contributing buildings)
   */
  getPopulation(): number {
    return this.contributingPopulation;
  }

  /**
   * Get job counts (only from contributing buildings)
   */
  getJobs(): { commercial: number; industrial: number; total: number } {
    return {
      commercial: this.contributingCommercialJobs,
      industrial: this.contributingIndustrialJobs,
      total: this.contributingCommercialJobs + this.contributingIndustrialJobs,
    };
  }

  /**
   * Get all tracked buildings
   */
  getBuildings(): Map<EntityId, TrackedBuilding> {
    return this.buildings;
  }

  /**
   * Get buildings with infrastructure issues
   */
  getBuildingsWithIssues(): TrackedBuilding[] {
    return Array.from(this.buildings.values()).filter(
      b => b.infrastructureIssues.noRoadAccess || b.infrastructureIssues.noPower
    );
  }

  /**
   * Force a demand recalculation
   */
  recalculateDemand(): void {
    this.calculateDemand();
  }
}

/**
 * Create a new RCI demand system
 */
export function createRCIDemandSystem(): RCIDemandSystem {
  return new RCIDemandSystem();
}
