/**
 * Template System
 * 
 * Allows users to:
 * 1. Select a tool to enter "capture" mode
 * 2. Drag to highlight an area containing zones, roads, power lines
 * 3. Press Ctrl+1-9 to save the selection as a template
 * 4. Press Alt+1-9 to load a template for placement
 * 5. Click to place the template relative to cursor position
 * 
 * Templates are persisted to localStorage and can be exported as JSON files.
 */

import type { GridPosition, ZoneCategory, ZoneDensity, ZoneType, PowerPlantType } from '../data/types';
import { BaseSystem, World } from '../core/ECS';
import { EventBus } from '../core/EventBus';
import { ZoneSystem } from './ZoneSystem';
import { RoadSystem } from './RoadSystem';
import { PowerSystem } from './PowerSystem';
import { ZONE_TYPES } from '../data/constants';

/** Storage key for templates in localStorage */
const TEMPLATES_STORAGE_KEY = 'simcity_templates';

/**
 * Represents a captured element in a template
 */
interface TemplateElement {
  /** Offset from template origin */
  offset: { x: number; y: number };
  /** Type of element */
  type: 'road' | 'zone' | 'powerline' | 'powerplant';
  /** Zone-specific data */
  zoneData?: {
    category: ZoneCategory;
    density: ZoneDensity;
  };
  /** Power plant type */
  plantType?: PowerPlantType;
}

/**
 * A saved template
 */
export interface Template {
  name: string;
  /** All elements in the template */
  elements: TemplateElement[];
  /** Size of the template area */
  width: number;
  height: number;
  /** When it was captured */
  capturedAt: number;
}

/**
 * Template System class
 */
export class TemplateSystem extends BaseSystem {
  name = 'TemplateSystem';
  requiredComponents: string[] = [];
  priority = 100;

  /** Saved templates (slots 1-9) */
  private templates: Map<number, Template> = new Map();

  /** Currently loaded template for placement */
  private activeTemplate: Template | null = null;
  private activeSlot: number | null = null;

  /** Selection state */
  private isCapturing = false;
  private captureStart: GridPosition | null = null;
  private captureEnd: GridPosition | null = null;

  /** Event bus */
  private eventBus: EventBus | null = null;

  /** System references */
  private zoneSystem: ZoneSystem | null = null;
  private roadSystem: RoadSystem | null = null;
  private powerSystem: PowerSystem | null = null;

  /**
   * Initialize the system
   */
  init(world: World): void {
    this.eventBus = world.getEventBus();
    this.zoneSystem = world.getSystem<ZoneSystem>('ZoneSystem');
    this.roadSystem = world.getSystem<RoadSystem>('RoadSystem');
    this.powerSystem = world.getSystem<PowerSystem>('PowerSystem');
    
    // Load saved templates from localStorage
    this.loadFromStorage();
    
    // If no templates exist, load default starter templates
    if (this.templates.size === 0) {
      this.loadDefaultTemplates();
    }
  }

  /**
   * Update (not much to do each frame)
   */
  update(_world: World, _deltaTime: number): void {
    // Template system is event-driven
  }

  /**
   * Start capturing a template area
   */
  startCapture(position: GridPosition): void {
    this.isCapturing = true;
    this.captureStart = position;
    this.captureEnd = position;
    console.log(`Template capture started at (${position.x}, ${position.y})`);
  }

  /**
   * Update capture area while dragging
   */
  updateCapture(position: GridPosition): void {
    if (!this.isCapturing) return;
    this.captureEnd = position;
  }

  /**
   * Finish capturing and get the selected area bounds
   */
  finishCapture(): { min: GridPosition; max: GridPosition } | null {
    if (!this.isCapturing || !this.captureStart || !this.captureEnd) {
      this.cancelCapture();
      return null;
    }

    const minX = Math.min(this.captureStart.x, this.captureEnd.x);
    const maxX = Math.max(this.captureStart.x, this.captureEnd.x);
    const minY = Math.min(this.captureStart.y, this.captureEnd.y);
    const maxY = Math.max(this.captureStart.y, this.captureEnd.y);

    console.log(`Template capture finished: (${minX}, ${minY}) to (${maxX}, ${maxY})`);

    return {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    };
  }

  /**
   * Cancel the current capture
   */
  cancelCapture(): void {
    this.isCapturing = false;
    this.captureStart = null;
    this.captureEnd = null;
  }

