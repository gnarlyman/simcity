/**
 * Road System
 * 
 * Manages road placement, connections, and rendering.
 * Roads enable zone development and transportation.
 */

import type { 
  GridPosition, 
  RoadType, 
  RoadConnections,
  EntityId,
  RoadComponent,
  PositionComponent
} from '../data/types';
import { Grid, posKey, parseKey } from '../data/Grid';
import { BaseSystem, World } from '../core/ECS';
import { EventBus, EventTypes } from '../core/EventBus';
import { DEFAULT_MAP_SIZE } from '../data/constants';

/**
 * Road cell data
 */
export interface RoadCell {
  position: GridPosition;
  hasRoad: boolean;
  roadType: RoadType;
  connections: RoadConnections;
}

/**
 * Road System class
 */
export class RoadSystem extends BaseSystem {
  name = 'RoadSystem';
  requiredComponents: string[] = [];
  priority = 5;

  /** Road grid */
  private roadGrid: Grid<RoadCell> | null = null;
  
  /** Event bus */
  private eventBus: EventBus | null = null;
  
  /** Road placement active */
  private isPlacingRoads = false;
  
  /** Road dirty flag for rendering */
  private roadDirty = false;
  
  /** Set of road positions for quick lookup */
  private roadPositions: Set<string> = new Set();

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
      const { tool } = event.data as { tool: string };
      this.isPlacingRoads = tool === 'road';
    });

    // Note: Road placement is now handled by main.ts using two-click mode
    // The RoadSystem.placeRoad() method is called directly from main.ts
    // We no longer auto-place roads on TILE_CLICKED or TILE_DRAG events
  }

  /**
   * Update the system
   */
  update(_world: World, _deltaTime: number): void {
    // Road system doesn't need per-tick updates
  }

  /**
   * Initialize the road grid
   */
  initializeGrid(width: number, height: number): void {
    this.roadGrid = new Grid<RoadCell>(width, height, () => this.createEmptyRoadCell({ x: 0, y: 0 }));
    
    // Initialize positions
    this.roadGrid.forEach((cell, pos) => {
      cell.position = { ...pos };
    });
    
    this.roadPositions.clear();
    this.roadDirty = true;
    console.log(`Road grid initialized: ${width}x${height}`);
  }

  /**
   * Create an empty road cell
   */
  private createEmptyRoadCell(position: GridPosition): RoadCell {
    return {
      position,
      hasRoad: false,
      roadType: 'street',
      connections: {
        north: false,
        south: false,
        east: false,
        west: false,
      },
    };
  }

  /**
   * Place a road at a position
   */
  placeRoad(position: GridPosition, roadType: RoadType = 'street'): boolean {
    if (!this.roadGrid || !this.roadGrid.isValid(position)) {
      return false;
    }

    const cell = this.roadGrid.get(position);
    
    // Check if already has road
    if (cell.hasRoad) {
      return false;
    }

    // Place the road
    cell.hasRoad = true;
    cell.roadType = roadType;
    
    // Add to position set
    this.roadPositions.add(posKey(position));
    
    // Update connections for this cell and neighbors
    this.updateConnections(position);
    
    this.roadDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('road:created', {
        position,
        roadType,
      });
    }

    return true;
  }

  /**
   * Remove a road at a position
   */
  removeRoad(position: GridPosition): boolean {
    if (!this.roadGrid || !this.roadGrid.isValid(position)) {
      return false;
    }

    const cell = this.roadGrid.get(position);
    
    if (!cell.hasRoad) {
      return false;
    }

    // Remove the road
    cell.hasRoad = false;
    cell.connections = {
      north: false,
      south: false,
      east: false,
      west: false,
    };
    
    // Remove from position set
    this.roadPositions.delete(posKey(position));
    
    // Update neighbor connections
    this.updateNeighborConnections(position);
    
    this.roadDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('road:deleted', {
        position,
      });
    }

    return true;
  }

  /**
   * Update connections for a cell and its neighbors
   */
  private updateConnections(position: GridPosition): void {
    if (!this.roadGrid) return;

    const cell = this.roadGrid.get(position);
    if (!cell.hasRoad) return;

    // Check each direction
    const north = this.roadGrid.tryGetXY(position.x, position.y - 1);
    const south = this.roadGrid.tryGetXY(position.x, position.y + 1);
    const east = this.roadGrid.tryGetXY(position.x + 1, position.y);
    const west = this.roadGrid.tryGetXY(position.x - 1, position.y);

    // Update this cell's connections
    cell.connections.north = north?.hasRoad ?? false;
    cell.connections.south = south?.hasRoad ?? false;
    cell.connections.east = east?.hasRoad ?? false;
    cell.connections.west = west?.hasRoad ?? false;

    // Update neighbor connections to point to this cell
    if (north?.hasRoad) north.connections.south = true;
    if (south?.hasRoad) south.connections.north = true;
    if (east?.hasRoad) east.connections.west = true;
    if (west?.hasRoad) west.connections.east = true;
  }

  /**
   * Update neighbor connections when a road is removed
   */
  private updateNeighborConnections(position: GridPosition): void {
    if (!this.roadGrid) return;

    const north = this.roadGrid.tryGetXY(position.x, position.y - 1);
    const south = this.roadGrid.tryGetXY(position.x, position.y + 1);
    const east = this.roadGrid.tryGetXY(position.x + 1, position.y);
    const west = this.roadGrid.tryGetXY(position.x - 1, position.y);

    if (north?.hasRoad) north.connections.south = false;
    if (south?.hasRoad) south.connections.north = false;
    if (east?.hasRoad) east.connections.west = false;
    if (west?.hasRoad) west.connections.east = false;
  }

  /**
   * Get road cell at position
   */
  getRoadCell(position: GridPosition): RoadCell | null {
    if (!this.roadGrid || !this.roadGrid.isValid(position)) {
      return null;
    }
    return this.roadGrid.get(position);
  }

  /**
   * Check if position has a road
   */
  hasRoad(position: GridPosition): boolean {
    return this.roadPositions.has(posKey(position));
  }

  /**
   * Check if position has road at coordinates
   */
  hasRoadXY(x: number, y: number): boolean {
    return this.roadPositions.has(`${x},${y}`);
  }

  /**
   * Get road grid
   */
  getRoadGrid(): Grid<RoadCell> | null {
    return this.roadGrid;
  }

  /**
   * Get set of road positions
   */
  getRoadPositions(): Set<string> {
    return this.roadPositions;
  }

  /**
   * Check if road grid needs re-rendering
   */
  isDirty(): boolean {
    return this.roadDirty;
  }

  /**
   * Clear dirty flag
   */
  clearDirty(): void {
    this.roadDirty = false;
  }

  /**
   * Mark as dirty
   */
  markDirty(): void {
    this.roadDirty = true;
  }

  /**
   * Get all road positions as array
   */
  getAllRoadPositions(): GridPosition[] {
    return Array.from(this.roadPositions).map(key => parseKey(key));
  }

  /**
   * Get road connection type for rendering (determines which sprite to use)
   */
  getConnectionType(position: GridPosition): string {
    const cell = this.getRoadCell(position);
    if (!cell || !cell.hasRoad) return 'none';

    const { north, south, east, west } = cell.connections;
    const count = [north, south, east, west].filter(Boolean).length;

    // 4-way intersection
    if (count === 4) return 'intersection_4';
    
    // 3-way intersections
    if (count === 3) {
      if (!north) return 'intersection_t_south';
      if (!south) return 'intersection_t_north';
      if (!east) return 'intersection_t_west';
      if (!west) return 'intersection_t_east';
    }
    
    // Corners
    if (count === 2) {
      if (north && east) return 'corner_ne';
      if (north && west) return 'corner_nw';
      if (south && east) return 'corner_se';
      if (south && west) return 'corner_sw';
      if (north && south) return 'straight_ns';
      if (east && west) return 'straight_ew';
    }
    
    // End pieces
    if (count === 1) {
      if (north) return 'end_north';
      if (south) return 'end_south';
      if (east) return 'end_east';
      if (west) return 'end_west';
    }
    
    // Isolated road (no connections)
    return 'isolated';
  }

  /**
   * Get road statistics
   */
  getRoadStats(): { totalTiles: number; intersections: number } {
    let totalTiles = 0;
    let intersections = 0;

    if (!this.roadGrid) {
      return { totalTiles, intersections };
    }

    this.roadGrid.forEach((cell) => {
      if (cell.hasRoad) {
        totalTiles++;
        const connectionCount = [
          cell.connections.north,
          cell.connections.south,
          cell.connections.east,
          cell.connections.west,
        ].filter(Boolean).length;
        
        if (connectionCount >= 3) {
          intersections++;
        }
      }
    });

    return { totalTiles, intersections };
  }
}

/**
 * Create a new road system
 */
export function createRoadSystem(): RoadSystem {
  return new RoadSystem();
}
