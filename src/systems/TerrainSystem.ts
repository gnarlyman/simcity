/**
 * Terrain System
 * 
 * Handles terrain generation using simplex noise.
 * Creates elevation, water bodies, vegetation, and surface types.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import type { TerrainCell, SurfaceType, SlopeType, GridPosition } from '../data/types';
import { Grid } from '../data/Grid';
import { 
  SEA_LEVEL, 
  MAX_ELEVATION, 
  TREE_LINE_ELEVATION,
  TERRAIN_GENERATION,
  DEFAULT_MAP_SIZE 
} from '../data/constants';
import { BaseSystem, World } from '../core/ECS';
import { EventBus, EventTypes } from '../core/EventBus';

/**
 * Terrain generation configuration
 */
export interface TerrainConfig {
  width: number;
  height: number;
  seed?: number;
  baseFrequency: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  heightRange: number;
  baseHeight: number;
  seaLevel: number;
  moistureFrequency: number;
  treeFrequency: number;
  riverCount: number;
}

/**
 * Default terrain configuration
 */
const DEFAULT_CONFIG: TerrainConfig = {
  width: DEFAULT_MAP_SIZE,
  height: DEFAULT_MAP_SIZE,
  baseFrequency: TERRAIN_GENERATION.baseFrequency,
  octaves: TERRAIN_GENERATION.octaves,
  persistence: TERRAIN_GENERATION.persistence,
  lacunarity: TERRAIN_GENERATION.lacunarity,
  heightRange: TERRAIN_GENERATION.heightRange,
  baseHeight: TERRAIN_GENERATION.baseHeight,
  seaLevel: SEA_LEVEL,
  moistureFrequency: TERRAIN_GENERATION.moistureFrequency,
  treeFrequency: TERRAIN_GENERATION.treeFrequency,
  riverCount: TERRAIN_GENERATION.riverCount,
};

/**
 * Terrain System class
 */
export class TerrainSystem extends BaseSystem {
  name = 'TerrainSystem';
  requiredComponents: string[] = [];
  priority = 0;

  /** Terrain grid */
  private terrainGrid: Grid<TerrainCell> | null = null;
  
  /** Noise functions */
  private elevationNoise: NoiseFunction2D | null = null;
  private moistureNoise: NoiseFunction2D | null = null;
  private detailNoise: NoiseFunction2D | null = null;
  
  /** Event bus */
  private eventBus: EventBus | null = null;
  
  /** Current configuration */
  private config: TerrainConfig = DEFAULT_CONFIG;

  /**
   * Initialize the system
   */
  init(world: World): void {
    this.eventBus = world.getEventBus();
  }

  /**
   * Update (not used for terrain - static)
   */
  update(_world: World, _deltaTime: number): void {
    // Terrain is static, no update needed
  }

  /**
   * Generate terrain with the given configuration
   */
  generate(config?: Partial<TerrainConfig>): Grid<TerrainCell> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize noise functions with optional seed
    const seed = this.config.seed ?? Math.random();
    this.elevationNoise = createNoise2D(() => seed);
    this.moistureNoise = createNoise2D(() => seed + 0.5);
    this.detailNoise = createNoise2D(() => seed + 0.25);

    // Create terrain grid
    this.terrainGrid = new Grid<TerrainCell>(
      this.config.width,
      this.config.height,
      () => this.createEmptyCell()
    );

    // Generate elevation
    this.generateElevation();

    // Generate water bodies
    this.generateWater();

    // Generate moisture
    this.generateMoisture();

    // Determine surface types
    this.generateSurfaceTypes();

    // Generate vegetation
    this.generateVegetation();

