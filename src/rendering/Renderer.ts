/**
 * Renderer
 * 
 * PixiJS wrapper that handles rendering layers, sprites, and graphics.
 * Manages the render loop integration with the game engine.
 */

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RenderLayer, Bounds, GridPosition, TerrainCell, ZoneCell, RoadConnections } from '../data/types';
import { RENDER_LAYER_ORDER } from '../data/types';
import { TERRAIN_COLORS, UI_COLORS, ZONE_COLORS } from '../data/constants';
import { TILE_WIDTH, TILE_HEIGHT, HALF_TILE_WIDTH, HALF_TILE_HEIGHT, TILE_DEPTH } from '../data/constants';
import { IsometricCamera } from './IsometricCamera';
import { Grid } from '../data/Grid';

/**
 * Renderer configuration
 */
export interface RendererConfig {
  backgroundColor: number;
  antialias: boolean;
  resolution: number;
}

/**
 * Main Renderer class
 */
export class Renderer {
  /** PixiJS Application */
  private app: Application;
  
  /** Render layers */
  private layers: Map<RenderLayer, Container> = new Map();
  
  /** Main stage container (moves with camera) */
  private worldContainer: Container;
  
  /** UI container (fixed position) */
  private uiContainer: Container;
  
  /** Isometric camera */
  private camera: IsometricCamera;
  
  /** Canvas element */
  private canvas: HTMLCanvasElement;
  
  /** Is initialized */
  private initialized = false;
  
  /** Terrain graphics cache */
  private terrainGraphics: Graphics | null = null;
  
  /** Grid overlay graphics */
  private gridOverlay: Graphics | null = null;
  
  /** Zone overlay graphics */
  private zoneOverlay: Graphics | null = null;
  
  /** Building graphics */
  private buildingGraphics: Graphics | null = null;
  
  /** Road graphics */
  private roadGraphics: Graphics | null = null;
  
  /** Debug text */
  private debugText: Text | null = null;
  
  /** Show grid overlay */
  private showGrid = false;
  
  /** Show zone overlay */
  private showZones = true;
  
  /** Show debug info */
  private showDebug = true;
  
