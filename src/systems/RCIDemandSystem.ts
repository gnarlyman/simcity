/**
 * RCI Demand System
 * 
 * Calculates and manages Residential, Commercial, and Industrial demand.
 * Demand drives building development in zoned areas.
 */

import type { 
  GridPosition, 
  DemandState, 
  ZoneCategory, 
  ZoneDensity,
  EntityId,
  BuildingComponent,
  PositionComponent
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
  BASE_ABANDONMENT_CHANCE,
  ABANDONMENT_DEMAND_THRESHOLD
} from '../data/constants';
import { ZoneSystem } from './ZoneSystem';

/**
 * Development chance modifiers
 */
interface DevelopmentModifiers {
  demand: number;
  desirability: number;
  roadAccess: boolean;
  utilities: boolean;
}

/**
 * RCI Demand System class
 */
export class RCIDemandSystem extends BaseSystem {
  name = 'RCIDemandSystem';
  requiredComponents: string[] = [];
  priority = 20;

  /** Current demand state */
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

  /** Event bus */
  private eventBus: EventBus | null = null;

  /** Zone system reference */
  private zoneSystem: ZoneSystem | null = null;

  /** Time accumulator for demand updates */
  private updateAccumulator = 0;

  /** Time accumulator for development checks */
  private developmentAccumulator = 0;

  /** Development check interval (ms) */
  private developmentInterval = 1000;

  /** Population count */
  private population = 0;

  /** Job counts */
  private commercialJobs = 0;
  private industrialJobs = 0;

