/**
 * Core Type Definitions for SimCity Clone
 */

// ============================================================================
// Entity-Component-System Types
// ============================================================================

/** Unique identifier for entities */
export type EntityId = number;

/** Base component interface */
export interface Component {
  type: string;
}

/** Position component for grid-based entities */
export interface PositionComponent extends Component {
  type: 'position';
  x: number;
  y: number;
  z: number; // Elevation
}

/** Renderable component for visual entities */
export interface RenderableComponent extends Component {
  type: 'renderable';
  spriteId: string;
  layer: RenderLayer;
  visible: boolean;
  alpha: number;
  tint: number;
}

/** Zone component for zoned areas */
export interface ZoneComponent extends Component {
  type: 'zone';
  category: ZoneCategory;
  density: ZoneDensity;
  developed: boolean;
  lotId: string | null;
}

/** Building component for developed structures */
export interface BuildingComponent extends Component {
  type: 'building';
  buildingType: string;
  stage: number; // 1, 2, or 3
  style: string;
  condition: BuildingCondition;
  population: number;
  jobs: number;
  /** Current infrastructure status */
  status: BuildingStatus;
  /** Current infrastructure issues */
  infrastructureIssues: InfrastructureIssues;
  /** Timestamp when infrastructure was lost (for grace period) */
  infrastructureLostAt: number | null;
  /** Whether this building is contributing to city stats */
  isContributing: boolean;
}

/** Terrain component for terrain cells */
export interface TerrainComponent extends Component {
  type: 'terrain';
  elevation: number;
  surfaceType: SurfaceType;
  waterDepth: number;
  moisture: number;
  treeCount: number;
  slope: SlopeType;
}

/** Road component for transportation */
export interface RoadComponent extends Component {
  type: 'road';
  roadType: RoadType;
  connections: RoadConnections;
}

// ============================================================================
// Grid Types
// ============================================================================

/** 2D grid position */
export interface GridPosition {
  x: number;
  y: number;
}

/** 3D world position */
export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

/** Screen position in pixels */
export interface ScreenPosition {
  x: number;
  y: number;
}

/** Bounds for a rectangular area */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ============================================================================
// Terrain Types
// ============================================================================

/** Surface types for terrain */
export type SurfaceType = 
  | 'grass'
  | 'dirt'
  | 'rock'
  | 'sand'
  | 'snow'
  | 'mud'
  | 'underwater';

/** Slope types for terrain tiles */
export type SlopeType =
  | 'flat'
  | 'slope_n'
  | 'slope_s'
  | 'slope_e'
  | 'slope_w'
  | 'corner_ne'
  | 'corner_nw'
  | 'corner_se'
  | 'corner_sw'
  | 'corner_inv_ne'
  | 'corner_inv_nw'
  | 'corner_inv_se'
  | 'corner_inv_sw'
  | 'cliff_n'
  | 'cliff_s'
  | 'cliff_e'
  | 'cliff_w';

/** Terrain cell data */
export interface TerrainCell {
  elevation: number;
  surfaceType: SurfaceType;
  waterDepth: number;
  moisture: number;
  treeCount: number;
  slope: SlopeType;
}

/** Neighbor elevations for slope calculation */
export interface NeighborElevations {
  n: number;
  s: number;
  e: number;
  w: number;
  ne: number;
  nw: number;
  se: number;
  sw: number;
}

// ============================================================================
// Zone Types
// ============================================================================

/** Zone categories */
export type ZoneCategory = 'residential' | 'commercial' | 'industrial';

/** Zone density levels */
export type ZoneDensity = 'low' | 'medium' | 'high';

/** Industrial sub-types */
export type IndustrialType = 'agriculture' | 'dirty' | 'manufacturing' | 'high-tech';

/** Zone type definition */
export interface ZoneType {
  category: ZoneCategory;
  density: ZoneDensity;
  color: number;
  maxBuildingHeight: number;
  minLotSize: number;
  maxLotSize: number;
}

/** Zone cell data */
export interface ZoneCell {
  position: GridPosition;
  zoneType: ZoneType | null;
  developed: boolean;
  buildingId: EntityId | null;
  lotId: string | null;
  desirability: number;
  landValue: number;
  roadAccess: boolean;
  utilities: {
    power: boolean;
    water: boolean;
  };
}

/** Lot definition */
export interface Lot {
  id: string;
  cells: GridPosition[];
  zoneType: ZoneType;
  size: { width: number; depth: number };
  orientation: 'north' | 'south' | 'east' | 'west';
  frontage: GridPosition[];
  buildingId: EntityId | null;
  developmentStage: number;
}

// ============================================================================
// Building Types
// ============================================================================

