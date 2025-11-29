/**
 * Toolbar UI Component
 * 
 * HTML-based toolbar for tool selection and game controls.
 * Supports zone tools, road tools, RCI demand display, and simulation controls.
 * Features dropdown menus, grouped sections, and improved visual hierarchy.
 */

import { EventBus, EventTypes } from '../core/EventBus';
import type { ZoneCategory, ZoneDensity, DemandState, PowerPlantType } from '../data/types';
import { ZONE_TYPES, ZONE_COLORS, UI_COLORS, POWER_PLANT_CONFIGS } from '../data/constants';

/**
 * Tool definition
 */
export interface Tool {
  id: string;
  name: string;
  icon: string;
  category: 'zone' | 'road' | 'bulldoze' | 'query' | 'power' | 'other';
  hotkey?: string;
  subcategory?: string;
  cost?: number;
}

/**
 * Tool group definition for organizing toolbar sections
 */
export interface ToolGroup {
  id: string;
  label: string;
  icon: string;
  tools: string[];
  isDropdown?: boolean;
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
  { id: 'road', name: 'Road', icon: '🛣️', category: 'road', hotkey: 'r', cost: 10 },
  
  // Power infrastructure
  { id: 'power:line', name: 'Power Line', icon: '⚡', category: 'power', hotkey: 'p', cost: 5 },
  { id: 'power:coal', name: 'Coal Power Plant', icon: '🏭', category: 'power', subcategory: 'plant', cost: 4000 },
  { id: 'power:gas', name: 'Gas Power Plant', icon: '⛽', category: 'power', subcategory: 'plant', cost: 2000 },
  { id: 'power:nuclear', name: 'Nuclear Power Plant', icon: '☢️', category: 'power', subcategory: 'plant', cost: 15000 },
  { id: 'power:wind', name: 'Wind Farm', icon: '🌬️', category: 'power', subcategory: 'plant', cost: 100 },
  { id: 'power:solar', name: 'Solar Farm', icon: '☀️', category: 'power', subcategory: 'plant', cost: 500 },
  
  // Residential zones
  { id: 'zone:r-low', name: 'Low Density Residential', icon: '🏠', category: 'zone', subcategory: 'residential', hotkey: '1' },
  { id: 'zone:r-medium', name: 'Medium Density Residential', icon: '🏘️', category: 'zone', subcategory: 'residential', hotkey: '2' },
  { id: 'zone:r-high', name: 'High Density Residential', icon: '🏢', category: 'zone', subcategory: 'residential', hotkey: '3' },
  
  // Commercial zones
  { id: 'zone:c-low', name: 'Low Density Commercial', icon: '🏪', category: 'zone', subcategory: 'commercial', hotkey: '4' },
  { id: 'zone:c-medium', name: 'Medium Density Commercial', icon: '🏬', category: 'zone', subcategory: 'commercial', hotkey: '5' },
  { id: 'zone:c-high', name: 'High Density Commercial', icon: '🏙️', category: 'zone', subcategory: 'commercial', hotkey: '6' },
  
  // Industrial zones
  { id: 'zone:i-low', name: 'Light Industrial', icon: '🏭', category: 'zone', subcategory: 'industrial', hotkey: '7' },
  { id: 'zone:i-medium', name: 'Medium Industrial', icon: '⚙️', category: 'zone', subcategory: 'industrial', hotkey: '8' },
  { id: 'zone:i-high', name: 'Heavy Industrial', icon: '🔧', category: 'zone', subcategory: 'industrial', hotkey: '9' },
];

/**
 * Tool groups for organizing the toolbar
 */
