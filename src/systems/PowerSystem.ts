/**
 * Power System
 * 
 * Manages power generation, transmission, and distribution.
 * Power plants generate electricity, power lines transmit it,
 * and zones/buildings consume it.
 */

import type { 
  GridPosition, 
  PowerPlantType, 
  PowerConnections,
  PowerCell,
  PowerPlant
} from '../data/types';
import { Grid, posKey, parseKey } from '../data/Grid';
import { BaseSystem, World } from '../core/ECS';
import { EventBus, EventTypes } from '../core/EventBus';
import { 
  DEFAULT_MAP_SIZE, 
  POWER_PLANT_CONFIGS,
  POWER_TRANSMISSION_RANGE
} from '../data/constants';

/**
 * Power System class
 */
export class PowerSystem extends BaseSystem {
  name = 'PowerSystem';
  requiredComponents: string[] = [];
  priority = 6;

  /** Power grid */
  private powerGrid: Grid<PowerCell> | null = null;
  
  /** Event bus */
  private eventBus: EventBus | null = null;
  
  /** Power dirty flag for rendering */
  private powerDirty = false;
  
  /** Set of powered positions (for quick lookup) */
  private poweredPositions: Set<string> = new Set();
  
  /** Set of power line positions */
  private powerLinePositions: Set<string> = new Set();
  
  /** Map of power plants by ID */
  private powerPlants: Map<string, PowerPlant> = new Map();
  
  /** Next power plant ID */
  private nextPlantId = 1;
  
  /** Total power capacity (MW) */
  private totalCapacity = 0;
  
