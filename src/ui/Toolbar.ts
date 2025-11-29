/**
 * Toolbar UI Component
 * 
 * HTML-based toolbar for tool selection and game controls.
 * Supports zone tools, road tools, RCI demand display, and simulation controls.
 */

import { EventBus, EventTypes } from '../core/EventBus';
import type { ZoneCategory, ZoneDensity, DemandState } from '../data/types';
import { ZONE_TYPES, ZONE_COLORS, UI_COLORS } from '../data/constants';

/**
 * Tool definition
 */
export interface Tool {
  id: string;
  name: string;
  icon: string;
  category: 'zone' | 'road' | 'bulldoze' | 'query' | 'other';
  hotkey?: string;
}

/**
 * Available tools
 */
export const TOOLS: Tool[] = [
  // Query tool
  { id: 'query', name: 'Query', icon: '🔍', category: 'query', hotkey: 'q' },
  
  // Bulldoze
  { id: 'bulldoze', name: 'Bulldoze', icon: '🚧', category: 'bulldoze', hotkey: 'b' },
  
  // Roads
  { id: 'road', name: 'Road', icon: '🛣️', category: 'road', hotkey: 'r' },
  
  // Residential zones
  { id: 'zone:r-low', name: 'Res Low', icon: '🏠', category: 'zone', hotkey: '1' },
  { id: 'zone:r-medium', name: 'Res Med', icon: '🏘️', category: 'zone', hotkey: '2' },
  { id: 'zone:r-high', name: 'Res High', icon: '🏢', category: 'zone', hotkey: '3' },
  
  // Commercial zones
  { id: 'zone:c-low', name: 'Com Low', icon: '🏪', category: 'zone', hotkey: '4' },
  { id: 'zone:c-medium', name: 'Com Med', icon: '🏬', category: 'zone', hotkey: '5' },
  { id: 'zone:c-high', name: 'Com High', icon: '🏙️', category: 'zone', hotkey: '6' },
  
  // Industrial zones
  { id: 'zone:i-low', name: 'Ind Low', icon: '🏭', category: 'zone', hotkey: '7' },
  { id: 'zone:i-medium', name: 'Ind Med', icon: '⚙️', category: 'zone', hotkey: '8' },
  { id: 'zone:i-high', name: 'Ind High', icon: '🔧', category: 'zone', hotkey: '9' },
];

/**
 * Toolbar class
 */
export class Toolbar {
  /** Event bus for tool selection */
  private eventBus: EventBus;
  
  /** Container element */
  private container: HTMLElement;
  
  /** Currently selected tool */
  private selectedToolId: string = 'query';
  
  /** Tool buttons map */
  private toolButtons: Map<string, HTMLButtonElement> = new Map();
  
  /** Demand bars */
  private demandBars: {
    residential: HTMLElement | null;
    commercial: HTMLElement | null;
    industrial: HTMLElement | null;
  } = {
    residential: null,
    commercial: null,
    industrial: null,
  };
  
  /** Population display */
  private populationDisplay: HTMLElement | null = null;
  
  /** Funds display */
  private fundsDisplay: HTMLElement | null = null;
  
