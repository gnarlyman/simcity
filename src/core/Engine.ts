/**
 * Game Engine
 * 
 * Main game loop with fixed timestep simulation and variable rendering.
 * Manages game state, systems, and rendering.
 */

import type { SimulationSpeed } from '../data/types';
import { SPEED_MULTIPLIERS } from '../data/types';
import { SIMULATION_TICK_MS, MAX_DELTA_TIME } from '../data/constants';
import { World } from './ECS';
import { EventBus, EventTypes } from './EventBus';

/**
 * Engine statistics for debugging
 */
export interface EngineStats {
  fps: number;
  frameTime: number;
  simulationTime: number;
  renderTime: number;
  entityCount: number;
  tickCount: number;
}

/**
 * Engine configuration
 */
export interface EngineConfig {
  simulationTickMs: number;
  maxDeltaTime: number;
  targetFps: number;
}

/**
 * Main Game Engine
 */
export class Engine {
  /** ECS World */
  private world: World;
  
  /** Event bus */
  private eventBus: EventBus;
  
  /** Current simulation speed */
  private speed: SimulationSpeed = 'normal';
  
  /** Time accumulator for fixed timestep */
  private accumulator = 0;
  
  /** Last frame timestamp */
  private lastTime = 0;
  
  /** Is the engine running? */
  private running = false;
  
  /** Animation frame ID */
  private frameId: number | null = null;
  
  /** Engine statistics */
  private stats: EngineStats = {
    fps: 0,
    frameTime: 0,
    simulationTime: 0,
    renderTime: 0,
    entityCount: 0,
    tickCount: 0,
  };
  
  /** FPS calculation */
  private frameCount = 0;
  private fpsTime = 0;
  
  /** Configuration */
  private config: EngineConfig;
  
  /** Render callback */
  private renderCallback: ((deltaTime: number) => void) | null = null;
  
  /** Simulation tick count */
  private tickCount = 0;

  constructor(eventBus?: EventBus, config?: Partial<EngineConfig>) {
    this.eventBus = eventBus ?? new EventBus();
    this.world = new World(this.eventBus);
    
    this.config = {
      simulationTickMs: config?.simulationTickMs ?? SIMULATION_TICK_MS,
      maxDeltaTime: config?.maxDeltaTime ?? MAX_DELTA_TIME,
      targetFps: config?.targetFps ?? 60,
    };
  }

  /**
   * Get the ECS world
   */
  getWorld(): World {
    return this.world;
  }

  /**
   * Get the event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get current simulation speed
   */
  getSpeed(): SimulationSpeed {
    return this.speed;
  }

  /**
   * Set simulation speed
   */
  setSpeed(speed: SimulationSpeed): void {
    const oldSpeed = this.speed;
    this.speed = speed;
    
    this.eventBus.emit({
      type: EventTypes.SIMULATION_SPEED_CHANGED,
      timestamp: Date.now(),
      data: { oldSpeed, newSpeed: speed },
    });
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    if (this.speed === 'paused') {
      this.setSpeed('normal');
    } else {
      this.setSpeed('paused');
    }
  }

  /**
   * Check if simulation is paused
   */
  isPaused(): boolean {
    return this.speed === 'paused';
  }

  /**
   * Set render callback
   */
  setRenderCallback(callback: (deltaTime: number) => void): void {
    this.renderCallback = callback;
  }

  /**
   * Get engine statistics
   */
  getStats(): Readonly<EngineStats> {
    return this.stats;
  }

  /**
   * Get tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsTime = 0;
    
    this.eventBus.emit({
      type: EventTypes.ENGINE_START,
      timestamp: Date.now(),
      data: null,
    });
    
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.running) return;
    
    this.running = false;
    
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    
    this.eventBus.emit({
      type: EventTypes.ENGINE_STOP,
      timestamp: Date.now(),
      data: null,
    });
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Main game loop
   */
  private loop(currentTime: number): void {
    if (!this.running) return;
    
    const frameStart = performance.now();
    
    // Calculate delta time
    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Clamp delta time to prevent spiral of death
    if (deltaTime > this.config.maxDeltaTime) {
      deltaTime = this.config.maxDeltaTime;
    }
    
    // Update FPS counter
    this.frameCount++;
    this.fpsTime += deltaTime;
    if (this.fpsTime >= 1000) {
      this.stats.fps = Math.round((this.frameCount * 1000) / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
    }
    
    // Add to accumulator (scaled by speed)
    const multiplier = SPEED_MULTIPLIERS[this.speed];
    this.accumulator += deltaTime * multiplier;
    
    // Fixed timestep simulation updates
    const simStart = performance.now();
    let simTicks = 0;
    
    while (this.accumulator >= this.config.simulationTickMs) {
      this.simulate(this.config.simulationTickMs);
      this.accumulator -= this.config.simulationTickMs;
      this.tickCount++;
      simTicks++;
      
      // Prevent too many simulation ticks per frame
      if (simTicks >= 10) {
        this.accumulator = 0;
        break;
      }
    }
    
    this.stats.simulationTime = performance.now() - simStart;
    
    // Variable timestep rendering (always runs)
    const renderStart = performance.now();
    this.render(deltaTime);
    this.stats.renderTime = performance.now() - renderStart;
    
    // Update stats
    this.stats.frameTime = performance.now() - frameStart;
    this.stats.entityCount = this.world.getEntityCount();
    this.stats.tickCount = this.tickCount;
    
    // Schedule next frame
    this.frameId = requestAnimationFrame((time) => this.loop(time));
  }

  /**
   * Run simulation tick
   */
  private simulate(deltaTime: number): void {
    // Update all systems
    this.world.update(deltaTime);
    
    // Emit tick event
    this.eventBus.emit({
      type: EventTypes.ENGINE_TICK,
      timestamp: Date.now(),
      data: { deltaTime, tickCount: this.tickCount },
    });
  }

  /**
   * Render frame
   */
  private render(deltaTime: number): void {
    if (this.renderCallback) {
      this.renderCallback(deltaTime);
    }
  }

  /**
   * Run a single simulation step (for testing/debugging)
   */
  step(): void {
    this.simulate(this.config.simulationTickMs);
    this.tickCount++;
    this.render(this.config.simulationTickMs);
  }

  /**
   * Destroy the engine and clean up
   */
  destroy(): void {
    this.stop();
    this.world.clear();
    this.eventBus.removeAllListeners();
    this.renderCallback = null;
  }
}

/**
 * Create and configure a game engine instance
 */
export function createEngine(config?: Partial<EngineConfig>): Engine {
  return new Engine(new EventBus(), config);
}
