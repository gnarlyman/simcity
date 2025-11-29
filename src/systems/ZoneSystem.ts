/**
 * Zone System
 * 
 * Manages zoning for the city - residential, commercial, and industrial zones.
 * Handles zone placement, removal, and queries.
 */

import type { 
  GridPosition, 
  ZoneType, 
  ZoneCell, 
  ZoneCategory, 
  ZoneDensity,
  EntityId 
} from '../data/types';
import { Grid, posKey, parseKey } from '../data/Grid';
import { BaseSystem, World } from '../core/ECS';
import { EventBus, EventTypes } from '../core/EventBus';
import { 
  ZONE_TYPES, 
  ZONE_COLORS, 
  ZONE_COSTS, 
  MAX_ROAD_DISTANCE,
  DEFAULT_MAP_SIZE 
} from '../data/constants';

/**
 * Zone configuration for system initialization
 */
export interface ZoneSystemConfig {
  width: number;
  height: number;
}

/**
 * Zone placement result
 */
export interface ZonePlacementResult {
  success: boolean;
  positions: GridPosition[];
  cost: number;
  reason?: string;
}

/**
 * Zone System class
 */
export class ZoneSystem extends BaseSystem {
  name = 'ZoneSystem';
  requiredComponents: string[] = [];
  priority = 10;

  /** Zone grid */
  private zoneGrid: Grid<ZoneCell> | null = null;
  
  /** Event bus */
  private eventBus: EventBus | null = null;
  
  /** Currently selected zone type */
  private selectedZoneType: ZoneType | null = null;
  
  /** Zone dirty flag for rendering */
  private zoneDirty = false;
  
  /** Configuration */
  private config: ZoneSystemConfig = {
    width: DEFAULT_MAP_SIZE,
    height: DEFAULT_MAP_SIZE,
  };

  /**
   * Initialize the system
   */
  init(world: World): void {
    this.eventBus = world.getEventBus();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventBus) return;

    // Listen for tool selection
    this.eventBus.on(EventTypes.TOOL_SELECTED, (event) => {
      const { tool, options } = event.data as { tool: string; options?: Record<string, unknown> };
      
      if (tool.startsWith('zone:')) {
        const zoneKey = tool.replace('zone:', '');
        this.selectedZoneType = ZONE_TYPES[zoneKey] ?? null;
      } else if (tool === 'bulldoze') {
        this.selectedZoneType = null;
      } else {
        this.selectedZoneType = null;
      }
    });

    // Listen for tile clicks to place zones
    this.eventBus.on(EventTypes.TILE_CLICKED, (event) => {
      const { position, button, modifiers } = event.data as {
        position: GridPosition;
        button: string;
        modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
      };

      if (button === 'left' && this.selectedZoneType) {
        this.placeZone(position, this.selectedZoneType);
      }
    });

