/**
 * Game Constants and Configuration
 */

import type { ZoneType, ZoneDensity, ZoneCategory } from './types';

// ============================================================================
// Tile Dimensions (Isometric 2:1)
// ============================================================================

/** Width of a tile in pixels */
export const TILE_WIDTH = 64;

/** Height of a tile in pixels */
export const TILE_HEIGHT = 32;

/** Height per elevation level in pixels */
export const TILE_DEPTH = 16;

/** Half tile width for calculations */
export const HALF_TILE_WIDTH = TILE_WIDTH / 2;

/** Half tile height for calculations */
export const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;

// ============================================================================
// Map Configuration
// ============================================================================

/** Available map sizes */
export const MAP_SIZES = {
  small: 64,
  medium: 128,
  large: 256,
} as const;

/** Default map size */
export const DEFAULT_MAP_SIZE = MAP_SIZES.small;

/** Chunk size for chunked rendering */
export const CHUNK_SIZE = 32;

/** Maximum loaded chunks for memory management */
export const MAX_LOADED_CHUNKS = 64;

// ============================================================================
// Camera Configuration
// ============================================================================

/** Minimum zoom level */
export const MIN_ZOOM = 0.25;

/** Maximum zoom level */
export const MAX_ZOOM = 4.0;

/** Default zoom level */
export const DEFAULT_ZOOM = 1.0;

/** Zoom step per scroll */
export const ZOOM_STEP = 0.1;

/** Camera pan smoothing factor */
export const CAMERA_SMOOTHING = 0.15;

/** Edge pan threshold in pixels */
export const EDGE_PAN_THRESHOLD = 50;

/** Edge pan speed */
export const EDGE_PAN_SPEED = 10;

// ============================================================================
// Simulation Configuration
// ============================================================================

/** Simulation tick interval in milliseconds */
export const SIMULATION_TICK_MS = 100;

/** Maximum delta time to prevent spiral of death */
export const MAX_DELTA_TIME = 100;

/** Target frames per second */
export const TARGET_FPS = 60;

// ============================================================================
// Terrain Configuration
// ============================================================================

/** Sea level elevation */
export const SEA_LEVEL = 250;

/** Maximum elevation */
export const MAX_ELEVATION = 1000;

/** Tree line elevation (trees don't grow above this) */
export const TREE_LINE_ELEVATION = 600;

/** Maximum buildable slope in degrees */
export const MAX_BUILDABLE_SLOPE = 45;

/** Auto-level threshold for construction */
export const AUTO_LEVEL_THRESHOLD = 8;

/** Terrain generation configuration */
export const TERRAIN_GENERATION = {
  baseFrequency: 0.02,
  octaves: 6,
  persistence: 0.5,
  lacunarity: 2.0,
  heightRange: 200,
  baseHeight: SEA_LEVEL,
  moistureFrequency: 0.03,
  treeFrequency: 0.1,
  riverCount: 2,
} as const;

// ============================================================================
// Zone Configuration
// ============================================================================

/** Zone colors by category and density */
export const ZONE_COLORS: Record<ZoneCategory, Record<ZoneDensity, number>> = {
  residential: {
    low: 0x90ee90,    // Light green
    medium: 0x228b22, // Forest green
    high: 0x006400,   // Dark green
  },
  commercial: {
    low: 0xadd8e6,    // Light blue
    medium: 0x4169e1, // Royal blue
    high: 0x00008b,   // Dark blue
  },
  industrial: {
    low: 0xffffe0,    // Light yellow
    medium: 0xffd700, // Gold
    high: 0xdaa520,   // Goldenrod
  },
};

