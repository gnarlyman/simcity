/**
 * Renderer
 * 
 * PixiJS wrapper that handles rendering layers, sprites, and graphics.
 * Manages the render loop integration with the game engine.
 */

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { RenderLayer, Bounds, GridPosition, TerrainCell } from '../data/types';
import { RENDER_LAYER_ORDER } from '../data/types';
import { TERRAIN_COLORS, UI_COLORS } from '../data/constants';
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
  
  /** Debug text */
  private debugText: Text | null = null;
  
  /** Show grid overlay */
  private showGrid = false;
  
  /** Show debug info */
  private showDebug = true;

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
