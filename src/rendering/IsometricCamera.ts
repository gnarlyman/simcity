/**
 * Isometric Camera
 * 
 * Handles coordinate transformations between world space, isometric space, and screen space.
 * Supports panning, zooming, and smooth movement.
 */

import type { GridPosition, ScreenPosition, Bounds, CameraState } from '../data/types';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TILE_DEPTH,
  HALF_TILE_WIDTH,
  HALF_TILE_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  CAMERA_SMOOTHING,
} from '../data/constants';

/**
 * Isometric camera for 2:1 dimetric projection
 */
export class IsometricCamera {
  // Current position in isometric space
  private x = 0;
  private y = 0;
  
  // Current zoom level
  private zoom = 1;
  
  // Target values for smooth interpolation
  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;
  
  // Viewport dimensions
  private viewportWidth = 800;
  private viewportHeight = 600;
  
  // Smoothing factor (0 = instant, 1 = never)
  private smoothing = CAMERA_SMOOTHING;
  
  // World bounds for limiting camera movement
  private worldBounds: Bounds | null = null;

  constructor(viewportWidth?: number, viewportHeight?: number) {
    if (viewportWidth) this.viewportWidth = viewportWidth;
    if (viewportHeight) this.viewportHeight = viewportHeight;
  }

  // =========================================================================
  // Coordinate Transformations
  // =========================================================================

  /**
   * Convert world grid coordinates to isometric screen coordinates
   * (without camera transform)
   */
  worldToIsometric(worldX: number, worldY: number): ScreenPosition {
    return {
      x: (worldX - worldY) * HALF_TILE_WIDTH,
      y: (worldX + worldY) * HALF_TILE_HEIGHT,
    };
  }

  /**
   * Convert isometric coordinates to world grid coordinates
   */
  isometricToWorld(isoX: number, isoY: number): { x: number; y: number } {
    return {
      x: (isoX / HALF_TILE_WIDTH + isoY / HALF_TILE_HEIGHT) / 2,
      y: (isoY / HALF_TILE_HEIGHT - isoX / HALF_TILE_WIDTH) / 2,
    };
  }

  /**
   * Convert world coordinates to screen coordinates (with camera transform)
   */
  worldToScreen(worldX: number, worldY: number, worldZ = 0): ScreenPosition {
    const iso = this.worldToIsometric(worldX, worldY);
    
    // Apply elevation (z-axis moves sprite up)
    const elevatedY = iso.y - worldZ * TILE_DEPTH;
    
    // Apply camera transform
    const screenX = (iso.x - this.x) * this.zoom + this.viewportWidth / 2;
    const screenY = (elevatedY - this.y) * this.zoom + this.viewportHeight / 2;
    
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen coordinates to world grid position
   * (assumes z = 0 for picking)
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Reverse camera transform
    const isoX = (screenX - this.viewportWidth / 2) / this.zoom + this.x;
    const isoY = (screenY - this.viewportHeight / 2) / this.zoom + this.y;
    
    // Convert to world
    return this.isometricToWorld(isoX, isoY);
  }

  /**
   * Get grid position from screen coordinates (rounded to integers)
   */
  screenToGrid(screenX: number, screenY: number): GridPosition {
    const world = this.screenToWorld(screenX, screenY);
    return {
      x: Math.floor(world.x),
      y: Math.floor(world.y),
    };
  }

  // =========================================================================
  // Camera Movement
  // =========================================================================

  /**
   * Pan the camera by screen pixels
   */
  pan(deltaX: number, deltaY: number): void {
    this.targetX -= deltaX / this.zoom;
    this.targetY -= deltaY / this.zoom;
    this.clampToBounds();
  }

  /**
   * Pan directly in isometric space
   */
  panIsometric(deltaIsoX: number, deltaIsoY: number): void {
    this.targetX += deltaIsoX;
    this.targetY += deltaIsoY;
    this.clampToBounds();
  }

  /**
   * Center the camera on a world position
   */
  centerOn(worldX: number, worldY: number, instant = false): void {
    const iso = this.worldToIsometric(worldX, worldY);
    this.targetX = iso.x;
    this.targetY = iso.y;
    
    if (instant) {
      this.x = this.targetX;
      this.y = this.targetY;
    }
    
    this.clampToBounds();
  }

  /**
   * Center on a grid position
   */
  centerOnGrid(pos: GridPosition, instant = false): void {
    this.centerOn(pos.x + 0.5, pos.y + 0.5, instant);
  }

  /**
   * Move to a specific isometric position
   */
  moveTo(isoX: number, isoY: number, instant = false): void {
    this.targetX = isoX;
    this.targetY = isoY;
    
    if (instant) {
      this.x = this.targetX;
      this.y = this.targetY;
    }
    
    this.clampToBounds();
  }

  // =========================================================================
  // Zoom
  // =========================================================================

