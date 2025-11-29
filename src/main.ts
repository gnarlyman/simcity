/**
 * SimCity Clone - Main Entry Point
 * 
 * Initializes the game engine, systems, renderer, and UI.
 * Integrates terrain, zoning, roads, RCI demand, and building development.
 */

import { Engine, createEngine } from './core/Engine';
import { Renderer } from './rendering/Renderer';
import { TerrainSystem } from './systems/TerrainSystem';
import { ZoneSystem, createZoneSystem } from './systems/ZoneSystem';
import { RoadSystem, createRoadSystem } from './systems/RoadSystem';
import { RCIDemandSystem, createRCIDemandSystem } from './systems/RCIDemandSystem';
import { InputManager } from './input/InputManager';
import { Toolbar, createToolbar } from './ui/Toolbar';
import { EventBus, EventTypes } from './core/EventBus';
import type { GridPosition, TerrainCell, SimulationSpeed } from './data/types';
import { Grid } from './data/Grid';

/**
 * Game class - main application controller
 */
class Game {
  private engine: Engine;
  private renderer: Renderer;
  private terrainSystem: TerrainSystem;
  private zoneSystem: ZoneSystem;
  private roadSystem: RoadSystem;
  private rciDemandSystem: RCIDemandSystem;
  private inputManager: InputManager | null = null;
  private toolbar: Toolbar | null = null;
  private canvas: HTMLCanvasElement;
  
  // Grid references
  private terrainGrid: Grid<TerrainCell> | null = null;
  
  // UI elements
  private loadingElement: HTMLElement | null;
  
  // Zone overlay toggle
  private showZoneOverlay = true;
  