  /** Hover highlight graphics */
  private hoverHighlight: Graphics | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.app = new Application();
    this.worldContainer = new Container();
    this.uiContainer = new Container();
    this.camera = new IsometricCamera();
  }

  /**
   * Initialize the renderer
   */
  async init(config?: Partial<RendererConfig>): Promise<void> {
    if (this.initialized) return;

    const defaultConfig: RendererConfig = {
      backgroundColor: UI_COLORS.background.dark,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    };

    const finalConfig = { ...defaultConfig, ...config };

    await this.app.init({
      canvas: this.canvas,
      background: finalConfig.backgroundColor,
      resizeTo: window,
      antialias: finalConfig.antialias,
      resolution: finalConfig.resolution,
      autoDensity: true,
    });

    // Set up containers
    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);

    // Create render layers
    this.initLayers();

    // Set up camera viewport
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);

    // Create debug text
    this.createDebugText();

    this.initialized = true;
    console.log('Renderer initialized:', this.app.screen.width, 'x', this.app.screen.height);
  }

  /**
   * Initialize render layers
   */
  private initLayers(): void {
    for (const layerName of RENDER_LAYER_ORDER) {
      const container = new Container();
      container.label = layerName;
      this.worldContainer.addChild(container);
      this.layers.set(layerName, container);
    }
  }

  /**
   * Get a render layer
   */
  getLayer(name: RenderLayer): Container {
    const layer = this.layers.get(name);
    if (!layer) {
      throw new Error(`Layer not found: ${name}`);
    }
    return layer;
  }

  /**
   * Get the camera
   */
  getCamera(): IsometricCamera {
    return this.camera;
  }

  /**
   * Get the PixiJS application
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Create debug text display
   */
  private createDebugText(): void {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 2 },
    });

    this.debugText = new Text({ text: '', style });
    this.debugText.x = 10;
    this.debugText.y = 10;
    this.uiContainer.addChild(this.debugText);
  }

  /**
   * Update debug text
   */
  updateDebugText(info: Record<string, string | number>): void {
    if (!this.debugText || !this.showDebug) return;

    const lines = Object.entries(info).map(([key, value]) => `${key}: ${value}`);
    this.debugText.text = lines.join('\n');
  }

  /**
   * Toggle debug display
   */
  setShowDebug(show: boolean): void {
    this.showDebug = show;
    if (this.debugText) {
      this.debugText.visible = show;
    }
  }

  /**
   * Toggle grid overlay
   */
  setShowGrid(show: boolean): void {
    this.showGrid = show;
    if (this.gridOverlay) {
      this.gridOverlay.visible = show;
    }
  }

  /**
   * Toggle zone overlay
   */
  setShowZones(show: boolean): void {
    this.showZones = show;
    if (this.zoneOverlay) {
      this.zoneOverlay.visible = show;
    }
  }

  /**
   * Check if zones are visible
   */
  isShowingZones(): boolean {
    return this.showZones;
  }

  /**
   * Render terrain from a terrain grid
   */
  renderTerrain(terrainGrid: Grid<TerrainCell>): void {
    const terrainLayer = this.getLayer('terrain');

    // Clear existing terrain
    if (this.terrainGraphics) {
      terrainLayer.removeChild(this.terrainGraphics);
      this.terrainGraphics.destroy();
    }

    this.terrainGraphics = new Graphics();
    terrainLayer.addChild(this.terrainGraphics);

    // Clear existing grid overlay
    const overlayLayer = this.getLayer('overlay');
    if (this.gridOverlay) {
      overlayLayer.removeChild(this.gridOverlay);
      this.gridOverlay.destroy();
    }

    this.gridOverlay = new Graphics();
    this.gridOverlay.visible = this.showGrid;
    overlayLayer.addChild(this.gridOverlay);

    // Render all tiles
    const width = terrainGrid.width;
    const height = terrainGrid.height;

    // Render in isometric order (back to front)
    for (let sum = 0; sum < width + height - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x < width && y < height) {
          const cell = terrainGrid.getXY(x, y);
          this.renderTerrainTile(x, y, cell);
        }
      }
    }

    // Center camera on map
    this.camera.centerOn(width / 2, height / 2, true);
    this.camera.setWorldBounds(-2, -2, width + 2, height + 2);
  }

  /**
   * Render a single terrain tile
   */
  private renderTerrainTile(worldX: number, worldY: number, cell: TerrainCell): void {
    if (!this.terrainGraphics || !this.gridOverlay) return;

    // Calculate screen position (relative to world container)
    const isoX = (worldX - worldY) * HALF_TILE_WIDTH;
    const isoY = (worldX + worldY) * HALF_TILE_HEIGHT;

    // Adjust for elevation
    const elevationOffset = (cell.elevation - 250) / 50 * TILE_DEPTH;

    // Determine tile color based on surface type and elevation
    let color = this.getTerrainColor(cell);

    // Add water check
    if (cell.waterDepth > 0) {
      color = this.getWaterColor(cell.waterDepth);
    }

    // Draw the isometric tile
    this.terrainGraphics.poly([
      isoX, isoY - HALF_TILE_HEIGHT - elevationOffset,  // Top
      isoX + HALF_TILE_WIDTH, isoY - elevationOffset,    // Right
      isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,   // Bottom
      isoX - HALF_TILE_WIDTH, isoY - elevationOffset,    // Left
    ]);
    this.terrainGraphics.fill(color);
    this.terrainGraphics.stroke({ color: this.darkenColor(color, 0.2), width: 1 });

    // Draw elevation sides if needed
    if (elevationOffset > 0) {
      const sideColor = this.darkenColor(color, 0.4);
      
      // Left side
      this.terrainGraphics.poly([
        isoX - HALF_TILE_WIDTH, isoY - elevationOffset,
        isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
        isoX, isoY + HALF_TILE_HEIGHT,
        isoX - HALF_TILE_WIDTH, isoY,
      ]);
      this.terrainGraphics.fill(sideColor);
      
      // Right side
      this.terrainGraphics.poly([
        isoX + HALF_TILE_WIDTH, isoY - elevationOffset,
        isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
        isoX, isoY + HALF_TILE_HEIGHT,
        isoX + HALF_TILE_WIDTH, isoY,
      ]);
      this.terrainGraphics.fill(this.darkenColor(color, 0.3));
    }

    // Draw grid overlay
    this.gridOverlay.poly([
      isoX, isoY - HALF_TILE_HEIGHT - elevationOffset,
      isoX + HALF_TILE_WIDTH, isoY - elevationOffset,
      isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
      isoX - HALF_TILE_WIDTH, isoY - elevationOffset,
    ]);
    this.gridOverlay.stroke({ color: 0x888888, width: 1, alpha: 0.5 });

    // Draw trees if present
    if (cell.treeCount > 0 && cell.waterDepth === 0) {
      this.renderTrees(isoX, isoY - elevationOffset, cell.treeCount);
    }
  }

  /**
   * Render zone overlay
   */
  renderZones(zoneGrid: Grid<ZoneCell>, terrainGrid: Grid<TerrainCell>): void {
    const zonesLayer = this.getLayer('zones');

    // Clear existing zone overlay
    if (this.zoneOverlay) {
      zonesLayer.removeChild(this.zoneOverlay);
      this.zoneOverlay.destroy();
    }

    this.zoneOverlay = new Graphics();
    this.zoneOverlay.visible = this.showZones;
    zonesLayer.addChild(this.zoneOverlay);

    const width = zoneGrid.width;
    const height = zoneGrid.height;

    // Render in isometric order (back to front)
    for (let sum = 0; sum < width + height - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x < width && y < height) {
          const zoneCell = zoneGrid.getXY(x, y);
          if (zoneCell.zoneType) {
            const terrainCell = terrainGrid.tryGetXY(x, y);
            this.renderZoneTile(x, y, zoneCell, terrainCell);
          }
        }
      }
    }
  }

  /**
   * Render a single zone tile
   */
  private renderZoneTile(
    worldX: number,
    worldY: number,
    zoneCell: ZoneCell,
    terrainCell: TerrainCell | undefined
  ): void {
    if (!this.zoneOverlay || !zoneCell.zoneType) return;

    // Calculate screen position
    const isoX = (worldX - worldY) * HALF_TILE_WIDTH;
    const isoY = (worldX + worldY) * HALF_TILE_HEIGHT;

    // Adjust for elevation
    const elevation = terrainCell?.elevation ?? 250;
    const elevationOffset = (elevation - 250) / 50 * TILE_DEPTH;

    // Get zone color
    const color = zoneCell.zoneType.color;
    const alpha = zoneCell.developed ? 0.3 : 0.5;

    // Draw zone overlay
    this.zoneOverlay.poly([
      isoX, isoY - HALF_TILE_HEIGHT - elevationOffset,
      isoX + HALF_TILE_WIDTH, isoY - elevationOffset,
      isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
      isoX - HALF_TILE_WIDTH, isoY - elevationOffset,
    ]);
    this.zoneOverlay.fill({ color, alpha });
    this.zoneOverlay.stroke({ color: this.darkenColor(color, 0.3), width: 1, alpha: 0.8 });

    // If developed, draw a simple building indicator
    if (zoneCell.developed) {
      this.renderSimpleBuilding(isoX, isoY - elevationOffset, zoneCell);
    }
  }

  /**
   * Render a simple building representation
   */
  private renderSimpleBuilding(isoX: number, isoY: number, zoneCell: ZoneCell): void {
    if (!this.zoneOverlay || !zoneCell.zoneType) return;

    const category = zoneCell.zoneType.category;
    const density = zoneCell.zoneType.density;

    // Building height based on density
    const heightMultiplier = density === 'low' ? 1 : density === 'medium' ? 2 : 3;
    const buildingHeight = 8 * heightMultiplier;

    // Building colors based on category
    let roofColor: number;
    let wallColor: number;

    switch (category) {
      case 'residential':
        roofColor = 0xa52a2a; // Brown roof
        wallColor = 0xf5f5dc; // Beige walls
        break;
      case 'commercial':
        roofColor = 0x4169e1; // Blue roof
        wallColor = 0xe0e0e0; // Gray walls
        break;
      case 'industrial':
        roofColor = 0x808080; // Gray roof
        wallColor = 0xd2b48c; // Tan walls
        break;
      default:
        roofColor = 0x808080;
        wallColor = 0xc0c0c0;
    }

    const halfWidth = HALF_TILE_WIDTH * 0.6;
    const halfHeight = HALF_TILE_HEIGHT * 0.6;

    // Draw building base (left side)
    this.zoneOverlay.poly([
      isoX - halfWidth, isoY,
      isoX, isoY + halfHeight,
      isoX, isoY + halfHeight - buildingHeight,
      isoX - halfWidth, isoY - buildingHeight,
    ]);
    this.zoneOverlay.fill(this.darkenColor(wallColor, 0.2));

    // Draw building base (right side)
    this.zoneOverlay.poly([
      isoX + halfWidth, isoY,
      isoX, isoY + halfHeight,
      isoX, isoY + halfHeight - buildingHeight,
      isoX + halfWidth, isoY - buildingHeight,
    ]);
    this.zoneOverlay.fill(wallColor);

    // Draw roof
    this.zoneOverlay.poly([
      isoX, isoY - halfHeight - buildingHeight,
      isoX + halfWidth, isoY - buildingHeight,
      isoX, isoY + halfHeight - buildingHeight,
      isoX - halfWidth, isoY - buildingHeight,
    ]);
    this.zoneOverlay.fill(roofColor);
  }

  /**
   * Update zone rendering (call when zones change)
   */
  updateZoneOverlay(zoneGrid: Grid<ZoneCell>, terrainGrid: Grid<TerrainCell>): void {
    this.renderZones(zoneGrid, terrainGrid);
  }

  /**
   * Road cell interface (matches RoadSystem)
   */
  private roadCellHasRoad(cell: { hasRoad: boolean }): boolean {
    return cell.hasRoad;
  }

  /**
   * Render roads overlay
   */
  renderRoads(
    roadGrid: Grid<{ position: GridPosition; hasRoad: boolean; connections: RoadConnections }>,
    terrainGrid: Grid<TerrainCell>
  ): void {
    const roadsLayer = this.getLayer('roads');

    // Clear existing road graphics
    if (this.roadGraphics) {
      roadsLayer.removeChild(this.roadGraphics);
      this.roadGraphics.destroy();
    }

    this.roadGraphics = new Graphics();
    roadsLayer.addChild(this.roadGraphics);

    const width = roadGrid.width;
    const height = roadGrid.height;

    // Render in isometric order (back to front)
    for (let sum = 0; sum < width + height - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x < width && y < height) {
          const roadCell = roadGrid.getXY(x, y);
          if (roadCell.hasRoad) {
            const terrainCell = terrainGrid.tryGetXY(x, y);
            this.renderRoadTile(x, y, roadCell, terrainCell);
          }
        }
      }
    }
  }

  /**
   * Render a single road tile
   */
  private renderRoadTile(
    worldX: number,
    worldY: number,
    roadCell: { hasRoad: boolean; connections: RoadConnections },
    terrainCell: TerrainCell | undefined
  ): void {
    if (!this.roadGraphics) return;

    // Calculate screen position
    const isoX = (worldX - worldY) * HALF_TILE_WIDTH;
    const isoY = (worldX + worldY) * HALF_TILE_HEIGHT;

    // Adjust for elevation
    const elevation = terrainCell?.elevation ?? 250;
    const elevationOffset = (elevation - 250) / 50 * TILE_DEPTH;

    const roadColor = 0x555555; // Dark gray
    const lineColor = 0xffff00; // Yellow center line

    // Draw road base (darker)
    this.roadGraphics.poly([
      isoX, isoY - HALF_TILE_HEIGHT - elevationOffset,
      isoX + HALF_TILE_WIDTH, isoY - elevationOffset,
      isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
      isoX - HALF_TILE_WIDTH, isoY - elevationOffset,
    ]);
    this.roadGraphics.fill(roadColor);
    this.roadGraphics.stroke({ color: 0x333333, width: 1 });

    const { north, south, east, west } = roadCell.connections;
    
    // Diamond tile corners for proper isometric alignment
    // North = top vertex, South = bottom vertex, East = right vertex, West = left vertex
    const topX = isoX;
    const topY = isoY - HALF_TILE_HEIGHT - elevationOffset;
    const rightX = isoX + HALF_TILE_WIDTH;
    const rightY = isoY - elevationOffset;
    const bottomX = isoX;
    const bottomY = isoY + HALF_TILE_HEIGHT - elevationOffset;
    const leftX = isoX - HALF_TILE_WIDTH;
    const leftY = isoY - elevationOffset;
    
    // Center of the diamond
    const cx = isoX;
    const cy = isoY - elevationOffset;
    
    // Midpoints of each edge (for road connections)
    // Grid directions map to isometric edges:
    // - North (y-1) connects via NE edge (between top and right vertices)
    // - South (y+1) connects via SW edge (between bottom and left vertices)
    // - East (x+1) connects via SE edge (between right and bottom vertices)
    // - West (x-1) connects via NW edge (between left and top vertices)
    const northMidX = (topX + rightX) / 2;   // NE edge midpoint
    const northMidY = (topY + rightY) / 2;
    const southMidX = (bottomX + leftX) / 2; // SW edge midpoint
    const southMidY = (bottomY + leftY) / 2;
    const eastMidX = (rightX + bottomX) / 2; // SE edge midpoint  
    const eastMidY = (rightY + bottomY) / 2;
    const westMidX = (leftX + topX) / 2;     // NW edge midpoint
    const westMidY = (leftY + topY) / 2;
    
    // Calculate connection count for intersection type
    const connectionCount = [north, south, east, west].filter(Boolean).length;

    // Draw road lane markings based on connection type
    if (connectionCount === 0) {
      // Isolated road - draw a circle in center
      this.roadGraphics.circle(cx, cy, 4);
      this.roadGraphics.fill(lineColor);
    } else if (connectionCount === 2 && ((north && south) || (east && west))) {
      // Straight road - draw continuous line
      if (north && south) {
        // Road runs NW-SE (north to south in grid terms)
        this.drawRoadStripe(northMidX, northMidY, southMidX, southMidY, lineColor);
      } else {
        // Road runs NE-SW (east to west in grid terms)
        this.drawRoadStripe(eastMidX, eastMidY, westMidX, westMidY, lineColor);
      }
    } else {
      // Dead end, corner, T, or 4-way intersection
      // Draw center dot
      this.roadGraphics.circle(cx, cy, 3);
      this.roadGraphics.fill(lineColor);
      
      // Draw stripe from center to each connected edge midpoint
      if (north) {
        this.drawRoadStripe(cx, cy, northMidX, northMidY, lineColor);
      }
      if (south) {
        this.drawRoadStripe(cx, cy, southMidX, southMidY, lineColor);
      }
      if (east) {
        this.drawRoadStripe(cx, cy, eastMidX, eastMidY, lineColor);
      }
      if (west) {
        this.drawRoadStripe(cx, cy, westMidX, westMidY, lineColor);
      }
    }
  }

  /**
   * Draw a road stripe line
   */
  private drawRoadStripe(x1: number, y1: number, x2: number, y2: number, color: number): void {
    if (!this.roadGraphics) return;
    this.roadGraphics.moveTo(x1, y1);
    this.roadGraphics.lineTo(x2, y2);
    this.roadGraphics.stroke({ color, width: 2, alpha: 0.8 });
  }

  /**
   * Update road rendering (call when roads change)
   */
  updateRoadOverlay(
    roadGrid: Grid<{ position: GridPosition; hasRoad: boolean; connections: RoadConnections }>,
    terrainGrid: Grid<TerrainCell>
  ): void {
    this.renderRoads(roadGrid, terrainGrid);
  }

  /**
   * Get terrain color based on surface type
   */
  private getTerrainColor(cell: TerrainCell): number {
    const elevation = cell.elevation;

    switch (cell.surfaceType) {
      case 'grass':
        if (elevation > 350) return TERRAIN_COLORS.grass.dark;
        if (elevation > 300) return TERRAIN_COLORS.grass.medium;
        return TERRAIN_COLORS.grass.light;
      case 'dirt':
        return TERRAIN_COLORS.dirt.medium;
      case 'rock':
        return TERRAIN_COLORS.rock.medium;
      case 'sand':
        return TERRAIN_COLORS.sand.medium;
      case 'snow':
        return 0xffffff;
      default:
        return TERRAIN_COLORS.grass.medium;
    }
  }

  /**
   * Get water color based on depth
   */
  private getWaterColor(depth: number): number {
    if (depth < 5) return TERRAIN_COLORS.water.shallow;
    if (depth < 15) return TERRAIN_COLORS.water.medium;
    return TERRAIN_COLORS.water.deep;
  }

  /**
   * Darken a color by a factor
   */
  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((color & 0xff) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Render trees on a tile
   */
  private renderTrees(isoX: number, isoY: number, count: number): void {
    if (!this.terrainGraphics) return;

    const treeCount = Math.min(count, 3);
    const treeColor = 0x228b22;
    const trunkColor = 0x8b4513;

    for (let i = 0; i < treeCount; i++) {
      // Offset each tree slightly
      const offsetX = (i - 1) * 8 + (Math.random() - 0.5) * 4;
      const offsetY = (Math.random() - 0.5) * 4;
      const treeX = isoX + offsetX;
      const treeY = isoY - 8 + offsetY;
      const treeHeight = 12 + Math.random() * 6;

      // Draw trunk
      this.terrainGraphics.rect(treeX - 1, treeY, 2, 4);
      this.terrainGraphics.fill(trunkColor);

      // Draw foliage (triangle)
      this.terrainGraphics.poly([
        treeX, treeY - treeHeight,
        treeX - 5, treeY,
        treeX + 5, treeY,
      ]);
      this.terrainGraphics.fill(treeColor);
    }
  }

  /**
   * Update the renderer (called each frame)
   */
  update(deltaTime: number): void {
    // Update camera
    this.camera.update(deltaTime);

    // Apply camera transform to world container
    const viewport = this.camera.getViewport();
    const pos = this.camera.getPosition();
    const zoom = this.camera.getZoom();

    this.worldContainer.x = viewport.width / 2 - pos.x * zoom;
    this.worldContainer.y = viewport.height / 2 - pos.y * zoom;
    this.worldContainer.scale.set(zoom);
  }

  /**
   * Highlight a tile at the given grid position
   */
  highlightTile(gridX: number, gridY: number, elevation: number = 0): void {
    const overlayLayer = this.getLayer('overlay');
    
    // Create highlight graphics if needed
    if (!this.hoverHighlight) {
      this.hoverHighlight = new Graphics();
      overlayLayer.addChild(this.hoverHighlight);
    }
    
    this.hoverHighlight.clear();
    
    // Calculate isometric position
    const isoX = (gridX - gridY) * HALF_TILE_WIDTH;
    const isoY = (gridX + gridY) * HALF_TILE_HEIGHT;
    const elevationOffset = (elevation - 250) / 50 * TILE_DEPTH;
    
    // Draw highlight diamond
    this.hoverHighlight.poly([
      isoX, isoY - HALF_TILE_HEIGHT - elevationOffset,
      isoX + HALF_TILE_WIDTH, isoY - elevationOffset,
      isoX, isoY + HALF_TILE_HEIGHT - elevationOffset,
      isoX - HALF_TILE_WIDTH, isoY - elevationOffset,
    ]);
    this.hoverHighlight.fill({ color: 0xffffff, alpha: 0.3 });
    this.hoverHighlight.stroke({ color: 0xffffff, width: 2 });
  }

  /**
   * Clear tile highlight
   */
  clearHighlight(): void {
    if (this.hoverHighlight) {
      this.hoverHighlight.clear();
    }
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
  }

  /**
   * Clear all render layers
   */
  clearLayers(): void {
    for (const layer of this.layers.values()) {
      layer.removeChildren();
    }
    this.terrainGraphics = null;
    this.gridOverlay = null;
    this.zoneOverlay = null;
    this.buildingGraphics = null;
    this.roadGraphics = null;
  }

  /**
   * Get screen dimensions
   */
  getScreenSize(): { width: number; height: number } {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  /**
   * Destroy the renderer
   */
  destroy(): void {
    this.clearLayers();
    this.app.destroy(true, { children: true, texture: true });
    this.initialized = false;
  }
}