/** Building condition states */
export type BuildingCondition = 'under_construction' | 'normal' | 'abandoned';

/** Building infrastructure status */
export type BuildingStatus = 'functional' | 'non_functional' | 'abandoned';

/** Infrastructure issues for a building */
export interface InfrastructureIssues {
  noRoadAccess: boolean;
  noPower: boolean;
}

/** Building footprint */
export interface BuildingFootprint {
  width: number;
  depth: number;
}

// ============================================================================
// Road Types
// ============================================================================

/** Road type variants */
export type RoadType = 'street' | 'road' | 'avenue' | 'highway' | 'oneway';

/** Road connection flags */
export interface RoadConnections {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

// ============================================================================
// Power Types
// ============================================================================

/** Power plant type variants */
export type PowerPlantType = 'coal' | 'gas' | 'nuclear' | 'wind' | 'solar';

/** Power line connection flags */
export interface PowerConnections {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

/** Power cell data */
export interface PowerCell {
  position: GridPosition;
  hasPowerLine: boolean;
  hasPowerPlant: boolean;
  powerPlantType: PowerPlantType | null;
  powered: boolean;
  connections: PowerConnections;
}

/** Power plant definition */
export interface PowerPlant {
  id: string;
  type: PowerPlantType;
  position: GridPosition;
  capacity: number;      // MW
  currentOutput: number; // MW
  efficiency: number;    // 0-1
  maintenanceCost: number; // per month
}

// ============================================================================
// Rendering Types
// ============================================================================

/** Render layers (back to front order) */
export type RenderLayer =
  | 'terrain'
  | 'water'
  | 'zones'
  | 'underground'
  | 'roads'
  | 'buildings'
  | 'vehicles'
  | 'effects'
  | 'overlay'
  | 'ui';

/** Render layer order */
export const RENDER_LAYER_ORDER: RenderLayer[] = [
  'terrain',
  'water',
  'zones',
  'underground',
  'roads',
  'buildings',
  'vehicles',
  'effects',
  'overlay',
  'ui',
];

/** Renderable entity for sorting */
export interface RenderEntity {
  entityId: EntityId;
  layer: RenderLayer;
  worldX: number;
  worldY: number;
  worldZ: number;
  sortOffset: number;
}

// ============================================================================
// Simulation Types
// ============================================================================

/** Simulation speed settings */
export type SimulationSpeed = 'paused' | 'slow' | 'normal' | 'fast';

/** Speed multipliers */
export const SPEED_MULTIPLIERS: Record<SimulationSpeed, number> = {
  paused: 0,
  slow: 0.5,
  normal: 1,
  fast: 4,
};

/** RCI Demand state */
export interface DemandState {
  residential: {
    low: number;
    medium: number;
    high: number;
  };
  commercial: {
    low: number;
    medium: number;
    high: number;
  };
  industrial: {
    agriculture: number;
    dirty: number;
    manufacturing: number;
    highTech: number;
  };
}

// ============================================================================
// Game State Types
// ============================================================================

/** City statistics */
export interface CityStats {
  name: string;
  population: number;
  funds: number;
  date: GameDate;
}

/** Game date */
export interface GameDate {
  year: number;
  month: number;
  day: number;
}

/** Camera state */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

// ============================================================================
// Event Types
// ============================================================================

/** Base game event */
export interface GameEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

/** Zone created event */
export interface ZoneCreatedEvent extends GameEvent {
  type: 'zone:created';
  data: {
    entityId: EntityId;
    position: GridPosition;
    zoneType: ZoneType;
  };
}

/** Building developed event */
export interface BuildingDevelopedEvent extends GameEvent {
  type: 'building:developed';
  data: {
    entityId: EntityId;
    buildingType: string;
    population: number;
    jobs: number;
  };
}

/** Demand updated event */
export interface DemandUpdatedEvent extends GameEvent {
  type: 'demand:updated';
  data: DemandState;
}

/** Terrain generated event */
export interface TerrainGeneratedEvent extends GameEvent {
  type: 'terrain:generated';
  data: {
    width: number;
    height: number;
  };
}

/** Camera moved event */
export interface CameraMoveEvent extends GameEvent {
  type: 'camera:moved';
  data: CameraState;
}

/** Tool selected event */
export interface ToolSelectedEvent extends GameEvent {
  type: 'tool:selected';
  data: {
    tool: string;
    options?: Record<string, unknown>;
  };
}

/** Tile clicked event */
export interface TileClickedEvent extends GameEvent {
  type: 'tile:clicked';
  data: {
    position: GridPosition;
    button: 'left' | 'right' | 'middle';
    modifiers: {
      shift: boolean;
      ctrl: boolean;
      alt: boolean;
    };
  };
}