  /** Speed buttons */
  private speedButtons: NodeListOf<Element> | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container = this.createToolbarElement();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  /**
   * Create the toolbar HTML element
   */
  private createToolbarElement(): HTMLElement {
    // Create top bar first
    this.createTopBar();
    
    // Create bottom toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';
    toolbar.innerHTML = `
      <style>
        #toolbar {
          position: fixed;
          left: 50%;
          bottom: 10px;
          transform: translateX(-50%);
          background: rgba(22, 33, 62, 0.95);
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
        }
        
        .toolbar-divider {
          width: 1px;
          height: 36px;
          background: rgba(255,255,255,0.2);
          margin: 0 4px;
        }
        
        .toolbar-section-label {
          font-size: 9px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
        
        .tool-btn {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 6px;
          background: rgba(15, 52, 96, 0.8);
          color: white;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .tool-btn:hover {
          background: rgba(26, 74, 122, 1);
          transform: translateY(-2px);
        }
        
        .tool-btn.selected {
          background: #e94560;
          box-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
        }
        
        .tool-btn .hotkey {
          position: absolute;
          bottom: 1px;
          right: 2px;
          font-size: 8px;
          color: rgba(255,255,255,0.5);
        }
        
        .tool-btn[title]:hover::after {
          content: attr(title);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          margin-bottom: 6px;
          pointer-events: none;
        }
        
        #top-bar {
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 66%;
          max-width: 700px;
          height: 32px;
          background: rgba(22, 33, 62, 0.95);
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-size: 12px;
        }
        
        .stat-display {
          display: flex;
          align-items: center;
          gap: 4px;
          color: white;
        }
        
        .stat-icon {
          font-size: 14px;
        }
        
        .stat-value {
          font-weight: bold;
          font-size: 12px;
        }
        
        .demand-container {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .demand-label-text {
          color: rgba(255,255,255,0.7);
          font-size: 10px;
        }
        
        .demand-bar-container {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        
        .demand-label {
          font-size: 9px;
          color: rgba(255,255,255,0.7);
          font-weight: bold;
          width: 10px;
        }
        
        .demand-bar-bg {
          width: 12px;
          height: 24px;
          background: rgba(0,0,0,0.3);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
        }
        
        .demand-bar {
          position: absolute;
          bottom: 50%;
          left: 0;
          right: 0;
          background: currentColor;
          border-radius: 2px;
          transition: height 0.3s ease;
        }
        
        .demand-bar.positive {
          bottom: 50%;
        }
        
        .demand-bar.negative {
          top: 50%;
          bottom: auto;
        }
        
        .demand-bar-r { color: #90ee90; }
        .demand-bar-c { color: #4169e1; }
        .demand-bar-i { color: #ffd700; }
        
        .demand-center-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255,255,255,0.3);
        }
        
        .speed-controls {
          display: flex;
          gap: 2px;
          margin-left: auto;
        }
        
        .speed-btn {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          background: rgba(15, 52, 96, 0.8);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 10px;
          font-weight: bold;
          transition: all 0.15s ease;
        }
        
        .speed-btn:hover {
          background: rgba(26, 74, 122, 1);
          color: white;
        }
        
        .speed-btn.active {
          background: #e94560;
          color: white;
        }
        
        .zone-group {
          display: flex;
          gap: 2px;
        }
        
        .zone-group .tool-btn {
          width: 36px;
          height: 36px;
          font-size: 16px;
        }
      </style>
    `;

    // Build toolbar content
    const toolsHtml: string[] = [];
    
    // Query and Bulldoze
    const queryTool = TOOLS.find(t => t.id === 'query')!;
    const bulldozeTool = TOOLS.find(t => t.id === 'bulldoze')!;
    const roadTool = TOOLS.find(t => t.id === 'road')!;
    
    toolsHtml.push(this.createToolButton(queryTool));
    toolsHtml.push(this.createToolButton(bulldozeTool));
    toolsHtml.push('<div class="toolbar-divider"></div>');
    toolsHtml.push(this.createToolButton(roadTool));
    toolsHtml.push('<div class="toolbar-divider"></div>');
    
    // Residential zones
    toolsHtml.push('<span class="toolbar-section-label">R</span>');
    toolsHtml.push('<div class="zone-group">');
    TOOLS.filter(t => t.id.startsWith('zone:r')).forEach(tool => {
      toolsHtml.push(this.createToolButton(tool));
    });
    toolsHtml.push('</div>');
    
    // Commercial zones
    toolsHtml.push('<span class="toolbar-section-label">C</span>');
    toolsHtml.push('<div class="zone-group">');
    TOOLS.filter(t => t.id.startsWith('zone:c')).forEach(tool => {
      toolsHtml.push(this.createToolButton(tool));
    });
    toolsHtml.push('</div>');
    
    // Industrial zones
    toolsHtml.push('<span class="toolbar-section-label">I</span>');
    toolsHtml.push('<div class="zone-group">');
    TOOLS.filter(t => t.id.startsWith('zone:i')).forEach(tool => {
      toolsHtml.push(this.createToolButton(tool));
    });
    toolsHtml.push('</div>');

    toolbar.innerHTML += toolsHtml.join('');

    // Add to document
    document.body.appendChild(toolbar);

    // Set up button click handlers
    TOOLS.forEach(tool => {
      const btn = toolbar.querySelector(`#tool-${tool.id.replace(/:/g, '-')}`) as HTMLButtonElement;
      if (btn) {
        btn.addEventListener('click', () => this.selectTool(tool.id));
        this.toolButtons.set(tool.id, btn);
      }
    });

    // Select default tool
    this.updateSelectedButton();

    return toolbar;
  }