/** Zone types configuration */
export const ZONE_TYPES: Record<string, ZoneType> = {
  'r-low': {
    category: 'residential',
    density: 'low',
    color: ZONE_COLORS.residential.low,
    maxBuildingHeight: 2,
    minLotSize: 1,
    maxLotSize: 9,
  },
  'r-medium': {
    category: 'residential',
    density: 'medium',
    color: ZONE_COLORS.residential.medium,
    maxBuildingHeight: 6,
    minLotSize: 4,
    maxLotSize: 16,
  },
  'r-high': {
    category: 'residential',
    density: 'high',
    color: ZONE_COLORS.residential.high,
    maxBuildingHeight: 20,
    minLotSize: 9,
    maxLotSize: 36,
  },
  'c-low': {
    category: 'commercial',
    density: 'low',
    color: ZONE_COLORS.commercial.low,
    maxBuildingHeight: 2,
    minLotSize: 1,
    maxLotSize: 6,
  },
  'c-medium': {
    category: 'commercial',
    density: 'medium',
    color: ZONE_COLORS.commercial.medium,
    maxBuildingHeight: 8,
    minLotSize: 4,
    maxLotSize: 16,
  },
  'c-high': {
    category: 'commercial',
    density: 'high',
    color: ZONE_COLORS.commercial.high,
    maxBuildingHeight: 50,
    minLotSize: 9,
    maxLotSize: 36,
  },
  'i-low': {
    category: 'industrial',
    density: 'low',
    color: ZONE_COLORS.industrial.low,
    maxBuildingHeight: 1,
    minLotSize: 16,
    maxLotSize: 64,
  },
  'i-medium': {
    category: 'industrial',
    density: 'medium',
    color: ZONE_COLORS.industrial.medium,
    maxBuildingHeight: 3,
    minLotSize: 9,
    maxLotSize: 36,
  },
  'i-high': {
    category: 'industrial',
    density: 'high',
    color: ZONE_COLORS.industrial.high,
    maxBuildingHeight: 4,
    minLotSize: 16,
    maxLotSize: 36,
  },
};

/** Maximum distance from road for zone development */
export const MAX_ROAD_DISTANCE = 4;

/** Zone cost per tile by density */
export const ZONE_COSTS: Record<ZoneDensity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

// ============================================================================
// RCI Demand Configuration
// ============================================================================

/** Minimum demand value */
export const DEMAND_MIN = -5000;

/** Maximum demand value */
export const DEMAND_MAX = 5000;

/** Demand update interval in game time (ms) */
export const DEMAND_UPDATE_INTERVAL = 10000;

/** Demand transition smoothing rate */
export const DEMAND_TRANSITION_RATE = 0.1;

// ============================================================================
// Color Palette
// ============================================================================

/** UI Colors */
export const UI_COLORS = {
  background: {
    dark: 0x1a1a2e,
    panel: 0x16213e,
    accent: 0x0f3460,
  },
  text: {
    primary: 0xffffff,
    secondary: 0xa0a0a0,
    highlight: 0xe94560,
  },
  buttons: {
    normal: 0x0f3460,
    hover: 0x1a4a7a,
    active: 0xe94560,
    disabled: 0x404040,
  },
};

/** Terrain colors */
export const TERRAIN_COLORS = {
  grass: {
    light: 0x7cba5f,
    medium: 0x5a9a3d,
    dark: 0x3d7a27,
  },
  dirt: {
    light: 0xc4a87c,
    medium: 0xa68b5b,
    dark: 0x8b7355,
  },
  rock: {
    light: 0x9e9e9e,
    medium: 0x757575,
    dark: 0x616161,
  },
  sand: {
    light: 0xf4e4bc,
    medium: 0xe8d4a2,
    dark: 0xd4c088,
  },
  water: {
    shallow: 0x5dade2,
    medium: 0x3498db,
    deep: 0x1a5276,
  },
};

/** Building colors by wealth */
export const BUILDING_COLORS = {
  low: {
    roof: 0xa67c52,
    walls: 0xd4c4b4,
    accent: 0x8b7355,
  },
  medium: {
    roof: 0x708090,
    walls: 0xf5f5f5,
    accent: 0x4682b4,
  },
  high: {
    roof: 0x2f4f4f,
    walls: 0xffffff,
    accent: 0xb8860b,
  },
};

// ============================================================================
// Development Configuration
// ============================================================================

/** Minimum demand for development */
export const MIN_DEVELOPMENT_DEMAND = 100;

/** Fast development demand threshold */
export const FAST_DEVELOPMENT_DEMAND = 2000;

/** Base development chance per tick */
export const BASE_DEVELOPMENT_CHANCE = 0.1;

/** Base abandonment chance */
export const BASE_ABANDONMENT_CHANCE = 0.05;

/** Abandonment demand threshold */
export const ABANDONMENT_DEMAND_THRESHOLD = -500;

// ============================================================================
// Debug Configuration
// ============================================================================

/** Show FPS counter */
export const SHOW_FPS = true;

/** Show grid overlay */
export const SHOW_GRID = false;

/** Show chunk borders */
export const SHOW_CHUNK_BORDERS = false;

/** Show coordinate labels */
export const SHOW_COORDINATES = false;