  /**
   * Save the captured area as a template to a slot (1-9)
   */
  saveTemplate(slot: number): boolean {
    if (slot < 1 || slot > 9) {
      console.warn('Template slot must be 1-9');
      return false;
    }

    const bounds = this.finishCapture();
    if (!bounds) {
      console.warn('No area selected for template');
      return false;
    }

    const template = this.captureArea(bounds.min, bounds.max);
    if (template.elements.length === 0) {
      console.warn('Selected area is empty');
      return false;
    }

    template.name = `Template ${slot}`;
    this.templates.set(slot, template);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'TEMPLATE_SAVED',
        timestamp: Date.now(),
        data: { slot, template }
      });
    }

    console.log(`Template saved to slot ${slot}: ${template.elements.length} elements`);
    
    // Persist to localStorage
    this.saveToStorage();
    
    return true;
  }

  /**
   * Save all templates to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: Record<number, Template> = {};
      for (const [slot, template] of this.templates) {
        data[slot] = template;
      }
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(data));
      console.log('Templates saved to localStorage');
    } catch (error) {
      console.warn('Failed to save templates to localStorage:', error);
    }
  }

  /**
   * Load templates from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, Template>;
        for (const [slotStr, template] of Object.entries(data)) {
          const slot = parseInt(slotStr);
          if (slot >= 1 && slot <= 9 && template && template.elements) {
            this.templates.set(slot, template);
            console.log(`Loaded template ${slot} from storage: ${template.elements.length} elements`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load templates from localStorage:', error);
    }
  }

  /**
   * Load default starter templates from JSON file
   */
  private async loadDefaultTemplates(): Promise<void> {
    try {
      const response = await fetch('/templates/starter-templates.json');
      if (!response.ok) {
        console.log('No default templates found');
        return;
      }
      
      const data = await response.json() as Record<string, Template>;
      for (const [slotStr, template] of Object.entries(data)) {
        const slot = parseInt(slotStr);
        if (slot >= 1 && slot <= 9 && template && template.elements) {
          this.templates.set(slot, template);
          console.log(`Loaded default template ${slot}: "${template.name}" (${template.elements.length} elements)`);
        }
      }
      
      // Save to localStorage so they persist
      this.saveToStorage();
      console.log('Default starter templates loaded!');
    } catch (error) {
      console.log('Could not load default templates:', error);
    }
  }

  /**
   * Export all templates as a JSON string (for download)
   */
  exportAllTemplates(): string {
    const data: Record<number, Template> = {};
    for (const [slot, template] of this.templates) {
      data[slot] = template;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export a single template as JSON string
   */
  exportTemplate(slot: number): string | null {
    const template = this.templates.get(slot);
    if (!template) return null;
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import templates from a JSON string
   */
  importTemplates(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString) as Record<string, Template>;
      for (const [slotStr, template] of Object.entries(data)) {
        const slot = parseInt(slotStr);
        if (slot >= 1 && slot <= 9 && template && template.elements) {
          this.templates.set(slot, template);
          console.log(`Imported template ${slot}: ${template.elements.length} elements`);
        }
      }
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import templates:', error);
      return false;
    }
  }

  /**
   * Download all templates as a JSON file
   */
  downloadTemplates(): void {
    const json = this.exportAllTemplates();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simcity-templates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Templates downloaded as simcity-templates.json');
  }

  /**
   * Capture all elements in an area
   */
  private captureArea(min: GridPosition, max: GridPosition): Template {
    const elements: TemplateElement[] = [];
    const originX = min.x;
    const originY = min.y;

    // Capture zones
    if (this.zoneSystem) {
      for (let x = min.x; x <= max.x; x++) {
        for (let y = min.y; y <= max.y; y++) {
          const zoneCell = this.zoneSystem.getZoneCell({ x, y });
          if (zoneCell && zoneCell.zoneType) {
            elements.push({
              offset: { x: x - originX, y: y - originY },
              type: 'zone',
              zoneData: {
                category: zoneCell.zoneType.category,
                density: zoneCell.zoneType.density
              }
            });
          }
        }
      }
    }

    // Capture roads
    if (this.roadSystem) {
      for (let x = min.x; x <= max.x; x++) {
        for (let y = min.y; y <= max.y; y++) {
          const hasRoad = this.roadSystem.hasRoad({ x, y });
          if (hasRoad) {
            elements.push({
              offset: { x: x - originX, y: y - originY },
              type: 'road'
            });
          }
        }
      }
    }

    // Capture power lines and plants
    if (this.powerSystem) {
      for (let x = min.x; x <= max.x; x++) {
        for (let y = min.y; y <= max.y; y++) {
          const powerCell = this.powerSystem.getPowerCell({ x, y });
          if (powerCell) {
            if (powerCell.hasPowerPlant && powerCell.powerPlantType) {
              elements.push({
                offset: { x: x - originX, y: y - originY },
                type: 'powerplant',
                plantType: powerCell.powerPlantType
              });
            } else if (powerCell.hasPowerLine) {
              elements.push({
                offset: { x: x - originX, y: y - originY },
                type: 'powerline'
              });
            }
          }
        }
      }
    }

    return {
      name: 'Untitled',
      elements,
      width: max.x - min.x + 1,
      height: max.y - min.y + 1,
      capturedAt: Date.now()
    };
  }

  /**
   * Load a template from a slot for placement
   */
  loadTemplate(slot: number): boolean {
    if (slot < 1 || slot > 9) {
      console.warn('Template slot must be 1-9');
      return false;
    }

    const template = this.templates.get(slot);
    if (!template) {
      console.log(`No template in slot ${slot}`);
      return false;
    }

    this.activeTemplate = template;
    this.activeSlot = slot;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'TEMPLATE_LOADED',
        timestamp: Date.now(),
        data: { slot, template }
      });
    }

    console.log(`Template ${slot} loaded: ${template.elements.length} elements ready to place`);
    return true;
  }

  /**
   * Place the currently active template at a position
   */
  placeTemplate(origin: GridPosition): boolean {
    if (!this.activeTemplate) {
      console.warn('No template loaded');
      return false;
    }

    let placedCount = 0;

    for (const element of this.activeTemplate.elements) {
      const pos: GridPosition = {
        x: origin.x + element.offset.x,
        y: origin.y + element.offset.y
      };

      switch (element.type) {
        case 'zone':
          if (this.zoneSystem && element.zoneData) {
            // Get zone type from category and density
            const zoneKey = `${element.zoneData.category.charAt(0)}-${element.zoneData.density}`;
            const zoneType = ZONE_TYPES[zoneKey];
            if (zoneType) {
              const result = this.zoneSystem.placeZone(pos, zoneType);
              if (result.success) placedCount++;
            }
          }
          break;

        case 'road':
          if (this.roadSystem) {
            const success = this.roadSystem.placeRoad(pos);
            if (success) placedCount++;
          }
          break;

        case 'powerline':
          if (this.powerSystem) {
            const success = this.powerSystem.placePowerLine(pos);
            if (success) placedCount++;
          }
          break;

        case 'powerplant':
          if (this.powerSystem && element.plantType) {
            const success = this.powerSystem.placePowerPlant(pos, element.plantType);
            if (success) placedCount++;
          }
          break;
      }
    }

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'TEMPLATE_PLACED',
        timestamp: Date.now(),
        data: {
          slot: this.activeSlot,
          origin,
          placedCount,
          totalElements: this.activeTemplate.elements.length
        }
      });
    }

    console.log(`Template placed at (${origin.x}, ${origin.y}): ${placedCount}/${this.activeTemplate.elements.length} elements`);
    return placedCount > 0;
  }

  /**
   * Clear the active template
   */
  clearActiveTemplate(): void {
    this.activeTemplate = null;
    this.activeSlot = null;
  }

  /**
   * Get the active template
   */
  getActiveTemplate(): Template | null {
    return this.activeTemplate;
  }

  /**
   * Get active slot number
   */
  getActiveSlot(): number | null {
    return this.activeSlot;
  }

  /**
   * Check if currently capturing
   */
  getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * Get capture bounds for rendering preview
   */
  getCaptureBounds(): { start: GridPosition; end: GridPosition } | null {
    if (!this.isCapturing || !this.captureStart || !this.captureEnd) {
      return null;
    }
    return { start: this.captureStart, end: this.captureEnd };
  }

  /**
   * Get all saved templates
   */
  getTemplates(): Map<number, Template> {
    return this.templates;
  }

  /**
   * Check if a slot has a template
   */
  hasTemplate(slot: number): boolean {
    return this.templates.has(slot);
  }

  /**
   * Delete a template from a slot
   */
  deleteTemplate(slot: number): boolean {
    if (this.templates.has(slot)) {
      this.templates.delete(slot);
      if (this.activeSlot === slot) {
        this.clearActiveTemplate();
      }
      this.saveToStorage();
      console.log(`Template ${slot} deleted`);
      return true;
    }
    return false;
  }

  /**
   * Clear all state (called when Escape is pressed or tool is deselected)
   */
  clearAllState(): void {
    this.cancelCapture();
    this.clearActiveTemplate();
  }

  /**
   * Get the number of saved templates
   */
  getTemplateCount(): number {
    return this.templates.size;
  }

  /**
   * Get list of which slots have templates
   */
  getFilledSlots(): number[] {
    return Array.from(this.templates.keys()).sort();
  }
}

/**
 * Create a new template system
 */
export function createTemplateSystem(): TemplateSystem {
  return new TemplateSystem();
}