    // Calculate slopes
    this.calculateSlopes();

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: EventTypes.TERRAIN_GENERATED,
        timestamp: Date.now(),
        data: {
          width: this.config.width,
          height: this.config.height,
        },
      });
    }

    console.log(`Terrain generated: ${this.config.width}x${this.config.height}`);
    return this.terrainGrid;
  }

  /**
   * Create an empty terrain cell
   */
  private createEmptyCell(): TerrainCell {
    return {
      elevation: SEA_LEVEL,
      surfaceType: 'grass',
      waterDepth: 0,
      moisture: 0.5,
      treeCount: 0,
      slope: 'flat',
    };
  }

  /**
   * Generate elevation using fractal Brownian motion
   */
  private generateElevation(): void {
    if (!this.terrainGrid || !this.elevationNoise || !this.detailNoise) return;

    const { width, height } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        
        // Generate base elevation using multiple octaves
        let elevation = 0;
        let amplitude = 1;
        let frequency = this.config.baseFrequency;
        let maxAmplitude = 0;

        for (let octave = 0; octave < this.config.octaves; octave++) {
          const noiseValue = this.elevationNoise(x * frequency, y * frequency);
          elevation += noiseValue * amplitude;
          maxAmplitude += amplitude;
          amplitude *= this.config.persistence;
          frequency *= this.config.lacunarity;
        }

        // Normalize to 0-1
        elevation = (elevation / maxAmplitude + 1) / 2;

        // Add some detail noise for variation
        const detail = (this.detailNoise(x * 0.1, y * 0.1) + 1) / 2;
        elevation = elevation * 0.9 + detail * 0.1;

        // Apply island mask (optional - makes edges lower)
        const edgeFactor = this.getEdgeFactor(x, y, width, height);
        elevation *= edgeFactor;

        // Scale to actual elevation range
        cell.elevation = this.config.baseHeight + elevation * this.config.heightRange;
      }
    }
  }

  /**
   * Get edge factor for island generation (1 in center, 0 at edges)
   */
  private getEdgeFactor(x: number, y: number, width: number, height: number): number {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Smooth falloff from center
    const factor = 1 - Math.pow(dist / maxDist, 2);
    return Math.max(0, Math.min(1, factor * 1.5));
  }

  /**
   * Generate water bodies
   */
  private generateWater(): void {
    if (!this.terrainGrid) return;

    const { width, height, seaLevel } = this.config;

    // Fill areas below sea level with water
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        
        if (cell.elevation < seaLevel) {
          cell.waterDepth = seaLevel - cell.elevation;
        }
      }
    }
  }

  /**
   * Generate moisture map
   */
  private generateMoisture(): void {
    if (!this.terrainGrid || !this.moistureNoise) return;

    const { width, height } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        
        // Base moisture from noise
        let moisture = (this.moistureNoise(
          x * this.config.moistureFrequency,
          y * this.config.moistureFrequency
        ) + 1) / 2;

        // Increase moisture near water
        const nearWater = this.isNearWater(x, y, 5);
        if (nearWater) {
          moisture = Math.min(1, moisture + 0.3);
        }

        // Decrease moisture at high elevation
        if (cell.elevation > 350) {
          moisture *= 0.7;
        }

        cell.moisture = moisture;
      }
    }
  }

  /**
   * Check if a position is near water
   */
  private isNearWater(x: number, y: number, radius: number): boolean {
    if (!this.terrainGrid) return false;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.terrainGrid.tryGetXY(x + dx, y + dy);
        if (cell && cell.waterDepth > 0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Determine surface types based on elevation and moisture
   */
  private generateSurfaceTypes(): void {
    if (!this.terrainGrid) return;

    const { width, height, seaLevel } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        
        if (cell.waterDepth > 0) {
          cell.surfaceType = 'underwater';
          continue;
        }

        const elevation = cell.elevation;
        const moisture = cell.moisture;

        // High elevation = rock/snow
        if (elevation > TREE_LINE_ELEVATION + 100) {
          cell.surfaceType = 'snow';
        } else if (elevation > TREE_LINE_ELEVATION) {
          cell.surfaceType = 'rock';
        }
        // Near water and low = sand
        else if (elevation < seaLevel + 10 && this.isNearWater(x, y, 2)) {
          cell.surfaceType = 'sand';
        }
        // Low moisture = dirt
        else if (moisture < 0.3) {
          cell.surfaceType = 'dirt';
        }
        // Default = grass
        else {
          cell.surfaceType = 'grass';
        }
      }
    }
  }

  /**
   * Generate vegetation (trees)
   */
  private generateVegetation(): void {
    if (!this.terrainGrid || !this.detailNoise) return;

    const { width, height } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        
        // No trees underwater or on certain surfaces
        if (cell.waterDepth > 0 || 
            cell.surfaceType === 'rock' || 
            cell.surfaceType === 'snow' ||
            cell.surfaceType === 'sand') {
          cell.treeCount = 0;
          continue;
        }

        // No trees above tree line
        if (cell.elevation > TREE_LINE_ELEVATION) {
          cell.treeCount = 0;
          continue;
        }

        // Base tree density from noise
        const treeNoise = (this.detailNoise(
          x * this.config.treeFrequency,
          y * this.config.treeFrequency
        ) + 1) / 2;

        // Modify by moisture
        let treeDensity = treeNoise * cell.moisture;

        // Reduce at high elevation
        if (cell.elevation > 400) {
          treeDensity *= 1 - (cell.elevation - 400) / 200;
        }

        // Convert to tree count (0-3)
        if (treeDensity > 0.7) {
          cell.treeCount = 3;
        } else if (treeDensity > 0.5) {
          cell.treeCount = 2;
        } else if (treeDensity > 0.3) {
          cell.treeCount = 1;
        } else {
          cell.treeCount = 0;
        }
      }
    }
  }

  /**
   * Calculate slope types for each cell
   */
  private calculateSlopes(): void {
    if (!this.terrainGrid) return;

    const { width, height } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrainGrid.getXY(x, y);
        cell.slope = this.calculateSlopeType(x, y);
      }
    }
  }

  /**
   * Calculate the slope type for a cell based on neighbors
   */
  private calculateSlopeType(x: number, y: number): SlopeType {
    if (!this.terrainGrid) return 'flat';

    const cell = this.terrainGrid.getXY(x, y);
    const elevation = cell.elevation;

    // Get neighbor elevations
    const n = this.terrainGrid.tryGetXY(x, y - 1)?.elevation ?? elevation;
    const s = this.terrainGrid.tryGetXY(x, y + 1)?.elevation ?? elevation;
    const e = this.terrainGrid.tryGetXY(x + 1, y)?.elevation ?? elevation;
    const w = this.terrainGrid.tryGetXY(x - 1, y)?.elevation ?? elevation;

    const threshold = 5; // Elevation difference to count as slope

    const northHigher = n - elevation > threshold;
    const southHigher = s - elevation > threshold;
    const eastHigher = e - elevation > threshold;
    const westHigher = w - elevation > threshold;

    // Check for cardinal slopes
    if (northHigher && !southHigher && !eastHigher && !westHigher) return 'slope_n';
    if (southHigher && !northHigher && !eastHigher && !westHigher) return 'slope_s';
    if (eastHigher && !northHigher && !southHigher && !westHigher) return 'slope_e';
    if (westHigher && !northHigher && !southHigher && !eastHigher) return 'slope_w';

    // Check for corners
    if (northHigher && eastHigher) return 'corner_ne';
    if (northHigher && westHigher) return 'corner_nw';
    if (southHigher && eastHigher) return 'corner_se';
    if (southHigher && westHigher) return 'corner_sw';

    return 'flat';
  }

  /**
   * Get the terrain grid
   */
  getTerrainGrid(): Grid<TerrainCell> | null {
    return this.terrainGrid;
  }

  /**
   * Get elevation at a position
   */
  getElevation(x: number, y: number): number {
    if (!this.terrainGrid) return SEA_LEVEL;
    const cell = this.terrainGrid.tryGetXY(x, y);
    return cell?.elevation ?? SEA_LEVEL;
  }

  /**
   * Check if a position is buildable
   */
  isBuildable(x: number, y: number): boolean {
    if (!this.terrainGrid) return false;
    const cell = this.terrainGrid.tryGetXY(x, y);
    if (!cell) return false;
    
    // Can't build on water
    if (cell.waterDepth > 0) return false;
    
    // Can't build on steep slopes (simplified check)
    if (cell.slope !== 'flat') return false;
    
    return true;
  }

  /**
   * Get terrain info at a position (for UI display)
   */
  getTerrainInfo(x: number, y: number): TerrainCell | null {
    if (!this.terrainGrid) return null;
    return this.terrainGrid.tryGetXY(x, y) ?? null;
  }
}

/**
 * Create a new terrain system
 */
export function createTerrainSystem(): TerrainSystem {
  return new TerrainSystem();
}
