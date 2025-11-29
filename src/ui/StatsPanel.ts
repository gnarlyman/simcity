/**
 * Stats Panel UI Component
 * 
 * Displays detailed city statistics including:
 * - Population breakdown by wealth
 * - Zone counts and development
 * - Power grid status
 * - Infrastructure stats
 * - RCI demand details
 */

import { EventBus, EventTypes } from '../core/EventBus';
import type { DemandState, ZoneCategory } from '../data/types';

/**
 * City stats interface
 */
export interface CityStats {
  // Population
  population: number;
  residential: {
    low: number;
    medium: number;
    high: number;
  };
  
  // Zone counts
  zones: {
    residential: { total: number; developed: number };
    commercial: { total: number; developed: number };
    industrial: { total: number; developed: number };
  };
  
  // Power
  power: {
    capacity: number;
    usage: number;
    plants: number;
  };
  
  // Infrastructure  
  roads: number;
  powerLines: number;
  
  // Demand
  demand: DemandState | null;
}

/**
 * Stats Panel class
 */
export class StatsPanel {
  private eventBus: EventBus;
  private container: HTMLElement;
  private isCollapsed: boolean = false;
  private stats: CityStats;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.stats = this.getDefaultStats();
    this.container = this.createPanelElement();
    this.setupEventListeners();
  }

  /**
   * Get default stats structure
   */
  private getDefaultStats(): CityStats {
    return {
      population: 0,
      residential: { low: 0, medium: 0, high: 0 },
      zones: {
        residential: { total: 0, developed: 0 },
        commercial: { total: 0, developed: 0 },
        industrial: { total: 0, developed: 0 },
      },
      power: { capacity: 0, usage: 0, plants: 0 },
      roads: 0,
      powerLines: 0,
      demand: null,
    };
  }

  /**
   * Create the panel HTML element
   */
  private createPanelElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'stats-panel';
    panel.innerHTML = `
      <style>
        #stats-panel {
          position: fixed;
          top: 60px;
          left: 10px;
          width: 200px;
          background: rgba(22, 33, 62, 0.95);
          border-radius: 10px;
          padding: 12px;
          z-index: 999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
          color: white;
          font-size: 11px;
          transition: all 0.3s ease;
        }
        
        #stats-panel.collapsed {
          width: auto;
          padding: 8px 12px;
        }
        
        #stats-panel.collapsed .panel-content {
          display: none;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          cursor: pointer;
        }
        
        .panel-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255,255,255,0.9);
        }
        
        .collapse-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 3px;
          transition: all 0.15s ease;
        }
        
        .collapse-btn:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        
        .panel-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .stat-section {
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 8px;
        }
        
        .section-title {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .section-title-icon {
          font-size: 11px;
        }
        
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 0;
        }
        
        .stat-label {
          color: rgba(255,255,255,0.7);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .stat-label-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .stat-value {
          font-weight: 600;
          color: white;
        }
        
        .stat-value.highlight-green { color: #90ee90; }
        .stat-value.highlight-blue { color: #4169e1; }
        .stat-value.highlight-yellow { color: #ffd700; }
        .stat-value.highlight-orange { color: #ff9800; }
        .stat-value.highlight-red { color: #ff5252; }
        
        /* Zone colors */
        .dot-residential { background: #90ee90; }
        .dot-commercial { background: #4169e1; }
        .dot-industrial { background: #ffd700; }
        
        /* Progress bar for power */
        .progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(0,0,0,0.3);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 4px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4caf50, #8bc34a);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        
        .progress-fill.warning {
          background: linear-gradient(90deg, #ff9800, #ffc107);
        }
        
        .progress-fill.danger {
          background: linear-gradient(90deg, #f44336, #e91e63);
        }
        
        /* Demand detail bars */
        .demand-detail {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .demand-detail-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .demand-detail-label {
          width: 50px;
          font-size: 9px;
          color: rgba(255,255,255,0.6);
        }
        
        .demand-detail-bar {
          flex: 1;
          height: 10px;
          background: rgba(0,0,0,0.3);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
        }
        
        .demand-detail-fill {
          position: absolute;
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease, left 0.3s ease;
        }
        
        .demand-detail-fill.positive {
          left: 50%;
          background: currentColor;
        }
        
        .demand-detail-fill.negative {
          right: 50%;
          left: auto;
          background: currentColor;
          opacity: 0.6;
        }
        
        .demand-detail-center {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(255,255,255,0.3);
        }
        
        .demand-detail-value {
          width: 35px;
          text-align: right;
          font-size: 9px;
          font-weight: 600;
        }
      </style>
      
      <div class="panel-header" id="stats-panel-header">
        <span class="panel-title">📊 City Stats</span>
        <button class="collapse-btn" id="collapse-btn">−</button>
      </div>
      
      <div class="panel-content" id="stats-panel-content">
        <!-- Population Section -->
        <div class="stat-section">
          <div class="section-title">
            <span class="section-title-icon">👥</span>
            Population
          </div>
          <div class="stat-row">
            <span class="stat-label">Total</span>
            <span class="stat-value" id="stat-pop-total">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot" style="background: #9CCC65;"></span>
              Low wealth
            </span>
            <span class="stat-value" id="stat-pop-low">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot" style="background: #66BB6A;"></span>
              Mid wealth
            </span>
            <span class="stat-value" id="stat-pop-medium">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot" style="background: #43A047;"></span>
              High wealth
            </span>
            <span class="stat-value" id="stat-pop-high">0</span>
          </div>
        </div>
        
        <!-- Zones Section -->
        <div class="stat-section">
          <div class="section-title">
            <span class="section-title-icon">🏗️</span>
            Zones
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot dot-residential"></span>
              Residential
            </span>
            <span class="stat-value highlight-green" id="stat-zones-r">0/0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot dot-commercial"></span>
              Commercial
            </span>
            <span class="stat-value highlight-blue" id="stat-zones-c">0/0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">
              <span class="stat-label-dot dot-industrial"></span>
              Industrial
            </span>
            <span class="stat-value highlight-yellow" id="stat-zones-i">0/0</span>
          </div>
        </div>
        
        <!-- Power Section -->
        <div class="stat-section">
          <div class="section-title">
            <span class="section-title-icon">⚡</span>
            Power Grid
          </div>
          <div class="stat-row">
            <span class="stat-label">Capacity</span>
            <span class="stat-value" id="stat-power-capacity">0 MW</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Usage</span>
            <span class="stat-value" id="stat-power-usage">0 MW</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="stat-power-bar" style="width: 0%;"></div>
          </div>
          <div class="stat-row" style="margin-top: 4px;">
            <span class="stat-label">Plants</span>
            <span class="stat-value" id="stat-power-plants">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Power lines</span>
            <span class="stat-value" id="stat-power-lines">0</span>
          </div>
        </div>
        
        <!-- Infrastructure Section -->
        <div class="stat-section">
          <div class="section-title">
            <span class="section-title-icon">🛤️</span>
            Infrastructure
          </div>
          <div class="stat-row">
            <span class="stat-label">Roads</span>
            <span class="stat-value" id="stat-roads">0</span>
          </div>
        </div>
        
        <!-- RCI Demand Section -->
        <div class="stat-section">
          <div class="section-title">
            <span class="section-title-icon">📈</span>
            RCI Demand
          </div>
          <div class="demand-detail" id="demand-detail-container">
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #90ee90;">R-Low</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-r-low" style="color: #90ee90; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-r-low">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #90ee90;">R-Med</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-r-med" style="color: #90ee90; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-r-med">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #90ee90;">R-High</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-r-high" style="color: #90ee90; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-r-high">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #4169e1;">C-Low</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-c-low" style="color: #4169e1; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-c-low">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #4169e1;">C-Med</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-c-med" style="color: #4169e1; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-c-med">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #4169e1;">C-High</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-c-high" style="color: #4169e1; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-c-high">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #ffd700;">I-Agri</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-i-agri" style="color: #ffd700; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-i-agri">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #ffd700;">I-Dirty</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-i-dirty" style="color: #ffd700; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-i-dirty">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #ffd700;">I-Mfg</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-i-mfg" style="color: #ffd700; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-i-mfg">0</span>
            </div>
            <div class="demand-detail-row">
              <span class="demand-detail-label" style="color: #ffd700;">I-HiTec</span>
              <div class="demand-detail-bar">
                <div class="demand-detail-center"></div>
                <div class="demand-detail-fill positive" id="demand-i-ht" style="color: #ffd700; width: 0%;"></div>
              </div>
              <span class="demand-detail-value" id="demand-val-i-ht">0</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Set up collapse button
    const collapseBtn = panel.querySelector('#collapse-btn');
    const header = panel.querySelector('#stats-panel-header');
    
    if (collapseBtn && header) {
      header.addEventListener('click', () => this.toggleCollapse());
    }

    return panel;
  }

  /**
   * Toggle panel collapsed state
   */
  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    
    const btn = this.container.querySelector('#collapse-btn');
    if (btn) {
      btn.textContent = this.isCollapsed ? '+' : '−';
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for demand updates
    this.eventBus.on(EventTypes.DEMAND_UPDATED, (event) => {
      this.updateDemandDisplay(event.data as DemandState);
    });

    // Listen for zone changes
    this.eventBus.on(EventTypes.ZONE_CREATED, () => {
      // Stats will be updated via updateStats() call from main
    });
    
    this.eventBus.on(EventTypes.ZONE_DELETED, () => {
      // Stats will be updated via updateStats() call from main
    });

    // Listen for building development
    this.eventBus.on(EventTypes.BUILDING_DEVELOPED, () => {
      // Stats will be updated via updateStats() call from main
    });
  }

  /**
   * Update all stats
   */
  updateStats(stats: Partial<CityStats>): void {
    // Merge with existing stats
    Object.assign(this.stats, stats);
    
    // Update population
    this.updateElement('stat-pop-total', this.stats.population.toLocaleString());
    this.updateElement('stat-pop-low', this.stats.residential.low.toLocaleString());
    this.updateElement('stat-pop-medium', this.stats.residential.medium.toLocaleString());
    this.updateElement('stat-pop-high', this.stats.residential.high.toLocaleString());
    
    // Update zones
    const zones = this.stats.zones;
    this.updateElement('stat-zones-r', `${zones.residential.developed}/${zones.residential.total}`);
    this.updateElement('stat-zones-c', `${zones.commercial.developed}/${zones.commercial.total}`);
    this.updateElement('stat-zones-i', `${zones.industrial.developed}/${zones.industrial.total}`);
    
    // Update power
    const power = this.stats.power;
    this.updateElement('stat-power-capacity', `${Math.round(power.capacity)} MW`);
    this.updateElement('stat-power-usage', `${Math.round(power.usage)} MW`);
    this.updateElement('stat-power-plants', power.plants.toString());
    this.updateElement('stat-power-lines', this.stats.powerLines.toString());
    
    // Update power bar
    const powerBar = document.getElementById('stat-power-bar');
    if (powerBar) {
      const usagePercent = power.capacity > 0 ? (power.usage / power.capacity) * 100 : 0;
      powerBar.style.width = `${Math.min(100, usagePercent)}%`;
      
      // Change color based on usage
      powerBar.classList.remove('warning', 'danger');
      if (usagePercent > 90) {
        powerBar.classList.add('danger');
      } else if (usagePercent > 70) {
        powerBar.classList.add('warning');
      }
    }
    
    // Update roads
    this.updateElement('stat-roads', this.stats.roads.toString());
  }

  /**
   * Update a single element's text
   */
  private updateElement(id: string, value: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  /**
   * Update demand display with detailed breakdown
   */
  updateDemandDisplay(demand: DemandState): void {
    this.stats.demand = demand;
    
    const maxDemand = 1000; // Scale for visualization
    
    // Residential demands
    this.updateDemandBar('demand-r-low', 'demand-val-r-low', demand.residential.low, maxDemand);
    this.updateDemandBar('demand-r-med', 'demand-val-r-med', demand.residential.medium, maxDemand);
    this.updateDemandBar('demand-r-high', 'demand-val-r-high', demand.residential.high, maxDemand);
    
    // Commercial demands
    this.updateDemandBar('demand-c-low', 'demand-val-c-low', demand.commercial.low, maxDemand);
    this.updateDemandBar('demand-c-med', 'demand-val-c-med', demand.commercial.medium, maxDemand);
    this.updateDemandBar('demand-c-high', 'demand-val-c-high', demand.commercial.high, maxDemand);
    
    // Industrial demands
    this.updateDemandBar('demand-i-agri', 'demand-val-i-agri', demand.industrial.agriculture, maxDemand);
    this.updateDemandBar('demand-i-dirty', 'demand-val-i-dirty', demand.industrial.dirty, maxDemand);
    this.updateDemandBar('demand-i-mfg', 'demand-val-i-mfg', demand.industrial.manufacturing, maxDemand);
    this.updateDemandBar('demand-i-ht', 'demand-val-i-ht', demand.industrial.highTech, maxDemand);
  }

  /**
   * Update a demand bar
   */
  private updateDemandBar(barId: string, valueId: string, value: number, maxDemand: number): void {
    const bar = document.getElementById(barId);
    const valueEl = document.getElementById(valueId);
    
    if (bar) {
      const percent = Math.min(50, Math.abs(value / maxDemand) * 50);
      bar.style.width = `${percent}%`;
      
      if (value >= 0) {
        bar.classList.remove('negative');
        bar.classList.add('positive');
        bar.style.left = '50%';
        bar.style.right = 'auto';
      } else {
        bar.classList.remove('positive');
        bar.classList.add('negative');
        bar.style.right = '50%';
        bar.style.left = 'auto';
      }
    }
    
    if (valueEl) {
      valueEl.textContent = Math.round(value).toString();
      valueEl.style.color = value >= 0 ? '#8bc34a' : '#ff5252';
    }
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.style.display = 'block';
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * Destroy the panel
   */
  destroy(): void {
    this.container.remove();
  }
}

/**
 * Create a new stats panel instance
 */
export function createStatsPanel(eventBus: EventBus): StatsPanel {
  return new StatsPanel(eventBus);
}