  /**
   * Initialize the system
   */
  init(world: World): void {
    this.eventBus = world.getEventBus();
    this.zoneSystem = world.getSystem<ZoneSystem>('ZoneSystem');
    
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
      const { population, jobs } = event.data as { population: number; jobs: number };
      this.population += population;
      // Jobs are split between commercial and industrial based on building type
    });

    // Listen for building abandonment/demolition
    this.eventBus.on(EventTypes.BUILDING_ABANDONED, (event) => {
      const { population, jobs } = event.data as { population: number; jobs: number };
      this.population = Math.max(0, this.population - population);
    });
  }

  /**
   * Set initial demand values
   */
  private setInitialDemand(): void {
    // Start with moderate residential demand to kick-start development
    this.targetDemand.residential.low = 2000;
    this.targetDemand.residential.medium = 500;
    this.targetDemand.residential.high = 0;

    // Low initial commercial demand
    this.targetDemand.commercial.low = 500;
    this.targetDemand.commercial.medium = 0;
    this.targetDemand.commercial.high = 0;

    // Moderate industrial demand
    this.targetDemand.industrial.dirty = 1000;
    this.targetDemand.industrial.manufacturing = 500;
    this.targetDemand.industrial.agriculture = 200;
    this.targetDemand.industrial.highTech = 0;

    // Copy to current state
    this.demandState = JSON.parse(JSON.stringify(this.targetDemand));
  }

  /**
   * Update the system
   */
  update(world: World, deltaTime: number): void {
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
   * Calculate demand based on city state
   */
  private calculateDemand(): void {
    const stats = this.zoneSystem?.getZoneStats();
    if (!stats) return;

    // Calculate residential demand
    // People want to move in if there are jobs
    const totalJobs = this.commercialJobs + this.industrialJobs;
    const unemployed = Math.max(0, this.population - totalJobs);
    const jobSurplus = Math.max(0, totalJobs - this.population);

    // Residential demand increases with job surplus
    this.targetDemand.residential.low = this.clampDemand(
      1000 + jobSurplus * 10 - stats.residential.developed * 5
    );
    this.targetDemand.residential.medium = this.clampDemand(
      Math.max(0, this.population - 100) * 2 - stats.residential.developed * 3
    );
    this.targetDemand.residential.high = this.clampDemand(
      Math.max(0, this.population - 500) * 1 - stats.residential.developed * 2
    );

    // Commercial demand based on population
    const commercialNeed = this.population * 0.3;
    this.targetDemand.commercial.low = this.clampDemand(
      500 + commercialNeed - stats.commercial.developed * 10
    );
    this.targetDemand.commercial.medium = this.clampDemand(
      Math.max(0, this.population - 200) - stats.commercial.developed * 5
    );
    this.targetDemand.commercial.high = this.clampDemand(
      Math.max(0, this.population - 1000) * 0.5 - stats.commercial.developed * 3
    );

    // Industrial demand based on commercial activity and population
    const industrialNeed = this.population * 0.4 + this.commercialJobs * 0.2;
    this.targetDemand.industrial.dirty = this.clampDemand(
      500 + industrialNeed * 0.4 - stats.industrial.developed * 8
    );
    this.targetDemand.industrial.manufacturing = this.clampDemand(
      industrialNeed * 0.3 - stats.industrial.developed * 5
    );
    this.targetDemand.industrial.agriculture = this.clampDemand(
      200 + this.population * 0.1 - stats.industrial.developed * 3
    );
    this.targetDemand.industrial.highTech = this.clampDemand(
      Math.max(0, this.population - 500) * 0.2 - stats.industrial.developed * 2
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
    if (!this.zoneSystem) return;

    // Get undeveloped zones for each category
    const residentialZones = this.zoneSystem.getUndevelopedZones('residential');
    const commercialZones = this.zoneSystem.getUndevelopedZones('commercial');
    const industrialZones = this.zoneSystem.getUndevelopedZones('industrial');

    // Try to develop zones based on demand
    this.tryDevelopZones(world, residentialZones, 'residential');
    this.tryDevelopZones(world, commercialZones, 'commercial');
    this.tryDevelopZones(world, industrialZones, 'industrial');
  }

  /**
   * Try to develop zones of a specific category
   */
  private tryDevelopZones(
    world: World,
    zones: Array<{ position: GridPosition; zoneType: { density: ZoneDensity } | null; roadAccess: boolean; utilities: { power: boolean; water: boolean } }>,
    category: ZoneCategory
  ): void {
    for (const zone of zones) {
      if (!zone.zoneType) continue;

      const density = zone.zoneType.density;
      const demand = this.getDemandForZone(category, density);

      // Skip if demand is too low
      if (demand < MIN_DEVELOPMENT_DEMAND) continue;

      // Calculate development chance
      const baseChance = BASE_DEVELOPMENT_CHANCE;
      const demandBonus = (demand - MIN_DEVELOPMENT_DEMAND) / (FAST_DEVELOPMENT_DEMAND - MIN_DEVELOPMENT_DEMAND);
      
      // Road access is currently always true for simplicity
      // In a full implementation, this would check actual road connectivity
      const roadBonus = zone.roadAccess ? 1.0 : 0.1;
      
      // Utilities bonus
      const utilityBonus = (zone.utilities.power ? 0.5 : 0) + (zone.utilities.water ? 0.5 : 0);

      const finalChance = baseChance * (1 + demandBonus) * roadBonus * (0.5 + utilityBonus);

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

    // Add building component
    world.addComponent(entityId, {
      type: 'building',
      buildingType: `${category}_${density}`,
      stage: 1,
      style: 'default',
      condition: 'normal',
      population: category === 'residential' ? population : 0,
      jobs: category !== 'residential' ? jobs : 0,
    } as BuildingComponent);

    // Mark zone as developed
    this.zoneSystem?.setDeveloped(position, entityId);

    // Update totals
    if (category === 'residential') {
      this.population += population;
    } else if (category === 'commercial') {
      this.commercialJobs += jobs;
    } else {
      this.industrialJobs += jobs;
    }

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.BUILDING_DEVELOPED,
        timestamp: Date.now(),
        data: {
          entityId,
          position,
          buildingType: `${category}_${density}`,
          population,
          jobs,
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
    const densityMultiplier = density === 'low' ? 1 : density === 'medium' ? 4 : 16;

    switch (category) {
      case 'residential':
        return { population: 2 * densityMultiplier, jobs: 0 };
      case 'commercial':
        return { population: 0, jobs: 3 * densityMultiplier };
      case 'industrial':
        return { population: 0, jobs: 5 * densityMultiplier };
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
   */
  getNormalizedDemand(category: ZoneCategory): number {
    let total = 0;
    switch (category) {
      case 'residential':
        total = this.demandState.residential.low + 
                this.demandState.residential.medium + 
                this.demandState.residential.high;
        break;
      case 'commercial':
        total = this.demandState.commercial.low + 
                this.demandState.commercial.medium + 
                this.demandState.commercial.high;
        break;
      case 'industrial':
        total = this.demandState.industrial.agriculture + 
                this.demandState.industrial.dirty + 
                this.demandState.industrial.manufacturing + 
                this.demandState.industrial.highTech;
        break;
    }
    return Math.max(-1, Math.min(1, total / DEMAND_MAX));
  }

  /**
   * Get population count
   */
  getPopulation(): number {
    return this.population;
  }

  /**
   * Get job counts
   */
  getJobs(): { commercial: number; industrial: number; total: number } {
    return {
      commercial: this.commercialJobs,
      industrial: this.industrialJobs,
      total: this.commercialJobs + this.industrialJobs,
    };
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