export const TOOL_GROUPS: ToolGroup[] = [
  { id: 'utilities', label: 'Utilities', icon: '🔧', tools: ['query', 'bulldoze'] },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🛤️', tools: ['road', 'power:line'] },
  { id: 'power-plants', label: 'Power', icon: '⚡', tools: ['power:coal', 'power:gas', 'power:nuclear', 'power:wind', 'power:solar'], isDropdown: true },
  { id: 'residential', label: 'Residential', icon: '🏠', tools: ['zone:r-low', 'zone:r-medium', 'zone:r-high'] },
  { id: 'commercial', label: 'Commercial', icon: '🏪', tools: ['zone:c-low', 'zone:c-medium', 'zone:c-high'] },
  { id: 'industrial', label: 'Industrial', icon: '🏭', tools: ['zone:i-low', 'zone:i-medium', 'zone:i-high'] },
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
          border-radius: 12px;
          padding: 8px 16px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 6px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
        }
        
        .toolbar-divider {
          width: 1px;
          height: 44px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent);
          margin: 0 4px;
        }
        
        /* Tool group container */
        .tool-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        
        .tool-group-label {
          font-size: 8px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        
        .tool-group-buttons {
          display: flex;
          gap: 3px;
          background: rgba(0,0,0,0.2);
          padding: 3px;
          border-radius: 8px;
        }
        
        /* Tool button styles */
        .tool-btn {
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 6px;
          background: rgba(15, 52, 96, 0.9);
          color: white;
          font-size: 17px;
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
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .tool-btn.selected {
          background: linear-gradient(135deg, #e94560, #c73e54);
          box-shadow: 0 0 12px rgba(233, 69, 96, 0.6);
        }
        
        .tool-btn .hotkey {
          position: absolute;
          bottom: 1px;
          right: 3px;
          font-size: 8px;
          color: rgba(255,255,255,0.4);
          font-weight: bold;
        }
        
        /* Custom tooltip */
        .tool-btn .tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.95);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 1001;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        
        .tool-btn .tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: rgba(0,0,0,0.95);
        }
        
        .tool-btn .tooltip .cost {
          color: #ffd700;
          font-weight: bold;
          margin-left: 6px;
        }
        
        .tool-btn:hover .tooltip {
          opacity: 1;
        }
        
        /* Dropdown menu for power plants */
        .dropdown-container {
          position: relative;
        }
        
        .dropdown-trigger {
          width: 42px;
          height: 38px;
          border: none;
          border-radius: 6px;
          background: rgba(15, 52, 96, 0.9);
          color: white;
          font-size: 17px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          position: relative;
        }
        
        .dropdown-trigger:hover {
          background: rgba(26, 74, 122, 1);
        }
        
        .dropdown-trigger.has-selected {
          background: linear-gradient(135deg, #e94560, #c73e54);
          box-shadow: 0 0 12px rgba(233, 69, 96, 0.6);
        }
        
        .dropdown-trigger .dropdown-arrow {
          font-size: 8px;
          opacity: 0.7;
        }
        
        .dropdown-menu {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(22, 33, 62, 0.98);
          border-radius: 10px;
          padding: 8px;
          display: none;
          flex-direction: column;
          gap: 4px;
          min-width: 180px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
          z-index: 1002;
        }
        
        .dropdown-container:hover .dropdown-menu,
        .dropdown-menu:hover {
          display: flex;
        }
        
        .dropdown-menu::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 8px solid transparent;
          border-top-color: rgba(22, 33, 62, 0.98);
        }
        
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: rgba(15, 52, 96, 0.6);
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        
        .dropdown-item:hover {
          background: rgba(26, 74, 122, 1);
        }
        
        .dropdown-item.selected {
          background: linear-gradient(135deg, #e94560, #c73e54);
        }
        
        .dropdown-item .item-icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
        }
        
        .dropdown-item .item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        
        .dropdown-item .item-name {
          font-size: 12px;
          font-weight: 500;
        }
        
        .dropdown-item .item-cost {
          font-size: 10px;
          color: #ffd700;
        }
        
        /* Zone group with density indicators */
        .zone-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        
        .zone-group-label {
          font-size: 8px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .zone-group-label .zone-color {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .zone-group-buttons {
          display: flex;
          gap: 2px;
          background: rgba(0,0,0,0.2);
          padding: 3px;
          border-radius: 8px;
        }
        
        .zone-group-buttons .tool-btn {
          width: 32px;
          height: 32px;
          font-size: 14px;
        }
        
        /* Zone color indicators */
        .zone-residential .zone-color { background: #90ee90; }
        .zone-commercial .zone-color { background: #4169e1; }
        .zone-industrial .zone-color { background: #ffd700; }
        
        /* Density labels */
        .density-label {
          position: absolute;
          top: 1px;
          left: 3px;
          font-size: 7px;
          font-weight: bold;
          color: rgba(255,255,255,0.5);
        }
        
        /* Top bar styles */
        #top-bar {
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 66%;
          max-width: 700px;
          height: 36px;
          background: rgba(22, 33, 62, 0.95);
          border-radius: 10px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
          z-index: 1000;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
          font-size: 12px;
        }
        
        .stat-display {
          display: flex;
          align-items: center;
          gap: 6px;
          color: white;
        }
        
        .stat-icon {
          font-size: 14px;
        }
        
        .stat-value {
          font-weight: bold;
          font-size: 13px;
        }
        
        .demand-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .demand-label-text {
          color: rgba(255,255,255,0.6);
          font-size: 10px;
          font-weight: 600;
        }
        
        .demand-bar-container {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        
        .demand-label {
          font-size: 10px;
          color: rgba(255,255,255,0.8);
          font-weight: bold;
          width: 12px;
        }
        
        .demand-bar-bg {
          width: 14px;
          height: 28px;
          background: rgba(0,0,0,0.3);
          border-radius: 3px;
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
          gap: 3px;
          margin-left: auto;
        }
        
        .speed-btn {
          padding: 5px 10px;
          border: none;
          border-radius: 4px;
          background: rgba(15, 52, 96, 0.8);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 11px;
          font-weight: bold;
          transition: all 0.15s ease;
        }
        
        .speed-btn:hover {
          background: rgba(26, 74, 122, 1);
          color: white;
        }
        
        .speed-btn.active {
          background: linear-gradient(135deg, #e94560, #c73e54);
          color: white;
        }
      </style>
    `;

    // Build toolbar content using tool groups
    const toolsHtml: string[] = [];
    
    TOOL_GROUPS.forEach((group, index) => {
      // Add divider between groups (except before first)
      if (index > 0) {
        toolsHtml.push('<div class="toolbar-divider"></div>');
      }
      
      if (group.isDropdown) {
        // Create dropdown menu for this group
        toolsHtml.push(this.createDropdownGroup(group));
      } else if (group.id.includes('residential') || group.id.includes('commercial') || group.id.includes('industrial')) {
        // Create zone group with color indicator
        toolsHtml.push(this.createZoneGroup(group));
      } else {
        // Create regular tool group
        toolsHtml.push(this.createToolGroup(group));
      }
    });

    toolbar.innerHTML += toolsHtml.join('');

    // Add to document
    document.body.appendChild(toolbar);

    // Set up button click handlers for regular tools
    TOOLS.forEach(tool => {
      const btn = toolbar.querySelector(`#tool-${tool.id.replace(/:/g, '-')}`) as HTMLButtonElement;
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectTool(tool.id);
        });
        this.toolButtons.set(tool.id, btn);
      }
    });

    // Set up dropdown item click handlers
    toolbar.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const toolId = (item as HTMLElement).dataset.toolId;
        if (toolId) {
          this.selectTool(toolId);
          this.updateDropdownTrigger(toolId);
        }
      });
    });

    // Select default tool
    this.updateSelectedButton();

    return toolbar;
  }

  /**
   * Create a regular tool group
   */
  private createToolGroup(group: ToolGroup): string {
    const buttons = group.tools.map(toolId => {
      const tool = TOOLS.find(t => t.id === toolId);
      return tool ? this.createToolButton(tool) : '';
    }).join('');

    return `
      <div class="tool-group">
        <span class="tool-group-label">${group.label}</span>
        <div class="tool-group-buttons">
          ${buttons}
        </div>
      </div>
    `;
  }

  /**
   * Create a zone group with color indicator
   */
  private createZoneGroup(group: ToolGroup): string {
    const densityLabels = ['L', 'M', 'H'];
    const buttons = group.tools.map((toolId, index) => {
      const tool = TOOLS.find(t => t.id === toolId);
      if (!tool) return '';
      const densityLabel = densityLabels[index] || 'L';
      return this.createZoneButton(tool, densityLabel);
    }).join('');

    return `
      <div class="zone-group zone-${group.id}">
        <span class="zone-group-label">
          <span class="zone-color"></span>
          ${group.label}
        </span>
        <div class="zone-group-buttons">
          ${buttons}
        </div>
      </div>
    `;
  }

  /**
   * Create a dropdown group (for power plants)
   */
  private createDropdownGroup(group: ToolGroup): string {
    const items = group.tools.map(toolId => {
      const tool = TOOLS.find(t => t.id === toolId);
      if (!tool) return '';
      const cost = tool.cost ? `$${tool.cost.toLocaleString()}` : '';
      return `
        <button class="dropdown-item" data-tool-id="${tool.id}">
          <span class="item-icon">${tool.icon}</span>
          <div class="item-info">
            <span class="item-name">${tool.name}</span>
            ${cost ? `<span class="item-cost">${cost}</span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    return `
      <div class="tool-group">
        <span class="tool-group-label">${group.label}</span>
        <div class="tool-group-buttons">
          <div class="dropdown-container" id="dropdown-${group.id}">
            <button class="dropdown-trigger" id="dropdown-trigger-${group.id}">
              <span class="trigger-icon">${group.icon}</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-menu">
              ${items}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update dropdown trigger when a dropdown item is selected
   */
  private updateDropdownTrigger(toolId: string): void {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool || tool.subcategory !== 'plant') return;

    const trigger = document.querySelector('#dropdown-trigger-power-plants');
    if (trigger) {
      const iconSpan = trigger.querySelector('.trigger-icon');
      if (iconSpan) {
        iconSpan.textContent = tool.icon;
      }
      trigger.classList.add('has-selected');
    }
  }

  /**
   * Create a tool button HTML with tooltip
   */
  private createToolButton(tool: Tool): string {
    const id = tool.id.replace(/:/g, '-');
    const costText = tool.cost ? `<span class="cost">$${tool.cost}</span>` : '';
    return `
      <button class="tool-btn" id="tool-${id}">
        ${tool.icon}
        ${tool.hotkey ? `<span class="hotkey">${tool.hotkey}</span>` : ''}
        <span class="tooltip">${tool.name}${tool.hotkey ? ` (${tool.hotkey.toUpperCase()})` : ''}${costText}</span>
      </button>
    `;
  }

  /**
   * Create a zone button with density label
   */
  private createZoneButton(tool: Tool, densityLabel: string): string {
    const id = tool.id.replace(/:/g, '-');
    return `
      <button class="tool-btn" id="tool-${id}">
        ${tool.icon}
        <span class="density-label">${densityLabel}</span>
        ${tool.hotkey ? `<span class="hotkey">${tool.hotkey}</span>` : ''}
        <span class="tooltip">${tool.name}${tool.hotkey ? ` (${tool.hotkey})` : ''}</span>
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