  // Grid toggle state
  private showGridOverlay = false;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }
    
    this.loadingElement = document.getElementById('loading');
    
    // Create core systems
    this.engine = createEngine();
    this.renderer = new Renderer(this.canvas);
    this.terrainSystem = new TerrainSystem();
    this.zoneSystem = createZoneSystem();
    this.roadSystem = createRoadSystem();
    this.rciDemandSystem = createRCIDemandSystem();
    
    // Register systems with engine (order matters for initialization)
    const world = this.engine.getWorld();
    world.addSystem(this.terrainSystem);
    world.addSystem(this.roadSystem);
    world.addSystem(this.zoneSystem);
    world.addSystem(this.rciDemandSystem);
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    console.log('SimCity Clone - Initializing...');
    
    try {
      // Initialize renderer
      await this.renderer.init();
      
      // Set up input handling
      this.inputManager = new InputManager(
        this.canvas,
        this.renderer.getCamera(),
        this.engine.getEventBus()
      );
      
      // Create toolbar UI
      this.toolbar = createToolbar(this.engine.getEventBus());
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Generate initial terrain (64x64 map)
      this.terrainGrid = this.terrainSystem.generate({
        width: 64,
        height: 64,
        seed: Math.random(),
      });
      
      // Initialize grids to match terrain
      this.zoneSystem.initializeGrid(64, 64);
      this.roadSystem.initializeGrid(64, 64);
      
      // Render terrain
      this.renderer.renderTerrain(this.terrainGrid);
      
      // Initial overlays render (empty)
      this.updateZoneOverlay();
      this.updateRoadOverlay();
      
      // Set up render callback
      this.engine.setRenderCallback((deltaTime) => this.render(deltaTime));
      
      // Handle window resize
      window.addEventListener('resize', () => this.handleResize());
      
      // Hide loading indicator
      if (this.loadingElement) {
        this.loadingElement.style.display = 'none';
      }
      
      // Start the engine
      this.engine.start();
      
      console.log('Game initialized successfully!');
      console.log('Controls:');
      console.log('  - WASD/Arrow Keys: Pan camera');
      console.log('  - Mouse Wheel: Zoom');
      console.log('  - Right-click + Drag: Pan camera');
      console.log('  - G: Toggle grid overlay');
      console.log('  - Z: Toggle zone overlay');
      console.log('  - Space: Regenerate terrain');
      console.log('  - R: Road tool');
      console.log('  - 1-9: Select zone tools');
      console.log('  - Q: Query tool');
      console.log('  - B: Bulldoze tool');
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      if (this.loadingElement) {
        this.loadingElement.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.loadingElement.style.color = '#ff4444';
      }
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    const eventBus = this.engine.getEventBus();
    
    // Listen for tile clicks
    eventBus.on(EventTypes.TILE_CLICKED, (event) => {
      const { position, button } = event.data as { position: GridPosition; button: string };
      
      if (button === 'left') {
        const terrainInfo = this.terrainSystem.getTerrainInfo(position.x, position.y);
        const zoneInfo = this.zoneSystem.getZoneCell(position);
        const roadInfo = this.roadSystem.getRoadCell(position);
        
        if (terrainInfo) {
          console.log(`Clicked tile (${position.x}, ${position.y}):`, {
            elevation: Math.round(terrainInfo.elevation),
            surface: terrainInfo.surfaceType,
            water: terrainInfo.waterDepth > 0 ? `depth: ${terrainInfo.waterDepth.toFixed(1)}` : 'none',
            buildable: this.terrainSystem.isBuildable(position.x, position.y),
            road: roadInfo?.hasRoad ? 'yes' : 'no',
            zone: zoneInfo?.zoneType ? `${zoneInfo.zoneType.category} (${zoneInfo.zoneType.density})` : 'none',
            developed: zoneInfo?.developed ?? false,
          });
        }
      }
    });
    
    // Listen for zone changes to update overlay
    eventBus.on(EventTypes.ZONE_CREATED, () => {
      this.updateZoneOverlay();
      // Update road access for zones
      this.zoneSystem.updateRoadAccess(this.roadSystem.getRoadPositions());
    });
    
    eventBus.on(EventTypes.ZONE_DELETED, () => {
      this.updateZoneOverlay();
    });
    
    // Listen for road changes
    eventBus.on('road:created', () => {
      this.updateRoadOverlay();
      // Update road access for all zones when roads change
      this.zoneSystem.updateRoadAccess(this.roadSystem.getRoadPositions());
    });
    
    eventBus.on('road:deleted', () => {
      this.updateRoadOverlay();
      this.zoneSystem.updateRoadAccess(this.roadSystem.getRoadPositions());
    });
    
    // Listen for building development to update overlay
    eventBus.on(EventTypes.BUILDING_DEVELOPED, () => {
      this.updateZoneOverlay();
      
      // Update population display
      if (this.toolbar) {
        this.toolbar.updatePopulation(this.rciDemandSystem.getPopulation());
      }
    });
    
    // Listen for keyboard input
    eventBus.on(EventTypes.INPUT_KEY_DOWN, (event) => {
      const { key } = event.data as { key: string };
      
      // G - Toggle grid
      if (key === 'g') {
        this.showGridOverlay = !this.showGridOverlay;
        this.renderer.setShowGrid(this.showGridOverlay);
        console.log(`Grid overlay ${this.showGridOverlay ? 'shown' : 'hidden'}`);
      }
      
      // Z - Toggle zone overlay
      if (key === 'z') {
        this.showZoneOverlay = !this.showZoneOverlay;
        this.renderer.setShowZones(this.showZoneOverlay);
        console.log(`Zone overlay ${this.showZoneOverlay ? 'shown' : 'hidden'}`);
      }
      
      // Space - Regenerate terrain
      if (key === ' ') {
        this.regenerateTerrain();
      }
      
      // P - Toggle pause
      if (key === 'p') {
        this.engine.togglePause();
        console.log(`Simulation ${this.engine.isPaused() ? 'paused' : 'running'}`);
      }
    });
    
    // Listen for UI toggle zones event
    eventBus.on('ui:toggle_zones', () => {
      this.showZoneOverlay = !this.showZoneOverlay;
      this.renderer.setShowZones(this.showZoneOverlay);
      console.log(`Zone overlay ${this.showZoneOverlay ? 'shown' : 'hidden'}`);
    });
    
    // Listen for simulation speed changes from UI
    eventBus.on('ui:speed_request', (event) => {
      const { speed } = event.data as { speed: SimulationSpeed };
      this.engine.setSpeed(speed);
      console.log(`Simulation speed: ${speed}`);
    });
  }

  /**
   * Update zone overlay rendering
   */
  private updateZoneOverlay(): void {
    const zoneGrid = this.zoneSystem.getZoneGrid();
    if (zoneGrid && this.terrainGrid) {
      this.renderer.updateZoneOverlay(zoneGrid, this.terrainGrid);
    }
  }

  /**
   * Update road overlay rendering
   */
  private updateRoadOverlay(): void {
    const roadGrid = this.roadSystem.getRoadGrid();
    if (roadGrid && this.terrainGrid) {
      this.renderer.updateRoadOverlay(roadGrid, this.terrainGrid);
    }
  }

  /**
   * Regenerate terrain with new seed
   */
  private regenerateTerrain(): void {
    console.log('Regenerating terrain...');
    
    this.terrainGrid = this.terrainSystem.generate({
      width: 64,
      height: 64,
      seed: Math.random(),
    });
    
    // Reset grids
    this.zoneSystem.initializeGrid(64, 64);
    this.roadSystem.initializeGrid(64, 64);
    
    // Re-render
    this.renderer.renderTerrain(this.terrainGrid);
    this.updateZoneOverlay();
    this.updateRoadOverlay();
    
    console.log('Terrain regenerated!');
  }

  /**
   * Render callback
   */
  private render(deltaTime: number): void {
    // Update input
    if (this.inputManager) {
      this.inputManager.update(deltaTime);
    }
    
    // Update renderer
    this.renderer.update(deltaTime);
    
    // Check if zones need re-rendering
    if (this.zoneSystem.isDirty()) {
      this.updateZoneOverlay();
      this.zoneSystem.clearDirty();
    }
    
    // Check if roads need re-rendering
    if (this.roadSystem.isDirty()) {
      this.updateRoadOverlay();
      this.roadSystem.clearDirty();
    }
    
    // Update debug text
    const stats = this.engine.getStats();
    const camera = this.renderer.getCamera();
    const hoveredTile = this.inputManager?.getHoveredTile();
    
    let hoverInfo = 'None';
    if (hoveredTile) {
      const terrain = this.terrainSystem.getTerrainInfo(hoveredTile.x, hoveredTile.y);
      const zone = this.zoneSystem.getZoneCell(hoveredTile);
      const road = this.roadSystem.hasRoad(hoveredTile);
      if (terrain) {
        const zoneStr = zone?.zoneType ? ` | ${zone.zoneType.category[0].toUpperCase()}${zone.developed ? '*' : ''}` : '';
        const roadStr = road ? ' | Road' : '';
        hoverInfo = `(${hoveredTile.x}, ${hoveredTile.y})${roadStr}${zoneStr}`;
      }
    }
    
    this.renderer.updateDebugText({
      FPS: stats.fps,
      Zoom: camera.getZoom().toFixed(2),
      Tile: hoverInfo,
      Pop: this.rciDemandSystem.getPopulation(),
      Roads: this.roadSystem.getRoadStats().totalTiles,
    });
    
    // Update toolbar population
    if (this.toolbar) {
      this.toolbar.updatePopulation(this.rciDemandSystem.getPopulation());
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.renderer.handleResize();
  }

  /**
   * Destroy the game and clean up
   */
  destroy(): void {
    this.engine.destroy();
    this.renderer.destroy();
    if (this.inputManager) {
      this.inputManager.destroy();
    }
    if (this.toolbar) {
      this.toolbar.destroy();
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const game = new Game();
  
  // Store game instance globally for debugging
  (window as unknown as { game: Game }).game = game;
  
  await game.init();
}

// Start the application
main().catch((error) => {
  console.error('Failed to start game:', error);
});