    // Listen for tile drag to paint zones
    this.eventBus.on(EventTypes.TILE_DRAG, (event) => {
      const { position } = event.data as { position: GridPosition };
      
      if (this.selectedZoneType) {
        this.placeZone(position, this.selectedZoneType);
      }
    });
  }

  /**
   * Update the system (processes zone development over time)
   */
  update(_world: World, _deltaTime: number): void {
    // Zone system doesn't need per-tick updates
    // Development is handled by RCIDemandSystem
  }

  /**
   * Initialize the zone grid
   */
  initializeGrid(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    
    this.zoneGrid = new Grid<ZoneCell>(width, height, () => this.createEmptyZoneCell({ x: 0, y: 0 }));
    
    // Initialize positions
    this.zoneGrid.forEach((cell, pos) => {
      cell.position = { ...pos };
    });
    
    this.zoneDirty = true;
    console.log(`Zone grid initialized: ${width}x${height}`);
  }

  /**
   * Create an empty zone cell
   */
  private createEmptyZoneCell(position: GridPosition): ZoneCell {
    return {
      position,
      zoneType: null,
      developed: false,
      buildingId: null,
      lotId: null,
      desirability: 0,
      landValue: 100,
      roadAccess: false,
      utilities: {
        power: false,
        water: false,
      },
    };
  }

  /**
   * Place a zone at a position
   */
  placeZone(position: GridPosition, zoneType: ZoneType): ZonePlacementResult {
    if (!this.zoneGrid) {
      return { success: false, positions: [], cost: 0, reason: 'Zone grid not initialized' };
    }

    if (!this.zoneGrid.isValid(position)) {
      return { success: false, positions: [], cost: 0, reason: 'Position out of bounds' };
    }

    const cell = this.zoneGrid.get(position);
    
    // Check if already zoned with same type
    if (cell.zoneType?.category === zoneType.category && 
        cell.zoneType?.density === zoneType.density) {
      return { success: false, positions: [], cost: 0, reason: 'Already zoned' };
    }

    // Check if developed (can't rezone developed area)
    if (cell.developed && cell.zoneType) {
      return { success: false, positions: [], cost: 0, reason: 'Cannot rezone developed area' };
    }

    // Place the zone
    cell.zoneType = zoneType;
    cell.developed = false;
    cell.buildingId = null;
    
    this.zoneDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.ZONE_CREATED,
        timestamp: Date.now(),
        data: {
          position,
          zoneType,
        },
      });
    }

    const cost = ZONE_COSTS[zoneType.density];
    return { success: true, positions: [position], cost };
  }

  /**
   * Place zones in a rectangular area
   */
  placeZoneRect(
    startPos: GridPosition,
    endPos: GridPosition,
    zoneType: ZoneType
  ): ZonePlacementResult {
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);

    const placedPositions: GridPosition[] = [];
    let totalCost = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const result = this.placeZone({ x, y }, zoneType);
        if (result.success) {
          placedPositions.push(...result.positions);
          totalCost += result.cost;
        }
      }
    }

    return { 
      success: placedPositions.length > 0, 
      positions: placedPositions, 
      cost: totalCost 
    };
  }

  /**
   * Remove zone at a position
   */
  removeZone(position: GridPosition): boolean {
    if (!this.zoneGrid || !this.zoneGrid.isValid(position)) {
      return false;
    }

    const cell = this.zoneGrid.get(position);
    
    if (!cell.zoneType) {
      return false;
    }

    // Can't remove if developed (need to demolish building first)
    if (cell.developed) {
      return false;
    }

    const oldZoneType = cell.zoneType;
    cell.zoneType = null;
    cell.lotId = null;
    
    this.zoneDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.ZONE_DELETED,
        timestamp: Date.now(),
        data: {
          position,
          zoneType: oldZoneType,
        },
      });
    }

    return true;
  }

  /**
   * Get zone cell at position
   */
  getZoneCell(position: GridPosition): ZoneCell | null {
    if (!this.zoneGrid || !this.zoneGrid.isValid(position)) {
      return null;
    }
    return this.zoneGrid.get(position);
  }

  /**
   * Get zone cell at coordinates
   */
  getZoneCellXY(x: number, y: number): ZoneCell | null {
    if (!this.zoneGrid || !this.zoneGrid.isValidXY(x, y)) {
      return null;
    }
    return this.zoneGrid.getXY(x, y);
  }

  /**
   * Get zone grid
   */
  getZoneGrid(): Grid<ZoneCell> | null {
    return this.zoneGrid;
  }

  /**
   * Check if zone grid needs re-rendering
   */
  isDirty(): boolean {
    return this.zoneDirty;
  }

  /**
   * Clear dirty flag
   */
  clearDirty(): void {
    this.zoneDirty = false;
  }

  /**
   * Mark as dirty (for external updates)
   */
  markDirty(): void {
    this.zoneDirty = true;
  }

  /**
   * Get all zoned positions of a specific category
   */
  getZonedPositions(category?: ZoneCategory): GridPosition[] {
    if (!this.zoneGrid) return [];

    return this.zoneGrid.findAll((cell) => {
      if (!cell.zoneType) return false;
      if (category && cell.zoneType.category !== category) return false;
      return true;
    });
  }

  /**
   * Get all undeveloped zones
   */
  getUndevelopedZones(category?: ZoneCategory): ZoneCell[] {
    if (!this.zoneGrid) return [];

    const positions = this.zoneGrid.findAll((cell) => {
      if (!cell.zoneType) return false;
      if (cell.developed) return false;
      if (category && cell.zoneType.category !== category) return false;
      return true;
    });

    return positions.map(pos => this.zoneGrid!.get(pos));
  }

  /**
   * Mark a zone as developed
   */
  setDeveloped(position: GridPosition, buildingId: EntityId): void {
    if (!this.zoneGrid || !this.zoneGrid.isValid(position)) return;

    const cell = this.zoneGrid.get(position);
    cell.developed = true;
    cell.buildingId = buildingId;
    
    this.zoneDirty = true;
  }

  /**
   * Mark a zone as undeveloped (building demolished)
   */
  setUndeveloped(position: GridPosition): void {
    if (!this.zoneGrid || !this.zoneGrid.isValid(position)) return;

    const cell = this.zoneGrid.get(position);
    cell.developed = false;
    cell.buildingId = null;
    
    this.zoneDirty = true;
  }

  /**
   * Update road access for all zones (called after road changes)
   */
  updateRoadAccess(roadPositions: Set<string>): void {
    if (!this.zoneGrid) return;

    this.zoneGrid.forEach((cell, pos) => {
      if (!cell.zoneType) {
        cell.roadAccess = false;
        return;
      }

      // Check if within MAX_ROAD_DISTANCE of a road
      let hasAccess = false;
      for (let dy = -MAX_ROAD_DISTANCE; dy <= MAX_ROAD_DISTANCE && !hasAccess; dy++) {
        for (let dx = -MAX_ROAD_DISTANCE; dx <= MAX_ROAD_DISTANCE && !hasAccess; dx++) {
          const checkPos = { x: pos.x + dx, y: pos.y + dy };
          if (roadPositions.has(posKey(checkPos))) {
            hasAccess = true;
          }
        }
      }
      cell.roadAccess = hasAccess;
    });

    this.zoneDirty = true;
  }

  /**
   * Update utility connections for all zones
   */
  updateUtilities(poweredPositions: Set<string>, wateredPositions: Set<string>): void {
    if (!this.zoneGrid) return;

    this.zoneGrid.forEach((cell, pos) => {
      const key = posKey(pos);
      cell.utilities.power = poweredPositions.has(key);
      cell.utilities.water = wateredPositions.has(key);
    });

    this.zoneDirty = true;
  }

  /**
   * Calculate desirability for a zone cell
   */
  calculateDesirability(position: GridPosition): number {
    const cell = this.getZoneCell(position);
    if (!cell || !cell.zoneType) return 0;

    let desirability = cell.landValue;

    // Road access is essential
    if (!cell.roadAccess) {
      desirability *= 0.1;
    }

    // Utilities boost desirability
    if (cell.utilities.power) desirability *= 1.2;
    if (cell.utilities.water) desirability *= 1.2;

    // TODO: Add pollution, crime, traffic effects
    // TODO: Add proximity to parks, services effects

    return desirability;
  }

  /**
   * Get currently selected zone type
   */
  getSelectedZoneType(): ZoneType | null {
    return this.selectedZoneType;
  }

  /**
   * Set selected zone type directly
   */
  setSelectedZoneType(zoneType: ZoneType | null): void {
    this.selectedZoneType = zoneType;
  }

  /**
   * Get zone statistics
   */
  getZoneStats(): {
    residential: { low: number; medium: number; high: number; developed: number };
    commercial: { low: number; medium: number; high: number; developed: number };
    industrial: { low: number; medium: number; high: number; developed: number };
  } {
    const stats = {
      residential: { low: 0, medium: 0, high: 0, developed: 0 },
      commercial: { low: 0, medium: 0, high: 0, developed: 0 },
      industrial: { low: 0, medium: 0, high: 0, developed: 0 },
    };

    if (!this.zoneGrid) return stats;

    this.zoneGrid.forEach((cell) => {
      if (!cell.zoneType) return;

      const category = cell.zoneType.category;
      const density = cell.zoneType.density;

      stats[category][density]++;
      if (cell.developed) {
        stats[category].developed++;
      }
    });

    return stats;
  }
}

/**
 * Create a new zone system
 */
export function createZoneSystem(): ZoneSystem {
  return new ZoneSystem();
}

/**
 * Get zone type key from category and density
 */
export function getZoneTypeKey(category: ZoneCategory, density: ZoneDensity): string {
  const prefix = category.charAt(0);
  return `${prefix}-${density}`;
}

/**
 * Get zone type from key
 */
export function getZoneType(key: string): ZoneType | undefined {
  return ZONE_TYPES[key];
}