  /**
   * Zoom by a delta amount (positive = zoom in)
   */
  zoomBy(delta: number): void {
    this.targetZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, this.targetZoom + delta * ZOOM_STEP)
    );
  }

  /**
   * Zoom at a specific screen position (keeps that point stationary)
   */
  zoomAt(screenX: number, screenY: number, delta: number): void {
    // Get world position under cursor before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);
    
    // Apply zoom
    const oldZoom = this.targetZoom;
    this.targetZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, this.targetZoom * (1 + delta * ZOOM_STEP))
    );
    
    // If zoom changed, adjust position to keep point under cursor
    if (this.targetZoom !== oldZoom) {
      const worldAfter = this.screenToWorld(screenX, screenY);
      this.targetX += (worldBefore.x - worldAfter.x) * HALF_TILE_WIDTH;
      this.targetY += (worldBefore.y - worldAfter.y) * HALF_TILE_HEIGHT;
    }
    
    this.clampToBounds();
  }

  /**
   * Set zoom level directly
   */
  setZoom(zoom: number, instant = false): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    
    if (instant) {
      this.zoom = this.targetZoom;
    }
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom;
  }

  // =========================================================================
  // Viewport
  // =========================================================================

  /**
   * Set viewport dimensions
   */
  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Get viewport dimensions
   */
  getViewport(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }

  /**
   * Get visible world bounds for culling
   */
  getVisibleBounds(): Bounds {
    // Get screen corners in world space
    const topLeft = this.screenToWorld(0, 0);
    const topRight = this.screenToWorld(this.viewportWidth, 0);
    const bottomLeft = this.screenToWorld(0, this.viewportHeight);
    const bottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    
    // Add padding for partially visible tiles and tall buildings
    const padding = 5;
    
    return {
      minX: Math.floor(Math.min(topLeft.x, bottomLeft.x)) - padding,
      maxX: Math.ceil(Math.max(topRight.x, bottomRight.x)) + padding,
      minY: Math.floor(Math.min(topLeft.y, topRight.y)) - padding,
      maxY: Math.ceil(Math.max(bottomLeft.y, bottomRight.y)) + padding,
    };
  }

  /**
   * Check if a grid position is visible on screen
   */
  isVisible(worldX: number, worldY: number, margin = 0): boolean {
    const screen = this.worldToScreen(worldX, worldY);
    return (
      screen.x >= -margin &&
      screen.x <= this.viewportWidth + margin &&
      screen.y >= -margin &&
      screen.y <= this.viewportHeight + margin
    );
  }

  // =========================================================================
  // Bounds
  // =========================================================================

  /**
   * Set world bounds to limit camera movement
   */
  setWorldBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    // Convert world bounds to isometric bounds
    const corners = [
      this.worldToIsometric(minX, minY),
      this.worldToIsometric(maxX, minY),
      this.worldToIsometric(minX, maxY),
      this.worldToIsometric(maxX, maxY),
    ];
    
    this.worldBounds = {
      minX: Math.min(...corners.map((c) => c.x)),
      maxX: Math.max(...corners.map((c) => c.x)),
      minY: Math.min(...corners.map((c) => c.y)),
      maxY: Math.max(...corners.map((c) => c.y)),
    };
  }

  /**
   * Clear world bounds
   */
  clearWorldBounds(): void {
    this.worldBounds = null;
  }

  /**
   * Clamp camera position to world bounds
   */
  private clampToBounds(): void {
    if (!this.worldBounds) return;
    
    // Calculate visible area size in isometric space
    const halfViewW = (this.viewportWidth / 2) / this.targetZoom;
    const halfViewH = (this.viewportHeight / 2) / this.targetZoom;
    
    // Clamp target position
    this.targetX = Math.max(
      this.worldBounds.minX + halfViewW,
      Math.min(this.worldBounds.maxX - halfViewW, this.targetX)
    );
    this.targetY = Math.max(
      this.worldBounds.minY + halfViewH,
      Math.min(this.worldBounds.maxY - halfViewH, this.targetY)
    );
  }

  // =========================================================================
  // Update
  // =========================================================================

  /**
   * Update camera (smooth interpolation)
   */
  update(deltaTime: number): void {
    const t = 1 - Math.pow(1 - this.smoothing, deltaTime / 16.67);
    
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    this.zoom += (this.targetZoom - this.zoom) * t;
    
    // Snap to target if very close
    if (Math.abs(this.x - this.targetX) < 0.01) this.x = this.targetX;
    if (Math.abs(this.y - this.targetY) < 0.01) this.y = this.targetY;
    if (Math.abs(this.zoom - this.targetZoom) < 0.001) this.zoom = this.targetZoom;
  }

  /**
   * Set smoothing factor
   */
  setSmoothing(smoothing: number): void {
    this.smoothing = Math.max(0, Math.min(1, smoothing));
  }

  // =========================================================================
  // State
  // =========================================================================

  /**
   * Get camera state (for serialization/events)
   */
  getState(): CameraState {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }

  /**
   * Set camera state
   */
  setState(state: Partial<CameraState>, instant = false): void {
    if (state.x !== undefined) {
      this.targetX = state.x;
      if (instant) this.x = state.x;
    }
    if (state.y !== undefined) {
      this.targetY = state.y;
      if (instant) this.y = state.y;
    }
    if (state.zoom !== undefined) {
      this.targetZoom = state.zoom;
      if (instant) this.zoom = state.zoom;
    }
    if (state.viewportWidth !== undefined) {
      this.viewportWidth = state.viewportWidth;
    }
    if (state.viewportHeight !== undefined) {
      this.viewportHeight = state.viewportHeight;
    }
  }

  /**
   * Get position in isometric space
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Get target position in isometric space
   */
  getTargetPosition(): { x: number; y: number } {
    return { x: this.targetX, y: this.targetY };
  }
}
