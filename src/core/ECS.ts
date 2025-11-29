/**
 * Entity-Component-System (ECS) Implementation
 * 
 * A simplified ECS architecture for game entity management.
 * - Entities are just numeric IDs
 * - Components are plain data objects
 * - Systems process entities with specific component combinations
 */

import type { EntityId, Component } from '../data/types';
import { EventBus, EventTypes } from './EventBus';

/**
 * System interface - processes entities with specific components
 */
export interface System {
  /** System name for identification */
  name: string;
  
  /** Components required for this system to process an entity */
  requiredComponents: string[];
  
  /** Priority for system execution order (lower = earlier) */
  priority: number;
  
  /** Initialize the system */
  init?(world: World): void;
  
  /** Update the system */
  update(world: World, deltaTime: number): void;
  
  /** Clean up the system */
  destroy?(): void;
}

/**
 * Query result for entity queries
 */
export interface QueryResult {
  entityId: EntityId;
  components: Map<string, Component>;
}

/**
 * World class - manages all entities, components, and systems
 */
export class World {
  /** All entities and their components */
  private entities: Map<EntityId, Map<string, Component>> = new Map();
  
  /** Next entity ID to assign */
  private nextEntityId: EntityId = 1;
  
  /** Registered systems */
  private systems: System[] = [];
  
  /** Systems sorted by priority (cached) */
  private sortedSystems: System[] = [];
  
  /** Systems need re-sorting */
  private systemsDirty = false;
  
  /** Component index for fast queries */
  private componentIndex: Map<string, Set<EntityId>> = new Map();
  
  /** Event bus for entity events */
  private eventBus: EventBus;
  
