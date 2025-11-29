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
import { PowerSystem, createPowerSystem } from './systems/PowerSystem';
import { TemplateSystem, createTemplateSystem } from './systems/TemplateSystem';
import { InputManager } from './input/InputManager';
import { Toolbar, createToolbar, Tool } from './ui/Toolbar';
import { StatsPanel, createStatsPanel, CityStats } from './ui/StatsPanel';
import { EventTypes } from './core/EventBus';
import type { GridPosition, TerrainCell, SimulationSpeed, PowerPlantType } from './data/types';
import { Grid } from './data/Grid';
import { ZONE_TYPES } from './data/constants';

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
  private powerSystem: PowerSystem;
  private templateSystem: TemplateSystem;
  private inputManager: InputManager | null = null;
  private toolbar: Toolbar | null = null;
  private statsPanel: StatsPanel | null = null;
  private canvas: HTMLCanvasElement;
  
  // Grid references
  private terrainGrid: Grid<TerrainCell> | null = null;
  
  // UI elements
  private loadingElement: HTMLElement | null;
  
  // Zone overlay toggle
  private showZoneOverlay = true;
  
  // Power overlay toggle
  private showPowerOverlay = false;
  
  // Grid toggle state
  private showGridOverlay = false;
  
  // Two-click placement mode state
  private placementStart: GridPosition | null = null;
  private isInPlacementMode = false;
  
  // Template capture state
  private isCapturingTemplate = false;
  private templateCaptureStart: GridPosition | null = null;

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
    this.powerSystem = createPowerSystem();
    this.templateSystem = createTemplateSystem();
    
    // Register systems with engine (order matters for initialization)
    const world = this.engine.getWorld();
    world.addSystem(this.terrainSystem);
    world.addSystem(this.roadSystem);
    world.addSystem(this.powerSystem);
    world.addSystem(this.zoneSystem);
    world.addSystem(this.rciDemandSystem);
    world.addSystem(this.templateSystem);
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
      
      // Create stats panel UI
      this.statsPanel = createStatsPanel(this.engine.getEventBus());
      
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
      this.powerSystem.initializeGrid(64, 64);
      
      // Render terrain
      this.renderer.renderTerrain(this.terrainGrid);
      
      // Initial overlays render (empty)
      this.updateZoneOverlay();
      this.updateRoadOverlay();
      this.updatePowerOverlay();
      
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
      console.log('  - X: Toggle power overlay');
      console.log('  - Space: Regenerate terrain');
      console.log('  - R: Road tool');
      console.log('  - P: Power line tool');
      console.log('  - 1-9: Select zone tools');
      console.log('  - Q: Query tool');
      console.log('  - B: Bulldoze tool');
      console.log('  - T: Template capture tool');
      console.log('  - Ctrl+1-9: Save selection as template');
      console.log('  - Alt+1-9: Load and place template');
      
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
    
    // Listen for tile clicks (single click, no drag)
    eventBus.on(EventTypes.TILE_CLICKED, (event) => {
      const { position, button } = event.data as { position: GridPosition; button: string };
      
      if (button === 'left') {
        // Get current tool from toolbar
        const currentTool = this.toolbar?.getCurrentTool();
        
        // Handle single-click placement for tools
        if (currentTool) {
          this.handleToolAction(currentTool, position);
        }
        
        const terrainInfo = this.terrainSystem.getTerrainInfo(position.x, position.y);
        const zoneInfo = this.zoneSystem.getZoneCell(position);
        const roadInfo = this.roadSystem.getRoadCell(position);
        const powerInfo = this.powerSystem.getPowerCell(position);
        
        if (terrainInfo) {
          console.log(`Clicked tile (${position.x}, ${position.y}):`, {
            elevation: Math.round(terrainInfo.elevation),
            surface: terrainInfo.surfaceType,
            water: terrainInfo.waterDepth > 0 ? `depth: ${terrainInfo.waterDepth.toFixed(1)}` : 'none',
            buildable: this.terrainSystem.isBuildable(position.x, position.y),
            road: roadInfo?.hasRoad ? 'yes' : 'no',
            power: powerInfo?.hasPowerPlant ? `plant (${powerInfo.powerPlantType})` : 
                   powerInfo?.hasPowerLine ? 'line' : 
                   this.powerSystem.hasPower(position) ? 'powered' : 'no power',
            zone: zoneInfo?.zoneType ? `${zoneInfo.zoneType.category} (${zoneInfo.zoneType.density})` : 'none',
            developed: zoneInfo?.developed ?? false,
          });
        }
      }
    });
    
    // Listen for drag operations (for zone rectangle and road line drawing)
    eventBus.on(EventTypes.INPUT_DRAG, (event) => {
      const { button, startTile, currentTile } = event.data as { 
        button: string; 
        startTile: GridPosition | null; 
        currentTile: GridPosition | null;
      };
      
      if (button === 'left' && startTile && currentTile) {
        const currentTool = this.toolbar?.getCurrentTool();
        if (currentTool) {
          // Show preview during drag
          this.showDragPreview(currentTool, startTile, currentTile);
        }
      }
    });
    
    // Listen for drag end (commit the zone/road placement)
    // Only handles actual drags, not single clicks
    eventBus.on(EventTypes.INPUT_DRAG_END, (event) => {
      const { button, startTile, endTile } = event.data as { 
        button: string; 
        startTile: GridPosition | null; 
        endTile: GridPosition | null;
      };
      
      // Skip if in two-click placement mode - that's handled by handleToolAction
      if (this.isInPlacementMode) {
        return;
      }
      
      // Skip single-tile "drags" (clicks without actual drag movement)
      if (button === 'left' && startTile && endTile) {
        // Only process if it was an actual drag (start != end)
        const isDrag = startTile.x !== endTile.x || startTile.y !== endTile.y;
        if (isDrag) {
          const currentTool = this.toolbar?.getCurrentTool();
          if (currentTool) {
            this.handleDragPlacement(currentTool, startTile, endTile);
          }
        }
      }
      
      // Clear preview
      this.renderer.clearHighlight();
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

    // Listen for power changes
    eventBus.on('power:line_created', () => {
      this.updatePowerOverlay();
      // Update power status for all zones
      this.zoneSystem.updateUtilities(this.powerSystem.getPoweredPositions(), new Set());
    });
    
    eventBus.on('power:line_deleted', () => {
      this.updatePowerOverlay();
      this.zoneSystem.updateUtilities(this.powerSystem.getPoweredPositions(), new Set());
    });

    eventBus.on('power:plant_created', () => {
      this.updatePowerOverlay();
      this.zoneSystem.updateUtilities(this.powerSystem.getPoweredPositions(), new Set());
    });
    
    eventBus.on('power:plant_deleted', () => {
      this.updatePowerOverlay();
      this.zoneSystem.updateUtilities(this.powerSystem.getPoweredPositions(), new Set());
    });

    eventBus.on('power:grid_updated', () => {
      this.updatePowerOverlay();
      this.zoneSystem.updateUtilities(this.powerSystem.getPoweredPositions(), new Set());
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
      
      // X - Toggle power overlay
      if (key === 'x') {
        this.showPowerOverlay = !this.showPowerOverlay;
        this.renderer.setShowPower(this.showPowerOverlay);
        this.updatePowerOverlay();
        console.log(`Power overlay ${this.showPowerOverlay ? 'shown' : 'hidden'}`);
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
      
      // Escape - Cancel all placement modes and deselect tool
      if (key === 'escape') {
        this.handleEscapeKey();
      }
      
      // T - Template capture tool
      if (key === 't') {
        this.toolbar?.selectTool('template');
        console.log('Template capture tool selected');
      }
    });
    
    // Listen for raw keyboard events for Ctrl/Alt + number shortcuts
    this.setupTemplateKeyboardShortcuts();
    
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
   * Update power overlay rendering
   */
  private updatePowerOverlay(): void {
    const powerGrid = this.powerSystem.getPowerGrid();
    if (powerGrid && this.terrainGrid) {
      this.renderer.updatePowerOverlay(
        powerGrid, 
        this.terrainGrid, 
        this.powerSystem.getPoweredPositions()
      );
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
    this.powerSystem.initializeGrid(64, 64);
    
    // Re-render
    this.renderer.renderTerrain(this.terrainGrid);
    this.updateZoneOverlay();
    this.updateRoadOverlay();
    this.updatePowerOverlay();
    
    console.log('Terrain regenerated!');
  }

  /**
   * Handle single-click tool action (two-click placement mode)
   */
  private handleToolAction(tool: Tool, position: GridPosition): void {
    // Query tool: just display info, no placement
    if (tool.category === 'query') {
      return;
    }
    
    // Template tool: handle capture or placement
    if (tool.id === 'template') {
      // Check if we have an active template to place
      if (this.templateSystem.getActiveTemplate()) {
        // Place the active template at this position
        this.templateSystem.placeTemplate(position);
        // Update all overlays
        this.updateZoneOverlay();
        this.updateRoadOverlay();
        this.updatePowerOverlay();
        return;
      }
      
      // Otherwise, handle template capture
      if (!this.isCapturingTemplate) {
        // First click: start capture
        this.isCapturingTemplate = true;
        this.templateCaptureStart = position;
        this.templateSystem.startCapture(position);
        
        // Show start tile highlight
        const terrain = this.terrainSystem.getTerrainInfo(position.x, position.y);
        if (terrain) {
          this.renderer.highlightStartTile(position.x, position.y, terrain.elevation);
        }
        
        console.log(`Template capture started at (${position.x}, ${position.y})`);
        console.log('Drag to select area, then press Ctrl+1-9 to save template');
      } else {
        // Second click: finish capture area selection (but don't save yet)
        this.templateSystem.updateCapture(position);
        
        console.log('Template area selected. Press Ctrl+1-9 to save as template.');
        console.log('Press Escape to cancel, or click elsewhere to adjust.');
      }
      return;
    }
    
    // Power plants are single-click placement (they take up multiple tiles)
    if (tool.category === 'power' && tool.id !== 'power:line') {
      const plantType = tool.id.replace('power:', '') as PowerPlantType;
      if (this.terrainSystem.isBuildable(position.x, position.y)) {
        const success = this.powerSystem.placePowerPlant(position, plantType);
        if (success) {
          console.log(`Placed ${plantType} power plant at (${position.x}, ${position.y})`);
        } else {
          console.log(`Cannot place power plant at (${position.x}, ${position.y})`);
        }
      }
      return;
    }
    
    // For zone, road, power line, and bulldoze tools, use two-click placement
    if (tool.category === 'zone' || tool.category === 'road' || tool.category === 'power' || tool.category === 'bulldoze') {
      if (!this.isInPlacementMode) {
        // First click: start placement mode
        this.placementStart = position;
        this.isInPlacementMode = true;
        
        // Show start tile highlight
        const terrain = this.terrainSystem.getTerrainInfo(position.x, position.y);
        if (terrain) {
          this.renderer.highlightStartTile(position.x, position.y, terrain.elevation);
        }
        
        console.log(`Placement started at (${position.x}, ${position.y})`);
      } else {
        // Second click: complete placement
        if (this.placementStart) {
          this.completePlacement(tool, this.placementStart, position);
        }
        // Reset placement mode and clear start highlight
        this.placementStart = null;
        this.isInPlacementMode = false;
        this.renderer.clearStartHighlight();
      }
      return;
    }
  }

  /**
   * Complete a two-click placement
   */
  private completePlacement(tool: Tool, start: GridPosition, end: GridPosition): void {
    console.log(`Placement complete from (${start.x}, ${start.y}) to (${end.x}, ${end.y})`);
    
    if (tool.category === 'zone') {
      // Zones use rectangle
      const cells = this.getRectangleCells(start, end);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.placeZone(tool, cell);
        }
      }
    } else if (tool.category === 'road') {
      // Roads use line
      const cells = this.getLineCells(start, end);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.roadSystem.placeRoad(cell);
        }
      }
    } else if (tool.category === 'power' && tool.id === 'power:line') {
      // Power lines use line
      const cells = this.getLineCells(start, end);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.powerSystem.placePowerLine(cell);
        }
      }
    } else if (tool.category === 'bulldoze') {
      // Bulldoze uses rectangle
      const cells = this.getRectangleCells(start, end);
      for (const cell of cells) {
        this.zoneSystem.removeZone(cell);
        this.roadSystem.removeRoad(cell);
        this.powerSystem.removePowerLine(cell);
        this.powerSystem.removePowerPlant(cell);
      }
    }
  }

  /**
   * Handle Escape key - cancel all states and deselect tools
   */
  private handleEscapeKey(): void {
    // Clear template system states
    this.templateSystem.clearAllState();
    
    // Clear local placement states
    this.cancelPlacement();
    
    // Clear all highlights
    this.renderer.clearHighlight();
    this.renderer.clearStartHighlight();
    
    // Deselect current tool (switch to query)
    this.toolbar?.selectTool('query');
    
    console.log('Escape pressed - all states cleared, tool deselected');
  }

  /**
   * Cancel current placement mode
   */
  private cancelPlacement(): void {
    this.placementStart = null;
    this.isInPlacementMode = false;
    this.isCapturingTemplate = false;
    this.templateCaptureStart = null;
    this.renderer.clearStartHighlight();
  }
  
  /**
   * Set up keyboard shortcuts for template save/load
   * Ctrl+1-9: Save template to slot
   * Alt+1-9: Load template from slot
   */
  private setupTemplateKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Check for number keys 1-9
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
          // Ctrl+1-9: Save template
          e.preventDefault();
          
          if (this.isCapturingTemplate && this.templateCaptureStart) {
            // Get current hovered tile as end point
            const hoveredTile = this.inputManager?.getHoveredTile();
            if (hoveredTile) {
              this.templateSystem.updateCapture(hoveredTile);
            }
            
            // Save the template
            const success = this.templateSystem.saveTemplate(num);
            if (success) {
              console.log(`Template saved to slot ${num}`);
              // Reset capture state
              this.isCapturingTemplate = false;
              this.templateCaptureStart = null;
              this.renderer.clearStartHighlight();
            }
          } else {
            console.log('No template area selected. Use Template tool (T) and drag to select an area first.');
          }
        } else if (e.altKey && !e.ctrlKey && !e.shiftKey) {
          // Alt+1-9: Load template
          e.preventDefault();
          
          const success = this.templateSystem.loadTemplate(num);
          if (success) {
            // Switch to template tool for placement
            this.toolbar?.selectTool('template');
            console.log(`Template ${num} loaded. Click to place.`);
          } else {
            console.log(`No template in slot ${num}`);
          }
        }
      }
    });
  }

  /**
   * Show preview for template capture area
   */
  private showTemplateCapturePreview(start: GridPosition, end: GridPosition): void {
    // Use rectangle preview for template capture
    const cells = this.getRectangleCells(start, end);
    
    const tilesWithElevation = cells.map(cell => {
      const terrain = this.terrainSystem.getTerrainInfo(cell.x, cell.y);
      return {
        x: cell.x,
        y: cell.y,
        elevation: terrain?.elevation ?? 250,
      };
    });
    
    // Cyan color for template capture
    this.renderer.highlightMultipleTiles(tilesWithElevation, 0x00ffff, 0.3);
  }
  
  /**
   * Show preview for template placement
   */
  private showTemplatePlacementPreview(origin: GridPosition): void {
    const template = this.templateSystem.getActiveTemplate();
    if (!template?.elements?.length) return;
    
    // Build positions array - use filter/map to avoid noUncheckedIndexedAccess issues
    const elements = template.elements as Array<{ offset: { x: number; y: number } }>;
    const tilesWithElevation = elements
      .filter((el): el is { offset: { x: number; y: number } } => el != null && el.offset != null)
      .map(el => ({
        x: origin.x + el.offset.x,
        y: origin.y + el.offset.y,
        elevation: this.terrainSystem.getTerrainInfo(origin.x + el.offset.x, origin.y + el.offset.y)?.elevation ?? 250,
      }));
    
    this.renderer.highlightMultipleTiles(tilesWithElevation, 0xff00ff, 0.4);
  }
  
  /**
   * Show preview during two-click placement mode
   */
  private showPlacementPreview(start: GridPosition, end: GridPosition): void {
    const currentTool = this.toolbar?.getCurrentTool();
    if (!currentTool || !this.terrainGrid) return;

    // Get cells based on tool type
    let cells: GridPosition[];
    if (currentTool.category === 'road' || (currentTool.category === 'power' && currentTool.id === 'power:line')) {
      // Roads and power lines use straight line preview
      cells = this.getLineCells(start, end);
    } else {
      // Zones and bulldoze use rectangle preview
      cells = this.getRectangleCells(start, end);
    }

    // Build array of tiles with their elevations for multi-tile highlighting
    const tilesWithElevation = cells.map(cell => {
      const terrain = this.terrainSystem.getTerrainInfo(cell.x, cell.y);
      return {
        x: cell.x,
        y: cell.y,
        elevation: terrain?.elevation ?? 250,
      };
    });

    // Determine highlight color based on tool category
    let color = 0x00ff00; // Green for zones
    if (currentTool.category === 'road') {
      color = 0x888888; // Gray for roads
    } else if (currentTool.category === 'power') {
      color = 0xffaa00; // Orange for power
    } else if (currentTool.category === 'bulldoze') {
      color = 0xff0000; // Red for bulldoze
    }

    // Highlight all affected tiles
    this.renderer.highlightMultipleTiles(tilesWithElevation, color, 0.4);
  }

  /**
   * Show preview during drag operation
   */
  private showDragPreview(_tool: Tool, _startTile: GridPosition, currentTile: GridPosition): void {
    // For now, just highlight the current tile
    // TODO: Add multi-tile preview rendering for rectangles/lines using _tool and _startTile
    const terrain = this.terrainSystem.getTerrainInfo(currentTile.x, currentTile.y);
    if (terrain) {
      this.renderer.highlightTile(currentTile.x, currentTile.y, terrain.elevation);
    }
  }

  /**
   * Handle drag placement (place multiple tiles)
   */
  private handleDragPlacement(tool: Tool, startTile: GridPosition, endTile: GridPosition): void {
    if (tool.category === 'zone') {
      // Zones use rectangle drag
      const cells = this.getRectangleCells(startTile, endTile);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.placeZone(tool, cell);
        }
      }
    } else if (tool.category === 'road') {
      // Roads use line drag
      const cells = this.getLineCells(startTile, endTile);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.roadSystem.placeRoad(cell);
        }
      }
    } else if (tool.category === 'power' && tool.id === 'power:line') {
      // Power lines use line drag
      const cells = this.getLineCells(startTile, endTile);
      for (const cell of cells) {
        if (this.terrainSystem.isBuildable(cell.x, cell.y)) {
          this.powerSystem.placePowerLine(cell);
        }
      }
    } else if (tool.category === 'bulldoze') {
      // Bulldoze uses rectangle drag
      const cells = this.getRectangleCells(startTile, endTile);
      for (const cell of cells) {
        this.zoneSystem.removeZone(cell);
        this.roadSystem.removeRoad(cell);
      }
    }
  }

  /**
   * Place a zone based on tool type
   */
  private placeZone(tool: Tool, position: GridPosition): void {
    // Parse tool ID to get zone type key
    // Tool ID format: "zone:r-low", "zone:c-medium", "zone:i-high"
    // Zone type key format: "r-low", "c-medium", "i-high"
    const zoneKey = tool.id.replace('zone:', '');
    const zoneType = ZONE_TYPES[zoneKey];
    
    if (!zoneType) {
      console.warn(`Unknown zone type: ${zoneKey}`);
      return;
    }

    this.zoneSystem.placeZone(position, zoneType);
  }

  /**
   * Get all cells in a rectangle between two points
   */
  private getRectangleCells(start: GridPosition, end: GridPosition): GridPosition[] {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const cells: GridPosition[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push({ x, y });
      }
    }
    return cells;
  }

  /**
   * Get all cells in a straight line (horizontal OR vertical only)
   * Uses whichever axis has the greater distance
   */
  private getLineCells(start: GridPosition, end: GridPosition): GridPosition[] {
    const cells: GridPosition[] = [];
    
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    
    // Determine direction: use the axis with greater distance
    // If horizontal distance >= vertical, draw horizontal line
    // Otherwise draw vertical line
    if (dx >= dy) {
      // Horizontal line (x changes, y stays at start.y)
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y: start.y });
      }
    } else {
      // Vertical line (y changes, x stays at start.x)
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      for (let y = minY; y <= maxY; y++) {
        cells.push({ x: start.x, y });
      }
    }
    
    return cells;
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
    
    // Check if power needs re-rendering
    if (this.powerSystem.isDirty()) {
      this.updatePowerOverlay();
      this.powerSystem.clearDirty();
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
      const power = this.powerSystem.hasPower(hoveredTile);
      const powerCell = this.powerSystem.getPowerCell(hoveredTile);
      if (terrain) {
        const category = zone?.zoneType?.category;
        const isDeveloped = zone?.developed ?? false;
        const categoryInitial = category?.charAt(0)?.toUpperCase() ?? '';
        const zoneStr = categoryInitial
          ? ` | ${categoryInitial}${isDeveloped ? '*' : ''}`
          : '';
        const roadStr = road ? ' | Road' : '';
        const powerStr = powerCell?.hasPowerPlant ? ' | Plant' : 
                         powerCell?.hasPowerLine ? ' | PLine' : 
                         power ? ' | ⚡' : '';
        hoverInfo = `(${hoveredTile.x}, ${hoveredTile.y})${roadStr}${powerStr}${zoneStr}`;
        
        // Show placement preview or single tile hover highlight
        if (this.isInPlacementMode && this.placementStart && this.terrainGrid) {
          this.showPlacementPreview(this.placementStart, hoveredTile);
        } else if (this.isCapturingTemplate && this.templateCaptureStart && this.terrainGrid) {
          // Show template capture preview
          this.templateSystem.updateCapture(hoveredTile);
          this.showTemplateCapturePreview(this.templateCaptureStart, hoveredTile);
        } else if (this.templateSystem.getActiveTemplate()) {
          // Show template placement preview
          this.showTemplatePlacementPreview(hoveredTile);
        } else {
          this.renderer.highlightTile(hoveredTile.x, hoveredTile.y, terrain.elevation);
        }
      }
    } else {
      this.renderer.clearHighlight();
    }
    
    const powerStats = this.powerSystem.getPowerStats();
    this.renderer.updateDebugText({
      FPS: stats.fps,
      Zoom: camera.getZoom().toFixed(2),
      Tile: hoverInfo,
      Pop: this.rciDemandSystem.getPopulation(),
      Roads: this.roadSystem.getRoadStats().totalTiles,
      Power: `${Math.round(powerStats.totalCapacity)}MW`,
    });
    
    // Update toolbar population
    if (this.toolbar) {
      this.toolbar.updatePopulation(this.rciDemandSystem.getPopulation());
    }
    
    // Update stats panel
    this.updateStatsPanel();
  }

  /**
   * Update the stats panel with current city data
   */
  private updateStatsPanel(): void {
    if (!this.statsPanel) return;
    
    // Get zone stats
    const zoneStats = this.zoneSystem.getZoneStats();
    
    // Get power stats
    const powerStats = this.powerSystem.getPowerStats();
    
    // Get road stats
    const roadStats = this.roadSystem.getRoadStats();
    
    // Calculate total zones per category
    const rTotal = zoneStats.residential.low + zoneStats.residential.medium + zoneStats.residential.high;
    const cTotal = zoneStats.commercial.low + zoneStats.commercial.medium + zoneStats.commercial.high;
    const iTotal = zoneStats.industrial.low + zoneStats.industrial.medium + zoneStats.industrial.high;
    
    // Build stats object
    const stats: Partial<CityStats> = {
      population: this.rciDemandSystem.getPopulation(),
      residential: {
        low: 0,  // TODO: Track population by wealth when implemented
        medium: 0,
        high: 0,
      },
      zones: {
        residential: { 
          total: rTotal, 
          developed: zoneStats.residential.developed 
        },
        commercial: { 
          total: cTotal, 
          developed: zoneStats.commercial.developed 
        },
        industrial: { 
          total: iTotal, 
          developed: zoneStats.industrial.developed 
        },
      },
      power: {
        capacity: powerStats.totalCapacity,
        usage: powerStats.totalConsumption,
        plants: powerStats.powerPlantCount,
      },
      roads: roadStats.totalTiles,
      powerLines: powerStats.powerLineTiles,
    };
    
    this.statsPanel.updateStats(stats);
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
    if (this.statsPanel) {
      this.statsPanel.destroy();
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
