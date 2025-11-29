/**
 * Event Bus
 * 
 * Decoupled event system for communication between game systems.
 * Based on the eventemitter3 library for performance.
 */

import { EventEmitter } from 'eventemitter3';
import type { GameEvent } from '../data/types';

/** Event handler function type */
export type EventHandler<T extends GameEvent = GameEvent> = (event: T) => void;

/**
 * Event Bus class for decoupled communication
 */
export class EventBus {
  private emitter: EventEmitter;
  private eventHistory: GameEvent[] = [];
  private maxHistoryLength = 100;
  private recordHistory = false;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Subscribe to an event type
   * @param eventType The event type to listen for
   * @param handler The callback function to execute
   * @returns Unsubscribe function
   */
  on<T extends GameEvent>(eventType: string, handler: EventHandler<T>): () => void {
    this.emitter.on(eventType, handler as EventHandler);
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe to an event type (once only)
   * @param eventType The event type to listen for
   * @param handler The callback function to execute
   */
  once<T extends GameEvent>(eventType: string, handler: EventHandler<T>): void {
    this.emitter.once(eventType, handler as EventHandler);
  }

  /**
   * Unsubscribe from an event type
   * @param eventType The event type to stop listening for
   * @param handler The callback function to remove
   */
  off<T extends GameEvent>(eventType: string, handler: EventHandler<T>): void {
    this.emitter.off(eventType, handler as EventHandler);
  }

  /**
   * Emit an event
   * @param event The event to emit
   */
  emit<T extends GameEvent>(event: T): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Record in history if enabled
    if (this.recordHistory) {
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.maxHistoryLength) {
        this.eventHistory.shift();
      }
    }

    this.emitter.emit(event.type, event);
  }

  /**
   * Emit an event by type and data (convenience method)
   */
  emitType<D>(type: string, data: D): void {
    this.emit({
      type,
      timestamp: Date.now(),
      data,
    } as GameEvent);
  }

  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.emitter.removeAllListeners(eventType);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: string): number {
    return this.emitter.listenerCount(eventType);
  }

  /**
   * Get all event type names that have listeners
   */
  eventNames(): string[] {
    return this.emitter.eventNames() as string[];
  }

  /**
   * Enable or disable event history recording
   */
  setRecordHistory(enabled: boolean, maxLength = 100): void {
    this.recordHistory = enabled;
    this.maxHistoryLength = maxLength;
    if (!enabled) {
      this.eventHistory = [];
    }
  }

  /**
   * Get recorded event history
   */
  getHistory(): readonly GameEvent[] {
    return this.eventHistory;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Create a scoped event bus that prefixes all event types
   */
  scoped(prefix: string): ScopedEventBus {
    return new ScopedEventBus(this, prefix);
  }
}

/**
 * Scoped Event Bus that prefixes all event types
 */
export class ScopedEventBus {
  constructor(
    private parent: EventBus,
    private prefix: string
  ) {}

  private prefixType(type: string): string {
    return `${this.prefix}:${type}`;
  }

  on<T extends GameEvent>(eventType: string, handler: EventHandler<T>): () => void {
    return this.parent.on(this.prefixType(eventType), handler);
  }

  once<T extends GameEvent>(eventType: string, handler: EventHandler<T>): void {
    this.parent.once(this.prefixType(eventType), handler);
  }

  off<T extends GameEvent>(eventType: string, handler: EventHandler<T>): void {
    this.parent.off(this.prefixType(eventType), handler);
  }

  emit<T extends GameEvent>(event: T): void {
    const prefixedEvent = {
      ...event,
      type: this.prefixType(event.type),
    };
    this.parent.emit(prefixedEvent);
  }

  emitType<D>(type: string, data: D): void {
    this.parent.emitType(this.prefixType(type), data);
  }
}

// Global event bus instance
export const globalEventBus = new EventBus();

// Common event type constants
export const EventTypes = {
  // Engine events
  ENGINE_INIT: 'engine:init',
  ENGINE_START: 'engine:start',
  ENGINE_STOP: 'engine:stop',
  ENGINE_TICK: 'engine:tick',

  // Camera events
  CAMERA_MOVED: 'camera:moved',
  CAMERA_ZOOMED: 'camera:zoomed',

  // Input events
  INPUT_CLICK: 'input:click',
  INPUT_DRAG_START: 'input:drag_start',
  INPUT_DRAG: 'input:drag',
  INPUT_DRAG_END: 'input:drag_end',
  INPUT_KEY_DOWN: 'input:key_down',
  INPUT_KEY_UP: 'input:key_up',

  // Tile events
  TILE_CLICKED: 'tile:clicked',
  TILE_HOVERED: 'tile:hovered',
  TILE_DRAG: 'tile:drag',

  // Tool events
  TOOL_SELECTED: 'tool:selected',
  TOOL_APPLIED: 'tool:applied',

  // Zone events
  ZONE_CREATED: 'zone:created',
  ZONE_DELETED: 'zone:deleted',
  ZONE_UPDATED: 'zone:updated',

  // Building events
  BUILDING_CREATED: 'building:created',
  BUILDING_DEVELOPED: 'building:developed',
  BUILDING_UPGRADED: 'building:upgraded',
  BUILDING_ABANDONED: 'building:abandoned',
  BUILDING_DEMOLISHED: 'building:demolished',

  // Terrain events
  TERRAIN_GENERATED: 'terrain:generated',
  TERRAIN_MODIFIED: 'terrain:modified',

  // Demand events
  DEMAND_UPDATED: 'demand:updated',

  // UI events
  UI_PANEL_OPENED: 'ui:panel_opened',
  UI_PANEL_CLOSED: 'ui:panel_closed',
  UI_TOOLTIP_SHOW: 'ui:tooltip_show',
  UI_TOOLTIP_HIDE: 'ui:tooltip_hide',

  // Game state events
  GAME_SAVED: 'game:saved',
  GAME_LOADED: 'game:loaded',
  GAME_NEW: 'game:new',

  // Simulation events
  SIMULATION_SPEED_CHANGED: 'simulation:speed_changed',
  SIMULATION_DATE_CHANGED: 'simulation:date_changed',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