  /** Entities pending destruction (processed at end of update) */
  private pendingDestruction: EntityId[] = [];

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? new EventBus();
  }

  // =========================================================================
  // Entity Management
  // =========================================================================

  /**
   * Create a new entity
   * @returns The entity ID
   */
  createEntity(): EntityId {
    const entityId = this.nextEntityId++;
    this.entities.set(entityId, new Map());
    return entityId;
  }

  /**
   * Destroy an entity (deferred to end of update)
   */
  destroyEntity(entityId: EntityId): void {
    if (this.entities.has(entityId)) {
      this.pendingDestruction.push(entityId);
    }
  }

  /**
   * Immediately destroy an entity
   */
  destroyEntityImmediate(entityId: EntityId): void {
    const components = this.entities.get(entityId);
    if (!components) return;

    // Remove from all component indices
    for (const componentType of components.keys()) {
      this.componentIndex.get(componentType)?.delete(entityId);
    }

    // Remove entity
    this.entities.delete(entityId);
  }

  /**
   * Process pending entity destructions
   */
  private processPendingDestructions(): void {
    for (const entityId of this.pendingDestruction) {
      this.destroyEntityImmediate(entityId);
    }
    this.pendingDestruction = [];
  }

  /**
   * Check if an entity exists
   */
  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get all entity IDs
   */
  getAllEntities(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  // =========================================================================
  // Component Management
  // =========================================================================

  /**
   * Add a component to an entity
   */
  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Entity ${entityId} does not exist`);
    }

    const componentType = component.type;
    components.set(componentType, component);

    // Update component index
    if (!this.componentIndex.has(componentType)) {
      this.componentIndex.set(componentType, new Set());
    }
    this.componentIndex.get(componentType)!.add(entityId);
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: EntityId, componentType: string): void {
    const components = this.entities.get(entityId);
    if (!components) return;

    components.delete(componentType);
    this.componentIndex.get(componentType)?.delete(entityId);
  }

  /**
   * Get a component from an entity
   */
  getComponent<T extends Component>(entityId: EntityId, componentType: string): T | null {
    const components = this.entities.get(entityId);
    if (!components) return null;
    return (components.get(componentType) as T) ?? null;
  }

  /**
   * Check if an entity has a component
   */
  hasComponent(entityId: EntityId, componentType: string): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;
    return components.has(componentType);
  }

  /**
   * Check if an entity has all specified components
   */
  hasAllComponents(entityId: EntityId, componentTypes: string[]): boolean {
    const components = this.entities.get(entityId);
    if (!components) return false;
    return componentTypes.every((type) => components.has(type));
  }

  /**
   * Get all components for an entity
   */
  getAllComponents(entityId: EntityId): Map<string, Component> | null {
    return this.entities.get(entityId) ?? null;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /**
   * Query entities with specific components
   */
  query(componentTypes: string[]): EntityId[] {
    if (componentTypes.length === 0) {
      return this.getAllEntities();
    }

    // Start with the smallest set
    let smallestSet: Set<EntityId> | undefined;
    let smallestSize = Infinity;

    for (const type of componentTypes) {
      const set = this.componentIndex.get(type);
      if (!set || set.size === 0) {
        return []; // No entities have this component
      }
      if (set.size < smallestSize) {
        smallestSize = set.size;
        smallestSet = set;
      }
    }

    if (!smallestSet) return [];

    // Filter the smallest set by checking other components
    const results: EntityId[] = [];
    for (const entityId of smallestSet) {
      if (this.hasAllComponents(entityId, componentTypes)) {
        results.push(entityId);
      }
    }

    return results;
  }

  /**
   * Query entities and return with their components
   */
  queryWithComponents(componentTypes: string[]): QueryResult[] {
    const entityIds = this.query(componentTypes);
    return entityIds.map((entityId) => ({
      entityId,
      components: this.entities.get(entityId)!,
    }));
  }

  /**
   * Find a single entity with specific components
   */
  findOne(componentTypes: string[]): EntityId | null {
    const results = this.query(componentTypes);
    return results[0] ?? null;
  }

  // =========================================================================
  // System Management
  // =========================================================================

  /**
   * Register a system
   */
  addSystem(system: System): void {
    this.systems.push(system);
    this.systemsDirty = true;
    
    if (system.init) {
      system.init(this);
    }
  }

  /**
   * Remove a system
   */
  removeSystem(systemName: string): void {
    const index = this.systems.findIndex((s) => s.name === systemName);
    if (index !== -1) {
      const system = this.systems[index]!;
      if (system.destroy) {
        system.destroy();
      }
      this.systems.splice(index, 1);
      this.systemsDirty = true;
    }
  }

  /**
   * Get a system by name
   */
  getSystem<T extends System>(name: string): T | null {
    return (this.systems.find((s) => s.name === name) as T) ?? null;
  }

  /**
   * Get sorted systems (by priority)
   */
  private getSortedSystems(): System[] {
    if (this.systemsDirty) {
      this.sortedSystems = [...this.systems].sort((a, b) => a.priority - b.priority);
      this.systemsDirty = false;
    }
    return this.sortedSystems;
  }

  // =========================================================================
  // Update
  // =========================================================================

  /**
   * Update all systems
   */
  update(deltaTime: number): void {
    const systems = this.getSortedSystems();
    
    for (const system of systems) {
      system.update(this, deltaTime);
    }

    // Process pending destructions at the end
    this.processPendingDestructions();
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Serialize the world state
   */
  serialize(): SerializedWorld {
    const entities: SerializedEntity[] = [];
    
    for (const [entityId, components] of this.entities) {
      const serializedComponents: Record<string, Component> = {};
      for (const [type, component] of components) {
        serializedComponents[type] = component;
      }
      entities.push({ entityId, components: serializedComponents });
    }

    return {
      nextEntityId: this.nextEntityId,
      entities,
    };
  }

  /**
   * Deserialize world state
   */
  deserialize(data: SerializedWorld): void {
    // Clear existing state
    this.entities.clear();
    this.componentIndex.clear();
    this.pendingDestruction = [];

    // Restore state
    this.nextEntityId = data.nextEntityId;
    
    for (const entity of data.entities) {
      const components = new Map<string, Component>();
      
      for (const [type, component] of Object.entries(entity.components)) {
        components.set(type, component);
        
        // Rebuild component index
        if (!this.componentIndex.has(type)) {
          this.componentIndex.set(type, new Set());
        }
        this.componentIndex.get(type)!.add(entity.entityId);
      }
      
      this.entities.set(entity.entityId, components);
    }
  }

  /**
   * Clear all entities and components
   */
  clear(): void {
    this.entities.clear();
    this.componentIndex.clear();
    this.pendingDestruction = [];
    this.nextEntityId = 1;
  }

  /**
   * Get the event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
}

/**
 * Serialized world state
 */
export interface SerializedWorld {
  nextEntityId: EntityId;
  entities: SerializedEntity[];
}

/**
 * Serialized entity
 */
export interface SerializedEntity {
  entityId: EntityId;
  components: Record<string, Component>;
}

/**
 * Base class for systems with common functionality
 */
export abstract class BaseSystem implements System {
  abstract name: string;
  abstract requiredComponents: string[];
  priority = 0;

  init?(world: World): void;
  abstract update(world: World, deltaTime: number): void;
  destroy?(): void;

  /**
   * Helper to get entities matching this system's requirements
   */
  protected getEntities(world: World): EntityId[] {
    return world.query(this.requiredComponents);
  }
}