  /**
   * Create a tool button HTML
   */
  private createToolButton(tool: Tool): string {
    const id = tool.id.replace(/:/g, '-');
    return `
      <button class="tool-btn" id="tool-${id}" title="${tool.name}${tool.hotkey ? ` (${tool.hotkey})` : ''}">
        ${tool.icon}
        ${tool.hotkey ? `<span class="hotkey">${tool.hotkey}</span>` : ''}
      </button>
    `;
  }

  /**
   * Create the top status bar
   */
  private createTopBar(): void {
    const topBar = document.createElement('div');
    topBar.id = 'top-bar';
    topBar.innerHTML = `
      <div class="stat-display">
        <span class="stat-icon">👥</span>
        <span class="stat-value" id="population-display">0</span>
      </div>
      
      <div class="stat-display">
        <span class="stat-icon">💰</span>
        <span class="stat-value" id="funds-display">$10,000</span>
      </div>
      
      <div class="demand-container">
        <span class="demand-label-text">RCI:</span>
        
        <div class="demand-bar-container">
          <span class="demand-label">R</span>
          <div class="demand-bar-bg">
            <div class="demand-center-line"></div>
            <div class="demand-bar demand-bar-r" id="demand-r"></div>
          </div>
        </div>
        
        <div class="demand-bar-container">
          <span class="demand-label">C</span>
          <div class="demand-bar-bg">
            <div class="demand-center-line"></div>
            <div class="demand-bar demand-bar-c" id="demand-c"></div>
          </div>
        </div>
        
        <div class="demand-bar-container">
          <span class="demand-label">I</span>
          <div class="demand-bar-bg">
            <div class="demand-center-line"></div>
            <div class="demand-bar demand-bar-i" id="demand-i"></div>
          </div>
        </div>
      </div>
      
      <div class="speed-controls">
        <button class="speed-btn" data-speed="paused">⏸</button>
        <button class="speed-btn active" data-speed="normal">x1</button>
        <button class="speed-btn" data-speed="fast">x2</button>
        <button class="speed-btn" data-speed="turbo">x4</button>
      </div>
    `;

    document.body.appendChild(topBar);

    // Store references
    this.populationDisplay = topBar.querySelector('#population-display');
    this.fundsDisplay = topBar.querySelector('#funds-display');
    this.demandBars.residential = topBar.querySelector('#demand-r');
    this.demandBars.commercial = topBar.querySelector('#demand-c');
    this.demandBars.industrial = topBar.querySelector('#demand-i');

    // Set up speed button listeners
    this.speedButtons = topBar.querySelectorAll('.speed-btn');
    this.speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = (btn as HTMLElement).dataset.speed;
        if (speed) {
          // Map turbo to fast with higher multiplier
          const mappedSpeed = speed === 'turbo' ? 'fast' : speed;
          // Use a UI-specific event to avoid recursion with Engine's SIMULATION_SPEED_CHANGED
          this.eventBus.emitType('ui:speed_request', { speed: mappedSpeed, multiplier: speed === 'turbo' ? 4 : (speed === 'fast' ? 2 : 1) });
          
          // Update active state
          this.speedButtons?.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });
  }

  /**
   * Set up event bus listeners
   */
  private setupEventListeners(): void {
    // Listen for demand updates
    this.eventBus.on(EventTypes.DEMAND_UPDATED, (event) => {
      this.updateDemandBars(event.data as DemandState);
    });

    // Listen for building development to update population
    this.eventBus.on(EventTypes.BUILDING_DEVELOPED, (event) => {
      // Population will be updated by the system
    });
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Find tool with matching hotkey
      const tool = TOOLS.find(t => t.hotkey === key);
      if (tool) {
        this.selectTool(tool.id);
        e.preventDefault();
      }

      // Z key toggles zone overlay
      if (key === 'z') {
        this.eventBus.emitType('ui:toggle_zones', {});
      }
    });
  }

  /**
   * Select a tool
   */
  selectTool(toolId: string): void {
    this.selectedToolId = toolId;
    this.updateSelectedButton();

    // Emit tool selected event
    this.eventBus.emit({
      type: EventTypes.TOOL_SELECTED,
      timestamp: Date.now(),
      data: {
        tool: toolId,
      },
    });

    console.log(`Tool selected: ${toolId}`);
  }

  /**
   * Update button selected states
   */
  private updateSelectedButton(): void {
    for (const [id, btn] of this.toolButtons) {
      if (id === this.selectedToolId) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    }
  }

  /**
   * Update demand bar displays
   */
  updateDemandBars(demandState: DemandState): void {
    // Calculate total demand for each category (normalized to -1 to 1)
    const maxDemand = 5000;
    
    const rDemand = (demandState.residential.low + demandState.residential.medium + demandState.residential.high) / maxDemand;
    const cDemand = (demandState.commercial.low + demandState.commercial.medium + demandState.commercial.high) / maxDemand;
    const iDemand = (demandState.industrial.agriculture + demandState.industrial.dirty + 
                     demandState.industrial.manufacturing + demandState.industrial.highTech) / maxDemand;

    this.updateDemandBar(this.demandBars.residential, rDemand);
    this.updateDemandBar(this.demandBars.commercial, cDemand);
    this.updateDemandBar(this.demandBars.industrial, iDemand);
  }

  /**
   * Update a single demand bar
   */
  private updateDemandBar(bar: HTMLElement | null, value: number): void {
    if (!bar) return;

    // Clamp value between -1 and 1
    const clampedValue = Math.max(-1, Math.min(1, value));
    const height = Math.abs(clampedValue) * 50; // 50% is max height

    bar.style.height = `${height}%`;
    
    if (clampedValue >= 0) {
      bar.classList.add('positive');
      bar.classList.remove('negative');
      bar.style.bottom = '50%';
      bar.style.top = 'auto';
    } else {
      bar.classList.add('negative');
      bar.classList.remove('positive');
      bar.style.top = '50%';
      bar.style.bottom = 'auto';
    }
  }

  /**
   * Update population display
   */
  updatePopulation(population: number): void {
    if (this.populationDisplay) {
      this.populationDisplay.textContent = population.toLocaleString();
    }
  }

  /**
   * Update funds display
   */
  updateFunds(funds: number): void {
    if (this.fundsDisplay) {
      this.fundsDisplay.textContent = `$${funds.toLocaleString()}`;
    }
  }

  /**
   * Get currently selected tool ID
   */
  getSelectedToolId(): string {
    return this.selectedToolId;
  }

  /**
   * Get currently selected tool object
   */
  getCurrentTool(): Tool | undefined {
    return TOOLS.find(t => t.id === this.selectedToolId);
  }

  /**
   * Destroy the toolbar
   */
  destroy(): void {
    this.container.remove();
    const topBar = document.getElementById('top-bar');
    if (topBar) {
      topBar.remove();
    }
  }
}

/**
 * Create a new toolbar instance
 */
export function createToolbar(eventBus: EventBus): Toolbar {
  return new Toolbar(eventBus);
}
