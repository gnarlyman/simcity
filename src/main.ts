/**
 * SimCity Clone - Main Entry Point
 * 
 * Initializes the game engine, terrain system, renderer, and input handling.
 * Creates a functional terrain viewer with procedural generation and camera controls.
 */

import { Engine, createEngine } from './core/Engine';
import { Renderer } from './rendering/Renderer';
import { TerrainSystem } from './systems/TerrainSystem';
import { InputManager } from './input/InputManager';
import { EventBus, EventTypes } from './core/EventBus';
import type { GridPosition, TerrainCell } from './data/types';

/**
 * Game class - main application controller
 */
class Game {
  private engine: Engine;
  private renderer: Renderer;
  private terrainSystem: TerrainSystem;
  private inputManager: InputManager | null = null;
  private canvas: HTMLCanvasElement;
  
  // UI elements
  private loadingElement: HTMLElement | null;

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
    
    // Register terrain system with engine
    this.engine.getWorld().addSystem(this.terrainSystem);
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
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Generate initial terrain (64x64 map)
      const terrainGrid = this.terrainSystem.generate({
        width: 64,
        height: 64,
        seed: Math.random(),
      });
      
      // Render terrain
      this.renderer.renderTerrain(terrainGrid);
      
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
      console.log('  - Space: Regenerate terrain');
      
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
        if (terrainInfo) {
          console.log(`Clicked tile (${position.x}, ${position.y}):`, {
            elevation: Math.round(terrainInfo.elevation),
            surface: terrainInfo.surfaceType,
            water: terrainInfo.waterDepth > 0 ? `depth: ${terrainInfo.waterDepth.toFixed(1)}` : 'none',
            trees: terrainInfo.treeCount,
            buildable: this.terrainSystem.isBuildable(position.x, position.y),
          });
        }
      }
    });
    
    // Listen for keyboard input
    eventBus.on(EventTypes.INPUT_KEY_DOWN, (event) => {
      const { key } = event.data as { key: string };
      
      // G - Toggle grid
      if (key === 'g') {
        const showGrid = !this.renderer.getCamera().getZoom(); // Placeholder toggle
        this.renderer.setShowGrid(true);
        console.log('Grid overlay toggled');
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
  }

  /**
   * Regenerate terrain with new seed
   */
  private regenerateTerrain(): void {
    console.log('Regenerating terrain...');
    
    const terrainGrid = this.terrainSystem.generate({
      width: 64,
      height: 64,
      seed: Math.random(),
    });
    
    this.renderer.renderTerrain(terrainGrid);
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
    
    // Update debug text
    const stats = this.engine.getStats();
    const camera = this.renderer.getCamera();
    const hoveredTile = this.inputManager?.getHoveredTile();
    
    let hoverInfo = 'None';
    if (hoveredTile) {
      const terrain = this.terrainSystem.getTerrainInfo(hoveredTile.x, hoveredTile.y);
      if (terrain) {
        hoverInfo = `(${hoveredTile.x}, ${hoveredTile.y}) - ${terrain.surfaceType}, elev: ${Math.round(terrain.elevation)}`;
      }
    }
    
    this.renderer.updateDebugText({
      FPS: stats.fps,
      Zoom: camera.getZoom().toFixed(2),
      Entities: stats.entityCount,
      Tile: hoverInfo,
      Speed: this.engine.getSpeed(),
    });
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
  }
}

// Global toggle variable
let gridVisible = false;

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