  /** Total power consumption (MW) */
  private totalConsumption = 0;

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
      // Power tools are handled by main.ts
    });
  }

  /**
   * Update the system
   */
  update(_world: World, _deltaTime: number): void {
    // Power system doesn't need per-tick updates
    // Power propagation is recalculated when infrastructure changes
  }

  /**
   * Initialize the power grid
   */
  initializeGrid(width: number, height: number): void {
    this.powerGrid = new Grid<PowerCell>(width, height, () => this.createEmptyPowerCell({ x: 0, y: 0 }));
    
    // Initialize positions
    this.powerGrid.forEach((cell, pos) => {
      cell.position = { ...pos };
    });
    
    this.poweredPositions.clear();
    this.powerLinePositions.clear();
    this.powerPlants.clear();
    this.totalCapacity = 0;
    this.totalConsumption = 0;
    this.powerDirty = true;
    console.log(`Power grid initialized: ${width}x${height}`);
  }

  /**
   * Create an empty power cell
   */
  private createEmptyPowerCell(position: GridPosition): PowerCell {
    return {
      position,
      hasPowerLine: false,
      hasPowerPlant: false,
      powerPlantType: null,
      powered: false,
      connections: {
        north: false,
        south: false,
        east: false,
        west: false,
      },
    };
  }

  /**
   * Place a power line at a position
   */
  placePowerLine(position: GridPosition): boolean {
    if (!this.powerGrid || !this.powerGrid.isValid(position)) {
      return false;
    }

    const cell = this.powerGrid.get(position);
    
    // Can't place on existing power plant
    if (cell.hasPowerPlant) {
      return false;
    }

    // Check if already has power line
    if (cell.hasPowerLine) {
      return false;
    }

    // Place the power line
    cell.hasPowerLine = true;
    
    // Add to position set
    this.powerLinePositions.add(posKey(position));
    
    // Update connections for this cell and neighbors
    this.updateConnections(position);
    
    // Recalculate power grid
    this.recalculatePowerGrid();
    
    this.powerDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('power:line_created', {
        position,
      });
    }

    return true;
  }

  /**
   * Place a power plant at a position
   */
  placePowerPlant(position: GridPosition, plantType: PowerPlantType): boolean {
    if (!this.powerGrid || !this.powerGrid.isValid(position)) {
      return false;
    }

    const config = POWER_PLANT_CONFIGS[plantType];
    
    // Check if all cells for the power plant are valid and empty
    for (let dy = 0; dy < config.size.height; dy++) {
      for (let dx = 0; dx < config.size.width; dx++) {
        const checkPos = { x: position.x + dx, y: position.y + dy };
        if (!this.powerGrid.isValid(checkPos)) {
          return false;
        }
        const checkCell = this.powerGrid.get(checkPos);
        if (checkCell.hasPowerLine || checkCell.hasPowerPlant) {
          return false;
        }
      }
    }

    // Create the power plant
    const plantId = `plant_${this.nextPlantId++}`;
    const plant: PowerPlant = {
      id: plantId,
      type: plantType,
      position: { ...position },
      capacity: config.capacity,
      currentOutput: config.capacity * config.efficiency,
      efficiency: config.efficiency,
      maintenanceCost: config.maintenanceCost,
    };

    this.powerPlants.set(plantId, plant);
    this.totalCapacity += plant.currentOutput;

    // Mark all cells as having power plant
    for (let dy = 0; dy < config.size.height; dy++) {
      for (let dx = 0; dx < config.size.width; dx++) {
        const cellPos = { x: position.x + dx, y: position.y + dy };
        const cell = this.powerGrid.get(cellPos);
        cell.hasPowerPlant = true;
        cell.powerPlantType = plantType;
        cell.powered = true;
        this.poweredPositions.add(posKey(cellPos));
      }
    }

    // Recalculate power grid
    this.recalculatePowerGrid();
    
    this.powerDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('power:plant_created', {
        position,
        plantType,
        plantId,
        capacity: plant.currentOutput,
      });
    }

    return true;
  }

  /**
   * Remove a power line at a position
   */
  removePowerLine(position: GridPosition): boolean {
    if (!this.powerGrid || !this.powerGrid.isValid(position)) {
      return false;
    }

    const cell = this.powerGrid.get(position);
    
    // Can't remove power plant this way
    if (cell.hasPowerPlant) {
      return false;
    }

    if (!cell.hasPowerLine) {
      return false;
    }

    // Remove the power line
    cell.hasPowerLine = false;
    cell.connections = {
      north: false,
      south: false,
      east: false,
      west: false,
    };
    
    // Remove from position set
    this.powerLinePositions.delete(posKey(position));
    
    // Update neighbor connections
    this.updateNeighborConnections(position);
    
    // Recalculate power grid
    this.recalculatePowerGrid();
    
    this.powerDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('power:line_deleted', {
        position,
      });
    }

    return true;
  }

  /**
   * Remove a power plant at a position
   */
  removePowerPlant(position: GridPosition): boolean {
    if (!this.powerGrid || !this.powerGrid.isValid(position)) {
      return false;
    }

    const cell = this.powerGrid.get(position);
    
    if (!cell.hasPowerPlant) {
      return false;
    }

    // Find the power plant
    let plantToRemove: PowerPlant | null = null;
    for (const plant of this.powerPlants.values()) {
      const config = POWER_PLANT_CONFIGS[plant.type];
      // Check if position is within this plant's footprint
      if (position.x >= plant.position.x && 
          position.x < plant.position.x + config.size.width &&
          position.y >= plant.position.y && 
          position.y < plant.position.y + config.size.height) {
        plantToRemove = plant;
        break;
      }
    }

    if (!plantToRemove) {
      return false;
    }

    const config = POWER_PLANT_CONFIGS[plantToRemove.type];
    
    // Remove from capacity
    this.totalCapacity -= plantToRemove.currentOutput;
    
    // Remove from plants map
    this.powerPlants.delete(plantToRemove.id);

    // Clear all cells
    for (let dy = 0; dy < config.size.height; dy++) {
      for (let dx = 0; dx < config.size.width; dx++) {
        const cellPos = { x: plantToRemove.position.x + dx, y: plantToRemove.position.y + dy };
        const cellToRemove = this.powerGrid.get(cellPos);
        cellToRemove.hasPowerPlant = false;
        cellToRemove.powerPlantType = null;
        cellToRemove.powered = false;
        this.poweredPositions.delete(posKey(cellPos));
      }
    }

    // Recalculate power grid
    this.recalculatePowerGrid();
    
    this.powerDirty = true;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emitType('power:plant_deleted', {
        position,
        plantId: plantToRemove.id,
      });
    }

    return true;
  }

  /**
   * Update connections for a cell and its neighbors
   */
  private updateConnections(position: GridPosition): void {
    if (!this.powerGrid) return;

    const cell = this.powerGrid.get(position);
    if (!cell.hasPowerLine && !cell.hasPowerPlant) return;

    // Check each direction
    const north = this.powerGrid.tryGetXY(position.x, position.y - 1);
    const south = this.powerGrid.tryGetXY(position.x, position.y + 1);
    const east = this.powerGrid.tryGetXY(position.x + 1, position.y);
    const west = this.powerGrid.tryGetXY(position.x - 1, position.y);

    // Update this cell's connections
    const canConnect = (neighbor: PowerCell | undefined): boolean => 
      (neighbor?.hasPowerLine || neighbor?.hasPowerPlant) ?? false;
    
    cell.connections.north = canConnect(north);
    cell.connections.south = canConnect(south);
    cell.connections.east = canConnect(east);
    cell.connections.west = canConnect(west);

    // Update neighbor connections to point to this cell
    if (canConnect(north)) north!.connections.south = true;
    if (canConnect(south)) south!.connections.north = true;
    if (canConnect(east)) east!.connections.west = true;
    if (canConnect(west)) west!.connections.east = true;
  }

  /**
   * Update neighbor connections when infrastructure is removed
   */
  private updateNeighborConnections(position: GridPosition): void {
    if (!this.powerGrid) return;

    const north = this.powerGrid.tryGetXY(position.x, position.y - 1);
    const south = this.powerGrid.tryGetXY(position.x, position.y + 1);
    const east = this.powerGrid.tryGetXY(position.x + 1, position.y);
    const west = this.powerGrid.tryGetXY(position.x - 1, position.y);

    if (north?.hasPowerLine || north?.hasPowerPlant) north.connections.south = false;
    if (south?.hasPowerLine || south?.hasPowerPlant) south.connections.north = false;
    if (east?.hasPowerLine || east?.hasPowerPlant) east.connections.west = false;
    if (west?.hasPowerLine || west?.hasPowerPlant) west.connections.east = false;
  }

  /**
   * Recalculate the entire power grid using flood fill from power plants
   */
  recalculatePowerGrid(): void {
    if (!this.powerGrid) return;

    // Reset all powered states (except power plants themselves)
    this.powerGrid.forEach((cell) => {
      if (!cell.hasPowerPlant) {
        cell.powered = false;
      }
    });
    this.poweredPositions.clear();

    // Add power plant positions as powered
    for (const plant of this.powerPlants.values()) {
      const config = POWER_PLANT_CONFIGS[plant.type];
      for (let dy = 0; dy < config.size.height; dy++) {
        for (let dx = 0; dx < config.size.width; dx++) {
          const cellPos = { x: plant.position.x + dx, y: plant.position.y + dy };
          this.poweredPositions.add(posKey(cellPos));
          const cell = this.powerGrid.get(cellPos);
          cell.powered = true;
        }
      }
    }

    // Flood fill from power plants through power lines
    const visited = new Set<string>();
    const queue: GridPosition[] = [];

    // Start from all power plant positions
    for (const plant of this.powerPlants.values()) {
      const config = POWER_PLANT_CONFIGS[plant.type];
      for (let dy = 0; dy < config.size.height; dy++) {
        for (let dx = 0; dx < config.size.width; dx++) {
          const startPos = { x: plant.position.x + dx, y: plant.position.y + dy };
          queue.push(startPos);
          visited.add(posKey(startPos));
        }
      }
    }

    // BFS flood fill
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentCell = this.powerGrid.get(current);
      
      // Check all four directions
      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
      ];

      for (const neighbor of neighbors) {
        const key = posKey(neighbor);
        if (visited.has(key)) continue;
        
        if (!this.powerGrid.isValid(neighbor)) continue;
        
        const neighborCell = this.powerGrid.get(neighbor);
        
        // Power only propagates through power lines and power plants
        if (neighborCell.hasPowerLine || neighborCell.hasPowerPlant) {
          visited.add(key);
          neighborCell.powered = true;
          this.poweredPositions.add(key);
          queue.push(neighbor);
        }
      }
    }

    // Calculate powered areas within transmission range of power infrastructure
    this.calculatePoweredAreas();

    // Emit power update event
    if (this.eventBus) {
      this.eventBus.emitType('power:grid_updated', {
        poweredPositions: this.poweredPositions,
        totalCapacity: this.totalCapacity,
      });
    }
  }

  /**
   * Calculate areas that receive power (within range of powered infrastructure)
   */
  private calculatePoweredAreas(): void {
    if (!this.powerGrid) return;

    // For each powered infrastructure, mark nearby cells as powered
    const infraPositions = new Set<string>();
    
    this.powerGrid.forEach((cell, pos) => {
      if (cell.powered && (cell.hasPowerLine || cell.hasPowerPlant)) {
        infraPositions.add(posKey(pos));
      }
    });

    // Spread power to areas within transmission range
    for (const key of infraPositions) {
      const pos = parseKey(key);
      
      for (let dy = -POWER_TRANSMISSION_RANGE; dy <= POWER_TRANSMISSION_RANGE; dy++) {
        for (let dx = -POWER_TRANSMISSION_RANGE; dx <= POWER_TRANSMISSION_RANGE; dx++) {
          const checkPos = { x: pos.x + dx, y: pos.y + dy };
          if (this.powerGrid.isValid(checkPos)) {
            this.poweredPositions.add(posKey(checkPos));
          }
        }
      }
    }
  }

  /**
   * Check if a position has power
   */
  hasPower(position: GridPosition): boolean {
    return this.poweredPositions.has(posKey(position));
  }

  /**
   * Check if a position has power at coordinates
   */
  hasPowerXY(x: number, y: number): boolean {
    return this.poweredPositions.has(`${x},${y}`);
  }

  /**
   * Get power cell at position
   */
  getPowerCell(position: GridPosition): PowerCell | null {
    if (!this.powerGrid || !this.powerGrid.isValid(position)) {
      return null;
    }
    return this.powerGrid.get(position);
  }

  /**
   * Get power grid
   */
  getPowerGrid(): Grid<PowerCell> | null {
    return this.powerGrid;
  }

  /**
   * Get set of powered positions
   */
  getPoweredPositions(): Set<string> {
    return this.poweredPositions;
  }

  /**
   * Get set of power line positions
   */
  getPowerLinePositions(): Set<string> {
    return this.powerLinePositions;
  }

  /**
   * Check if power grid needs re-rendering
   */
  isDirty(): boolean {
    return this.powerDirty;
  }

  /**
   * Clear dirty flag
   */
  clearDirty(): void {
    this.powerDirty = false;
  }

  /**
   * Mark as dirty
   */
  markDirty(): void {
    this.powerDirty = true;
  }

  /**
   * Get all power plants
   */
  getPowerPlants(): PowerPlant[] {
    return Array.from(this.powerPlants.values());
  }

  /**
   * Get power statistics
   */
  getPowerStats(): { 
    totalCapacity: number; 
    totalConsumption: number; 
    powerPlantCount: number;
    powerLineTiles: number;
    poweredTiles: number;
  } {
    return {
      totalCapacity: this.totalCapacity,
      totalConsumption: this.totalConsumption,
      powerPlantCount: this.powerPlants.size,
      powerLineTiles: this.powerLinePositions.size,
      poweredTiles: this.poweredPositions.size,
    };
  }

  /**
   * Update power consumption (called from zone system)
   */
  updateConsumption(consumption: number): void {
    this.totalConsumption = consumption;
  }

  /**
   * Check if there's sufficient power
   */
  hasSufficientPower(): boolean {
    return this.totalCapacity >= this.totalConsumption;
  }
}

/**
 * Create a new power system
 */
export function createPowerSystem(): PowerSystem {
  return new PowerSystem();
}
