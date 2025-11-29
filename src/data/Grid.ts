/**
 * Grid Data Structure
 * 
 * A generic 2D grid for storing tile-based data.
 * Used for terrain, zones, utilities, and other spatial data.
 */

import type { GridPosition, Bounds } from './types';

/**
 * Generic 2D grid class
 */
export class Grid<T> {
  private data: T[];
  readonly width: number;
  readonly height: number;

  /**
   * Create a new grid
   * @param width Grid width in cells
   * @param height Grid height in cells
   * @param defaultValue Factory function to create default cell values
   */
  constructor(width: number, height: number, defaultValue: () => T) {
    this.width = width;
    this.height = height;
    this.data = new Array<T>(width * height);

    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = defaultValue();
    }
  }

  /**
   * Convert x,y to flat array index
   */
  private toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * Check if a position is within grid bounds
   */
  isValid(pos: GridPosition): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  /**
   * Check if coordinates are within grid bounds
   */
  isValidXY(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Get value at position
   * @throws Error if position is out of bounds
   */
  get(pos: GridPosition): T {
    if (!this.isValid(pos)) {
      throw new Error(`Grid position out of bounds: (${pos.x}, ${pos.y})`);
    }
    return this.data[this.toIndex(pos.x, pos.y)]!;
  }

  /**
   * Get value at coordinates
   * @throws Error if coordinates are out of bounds
   */
  getXY(x: number, y: number): T {
    if (!this.isValidXY(x, y)) {
      throw new Error(`Grid position out of bounds: (${x}, ${y})`);
    }
    return this.data[this.toIndex(x, y)]!;
  }

  /**
   * Get value at position, or undefined if out of bounds
   */
  tryGet(pos: GridPosition): T | undefined {
    if (!this.isValid(pos)) {
      return undefined;
    }
    return this.data[this.toIndex(pos.x, pos.y)];
  }

  /**
   * Get value at coordinates, or undefined if out of bounds
   */
  tryGetXY(x: number, y: number): T | undefined {
    if (!this.isValidXY(x, y)) {
      return undefined;
    }
    return this.data[this.toIndex(x, y)];
  }

  /**
   * Set value at position
   * @throws Error if position is out of bounds
   */
  set(pos: GridPosition, value: T): void {
    if (!this.isValid(pos)) {
      throw new Error(`Grid position out of bounds: (${pos.x}, ${pos.y})`);
    }
    this.data[this.toIndex(pos.x, pos.y)] = value;
  }

  /**
   * Set value at coordinates
   * @throws Error if coordinates are out of bounds
   */
  setXY(x: number, y: number, value: T): void {
    if (!this.isValidXY(x, y)) {
      throw new Error(`Grid position out of bounds: (${x}, ${y})`);
    }
    this.data[this.toIndex(x, y)] = value;
  }

  /**
   * Get orthogonal neighbors (N, S, E, W)
   */
  getNeighbors4(pos: GridPosition): GridPosition[] {
    const neighbors: GridPosition[] = [];
    const offsets = [
      { x: 0, y: -1 },  // North
      { x: 0, y: 1 },   // South
      { x: 1, y: 0 },   // East
      { x: -1, y: 0 },  // West
    ];

    for (const offset of offsets) {
      const neighbor = { x: pos.x + offset.x, y: pos.y + offset.y };
      if (this.isValid(neighbor)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  /**
   * Get all 8 neighbors (including diagonals)
   */
  getNeighbors8(pos: GridPosition): GridPosition[] {
    const neighbors: GridPosition[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const neighbor = { x: pos.x + dx, y: pos.y + dy };
        if (this.isValid(neighbor)) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Get neighbor values (N, S, E, W) with default for out-of-bounds
   */
  getNeighborValues4(pos: GridPosition, defaultValue: T): { n: T; s: T; e: T; w: T } {
    return {
      n: this.tryGetXY(pos.x, pos.y - 1) ?? defaultValue,
      s: this.tryGetXY(pos.x, pos.y + 1) ?? defaultValue,
      e: this.tryGetXY(pos.x + 1, pos.y) ?? defaultValue,
      w: this.tryGetXY(pos.x - 1, pos.y) ?? defaultValue,
    };
  }

  /**
   * Get all 8 neighbor values with default for out-of-bounds
   */
  getNeighborValues8(
    pos: GridPosition,
    defaultValue: T
  ): { n: T; s: T; e: T; w: T; ne: T; nw: T; se: T; sw: T } {
    return {
      n: this.tryGetXY(pos.x, pos.y - 1) ?? defaultValue,
      s: this.tryGetXY(pos.x, pos.y + 1) ?? defaultValue,
      e: this.tryGetXY(pos.x + 1, pos.y) ?? defaultValue,
      w: this.tryGetXY(pos.x - 1, pos.y) ?? defaultValue,
      ne: this.tryGetXY(pos.x + 1, pos.y - 1) ?? defaultValue,
      nw: this.tryGetXY(pos.x - 1, pos.y - 1) ?? defaultValue,
      se: this.tryGetXY(pos.x + 1, pos.y + 1) ?? defaultValue,
      sw: this.tryGetXY(pos.x - 1, pos.y + 1) ?? defaultValue,
    };
  }

  /**
   * Iterate over all cells
   */
  forEach(callback: (value: T, pos: GridPosition) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        callback(this.data[this.toIndex(x, y)]!, { x, y });
      }
    }
  }

  /**
   * Iterate over cells within bounds
   */
  forEachInBounds(bounds: Bounds, callback: (value: T, pos: GridPosition) => void): void {
    const minX = Math.max(0, Math.floor(bounds.minX));
    const maxX = Math.min(this.width - 1, Math.ceil(bounds.maxX));
    const minY = Math.max(0, Math.floor(bounds.minY));
    const maxY = Math.min(this.height - 1, Math.ceil(bounds.maxY));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        callback(this.data[this.toIndex(x, y)]!, { x, y });
      }
    }
  }

  /**
   * Map grid to new grid with transformed values
   */
  map<U>(callback: (value: T, pos: GridPosition) => U): Grid<U> {
    const newGrid = new Grid<U>(this.width, this.height, () => null as unknown as U);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = this.toIndex(x, y);
        newGrid.data[idx] = callback(this.data[idx]!, { x, y });
      }
    }

    return newGrid;
  }

  /**
   * Find all cells matching a predicate
   */
  findAll(predicate: (value: T, pos: GridPosition) => boolean): GridPosition[] {
    const results: GridPosition[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (predicate(this.data[this.toIndex(x, y)]!, { x, y })) {
          results.push({ x, y });
        }
      }
    }

    return results;
  }

  /**
   * Fill a rectangular area with a value
   */
  fillRect(minX: number, minY: number, maxX: number, maxY: number, value: T): void {
    const clampedMinX = Math.max(0, minX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxX = Math.min(this.width - 1, maxX);
    const clampedMaxY = Math.min(this.height - 1, maxY);

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        this.data[this.toIndex(x, y)] = value;
      }
    }
  }

  /**
   * Fill a rectangular area using a factory function
   */
  fillRectWith(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    factory: (pos: GridPosition) => T
  ): void {
    const clampedMinX = Math.max(0, minX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxX = Math.min(this.width - 1, maxX);
    const clampedMaxY = Math.min(this.height - 1, maxY);

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        this.data[this.toIndex(x, y)] = factory({ x, y });
      }
    }
  }

  /**
   * Clone the grid
   */
  clone(cloneValue: (value: T) => T = (v) => v): Grid<T> {
    const newGrid = new Grid<T>(this.width, this.height, () => null as unknown as T);
    
    for (let i = 0; i < this.data.length; i++) {
      newGrid.data[i] = cloneValue(this.data[i]!);
    }

    return newGrid;
  }

  /**
   * Get raw data array (for serialization)
   */
  toArray2D(): T[][] {
    const result: T[][] = [];
    for (let y = 0; y < this.height; y++) {
      result[y] = [];
      for (let x = 0; x < this.width; x++) {
        result[y]![x] = this.data[this.toIndex(x, y)]!;
      }
    }
    return result;
  }

  /**
   * Create grid from raw data array
   */
  static fromArray2D<T>(data: T[][]): Grid<T> {
    const height = data.length;
    const width = data[0]?.length ?? 0;
    
    const grid = new Grid<T>(width, height, () => null as unknown as T);
    
    for (let y = 0; y < height; y++) {
      const row = data[y];
      if (row) {
        for (let x = 0; x < width; x++) {
          if (row[x] !== undefined) {
            grid.data[grid.toIndex(x, y)] = row[x]!;
          }
        }
      }
    }

    return grid;
  }
}

/**
 * Create a position key string for use in Maps/Sets
 */
export function posKey(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Parse a position key string back to GridPosition
 */
export function parseKey(key: string): GridPosition {
  const parts = key.split(',');
  const x = parseInt(parts[0] ?? '0', 10);
  const y = parseInt(parts[1] ?? '0', 10);
  return { x, y };
}

/**
 * Calculate Manhattan distance between two positions
 */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate Euclidean distance between two positions
 */
export function euclideanDistance(a: GridPosition, b: GridPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get all positions in a rectangle
 */
export function getRectPositions(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): GridPosition[] {
  const positions: GridPosition[] = [];
  
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      positions.push({ x, y });
    }
  }

  return positions;
}

/**
 * Get all positions in a circle (approximate)
 */
export function getCirclePositions(
  center: GridPosition,
  radius: number
): GridPosition[] {
  const positions: GridPosition[] = [];
  const radiusSq = radius * radius;

  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= radiusSq) {
        positions.push({ x, y });
      }
    }
  }

  return positions;
}
