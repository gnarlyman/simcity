/**
 * Input Manager
 * 
 * Handles mouse and keyboard input for camera control and game interaction.
 */

import type { GridPosition, ScreenPosition } from '../data/types';
import { EventBus, EventTypes } from '../core/EventBus';
import { IsometricCamera } from '../rendering/IsometricCamera';
import { EDGE_PAN_THRESHOLD, EDGE_PAN_SPEED } from '../data/constants';

/**
 * Mouse button types
 */
export type MouseButton = 'left' | 'right' | 'middle';

/**
 * Key state tracking
 */
export interface KeyState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * Input state
 */
export interface InputState {
  // Mouse position
  mouseX: number;
  mouseY: number;
  
  // Mouse buttons
  leftButton: boolean;
  rightButton: boolean;
  middleButton: boolean;
  
  // Dragging
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  
  // Keyboard modifiers
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  
  // Hovered tile
  hoveredTile: GridPosition | null;
}

/**
 * Input Manager class
 */
export class InputManager {
  /** Event bus for input events */
  private eventBus: EventBus;
  
  /** Camera reference for coordinate transforms */
  private camera: IsometricCamera;
  
  /** Target element for input events */
  private element: HTMLElement;
  
  /** Current input state */
  private state: InputState = {
    mouseX: 0,
    mouseY: 0,
    leftButton: false,
    rightButton: false,
    middleButton: false,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    shift: false,
    ctrl: false,
    alt: false,
    hoveredTile: null,
  };
  
  /** Key states */
  private keys: Map<string, KeyState> = new Map();
  
  /** Mouse wheel accumulator */
  private wheelDelta = 0;
  
  /** Edge pan enabled */
  private edgePanEnabled = false;
  
  /** Drag threshold in pixels */
  private dragThreshold = 5;
  
  /** Has moved past drag threshold */
  private hasDragged = false;

  constructor(element: HTMLElement, camera: IsometricCamera, eventBus: EventBus) {
    this.element = element;
    this.camera = camera;
    this.eventBus = eventBus;
    
    this.setupEventListeners();
  }

  /**
   * Set up DOM event listeners
   */
  private setupEventListeners(): void {
    // Mouse events
    this.element.addEventListener('mousedown', this.handleMouseDown);
    this.element.addEventListener('mouseup', this.handleMouseUp);
    this.element.addEventListener('mousemove', this.handleMouseMove);
    this.element.addEventListener('wheel', this.handleWheel, { passive: false });
    this.element.addEventListener('contextmenu', this.handleContextMenu);
    this.element.addEventListener('mouseleave', this.handleMouseLeave);

    // Keyboard events (on window to catch regardless of focus)
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Remove event listeners
   */
  destroy(): void {
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    this.element.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('mousemove', this.handleMouseMove);
    this.element.removeEventListener('wheel', this.handleWheel);
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);
    
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  // =========================================================================
  // Mouse Event Handlers
  // =========================================================================

  private handleMouseDown = (e: MouseEvent): void => {
    const button = this.getButton(e.button);
    this.updateMousePosition(e);
    this.updateModifiers(e);
    
    if (button === 'left') this.state.leftButton = true;
    if (button === 'right') this.state.rightButton = true;
    if (button === 'middle') this.state.middleButton = true;
    
    // Start potential drag
    this.state.dragStartX = this.state.mouseX;
    this.state.dragStartY = this.state.mouseY;
    this.hasDragged = false;
    
    // Middle button always starts camera drag
    if (button === 'middle') {
      this.state.isDragging = true;
      this.eventBus.emitType(EventTypes.INPUT_DRAG_START, {
        x: this.state.mouseX,
        y: this.state.mouseY,
        button,
      });
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    const button = this.getButton(e.button);
    this.updateMousePosition(e);
    this.updateModifiers(e);
    
    if (button === 'left') this.state.leftButton = false;
    if (button === 'right') this.state.rightButton = false;
    if (button === 'middle') this.state.middleButton = false;
    
    // End drag
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.eventBus.emitType(EventTypes.INPUT_DRAG_END, {
        x: this.state.mouseX,
        y: this.state.mouseY,
        button,
      });
    }
    
    // If we didn't drag, it's a click
    if (!this.hasDragged && button !== 'middle') {
      const worldPos = this.camera.screenToWorld(this.state.mouseX, this.state.mouseY);
      const gridPos = this.camera.screenToGrid(this.state.mouseX, this.state.mouseY);
      
      this.eventBus.emit({
        type: EventTypes.TILE_CLICKED,
        timestamp: Date.now(),
        data: {
          position: gridPos,
          button,
          modifiers: {
            shift: this.state.shift,
            ctrl: this.state.ctrl,
            alt: this.state.alt,
          },
        },
      });
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const prevX = this.state.mouseX;
    const prevY = this.state.mouseY;
    
    this.updateMousePosition(e);
    this.updateModifiers(e);
    
    const deltaX = this.state.mouseX - prevX;
    const deltaY = this.state.mouseY - prevY;
    
    // Update hovered tile
    this.state.hoveredTile = this.camera.screenToGrid(this.state.mouseX, this.state.mouseY);
    
    this.eventBus.emitType(EventTypes.TILE_HOVERED, {
      position: this.state.hoveredTile,
      screenX: this.state.mouseX,
      screenY: this.state.mouseY,
    });
    
    // Check for drag start
    if ((this.state.leftButton || this.state.middleButton) && !this.state.isDragging) {
      const dragDistance = Math.sqrt(
        Math.pow(this.state.mouseX - this.state.dragStartX, 2) +
        Math.pow(this.state.mouseY - this.state.dragStartY, 2)
      );
      
      if (dragDistance > this.dragThreshold) {
        this.hasDragged = true;
        this.state.isDragging = true;
        
        this.eventBus.emitType(EventTypes.INPUT_DRAG_START, {
          x: this.state.dragStartX,
          y: this.state.dragStartY,
          button: this.state.middleButton ? 'middle' : 'left',
        });
      }
    }
    
    // Handle dragging
    if (this.state.isDragging) {
      // Middle button or right button drag = camera pan
      if (this.state.middleButton || this.state.rightButton) {
        this.camera.pan(deltaX, deltaY);
      }
      
      this.eventBus.emitType(EventTypes.INPUT_DRAG, {
        x: this.state.mouseX,
        y: this.state.mouseY,
        deltaX,
        deltaY,
        button: this.state.middleButton ? 'middle' : 'left',
      });
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    
    this.updateMousePosition(e);
    
    // Normalize wheel delta
    const delta = -Math.sign(e.deltaY);
    
    // Zoom at cursor position
    this.camera.zoomAt(this.state.mouseX, this.state.mouseY, delta);
    
    this.eventBus.emitType(EventTypes.CAMERA_ZOOMED, {
      zoom: this.camera.getZoom(),
      screenX: this.state.mouseX,
      screenY: this.state.mouseY,
    });
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleMouseLeave = (_e: MouseEvent): void => {
    this.state.hoveredTile = null;
  };

  // =========================================================================
  // Keyboard Event Handlers
  // =========================================================================

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    
    // Update modifier state
    this.state.shift = e.shiftKey;
    this.state.ctrl = e.ctrlKey;
    this.state.alt = e.altKey;
    
    // Update key state
    let keyState = this.keys.get(key);
    if (!keyState) {
      keyState = { pressed: false, justPressed: false, justReleased: false };
      this.keys.set(key, keyState);
    }
    
    if (!keyState.pressed) {
      keyState.justPressed = true;
    }
    keyState.pressed = true;
    
    this.eventBus.emitType(EventTypes.INPUT_KEY_DOWN, {
      key,
      shift: this.state.shift,
      ctrl: this.state.ctrl,
      alt: this.state.alt,
    });
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    
    // Update modifier state
    this.state.shift = e.shiftKey;
    this.state.ctrl = e.ctrlKey;
    this.state.alt = e.altKey;
    
    // Update key state
    const keyState = this.keys.get(key);
    if (keyState) {
      keyState.pressed = false;
      keyState.justReleased = true;
    }
    
    this.eventBus.emitType(EventTypes.INPUT_KEY_UP, {
      key,
      shift: this.state.shift,
      ctrl: this.state.ctrl,
      alt: this.state.alt,
    });
  };

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private getButton(buttonIndex: number): MouseButton {
    switch (buttonIndex) {
      case 0: return 'left';
      case 1: return 'middle';
      case 2: return 'right';
      default: return 'left';
    }
  }

  private updateMousePosition(e: MouseEvent): void {
    const rect = this.element.getBoundingClientRect();
    this.state.mouseX = e.clientX - rect.left;
    this.state.mouseY = e.clientY - rect.top;
  }

  private updateModifiers(e: MouseEvent | KeyboardEvent): void {
    this.state.shift = e.shiftKey;
    this.state.ctrl = e.ctrlKey;
    this.state.alt = e.altKey;
  }

  // =========================================================================
  // Update & Query Methods
  // =========================================================================

  /**
   * Update input state (call once per frame)
   */
  update(deltaTime: number): void {
    // Reset just pressed/released states
    for (const keyState of this.keys.values()) {
      keyState.justPressed = false;
      keyState.justReleased = false;
    }
    
    // Handle edge panning
    if (this.edgePanEnabled) {
      this.handleEdgePan(deltaTime);
    }
    
    // Handle keyboard camera movement
    this.handleKeyboardPan(deltaTime);
  }

  /**
   * Handle edge panning
   */
  private handleEdgePan(deltaTime: number): void {
    const viewport = this.camera.getViewport();
    const speed = EDGE_PAN_SPEED * deltaTime / 16.67;
    
    let panX = 0;
    let panY = 0;
    
    if (this.state.mouseX < EDGE_PAN_THRESHOLD) {
      panX = speed;
    } else if (this.state.mouseX > viewport.width - EDGE_PAN_THRESHOLD) {
      panX = -speed;
    }
    
    if (this.state.mouseY < EDGE_PAN_THRESHOLD) {
      panY = speed;
    } else if (this.state.mouseY > viewport.height - EDGE_PAN_THRESHOLD) {
      panY = -speed;
    }
    
    if (panX !== 0 || panY !== 0) {
      this.camera.pan(panX, panY);
    }
  }

  /**
   * Handle keyboard camera panning
   */
  private handleKeyboardPan(deltaTime: number): void {
    const speed = 300 * deltaTime / 1000;
    
    let panX = 0;
    let panY = 0;
    
    if (this.isKeyDown('w') || this.isKeyDown('arrowup')) panY = speed;
    if (this.isKeyDown('s') || this.isKeyDown('arrowdown')) panY = -speed;
    if (this.isKeyDown('a') || this.isKeyDown('arrowleft')) panX = speed;
    if (this.isKeyDown('d') || this.isKeyDown('arrowright')) panX = -speed;
    
    if (panX !== 0 || panY !== 0) {
      this.camera.pan(panX, panY);
    }
    
    // Zoom with +/-
    if (this.isKeyPressed('=') || this.isKeyPressed('+')) {
      this.camera.zoomBy(1);
    }
    if (this.isKeyPressed('-')) {
      this.camera.zoomBy(-1);
    }
  }

  /**
   * Check if a key is currently pressed
   */
  isKeyDown(key: string): boolean {
    return this.keys.get(key.toLowerCase())?.pressed ?? false;
  }

  /**
   * Check if a key was just pressed this frame
   */
  isKeyPressed(key: string): boolean {
    return this.keys.get(key.toLowerCase())?.justPressed ?? false;
  }

  /**
   * Check if a key was just released this frame
   */
  isKeyReleased(key: string): boolean {
    return this.keys.get(key.toLowerCase())?.justReleased ?? false;
  }

  /**
   * Get current input state
   */
  getState(): Readonly<InputState> {
    return this.state;
  }

  /**
   * Get hovered tile position
   */
  getHoveredTile(): GridPosition | null {
    return this.state.hoveredTile;
  }

  /**
   * Enable/disable edge panning
   */
  setEdgePanEnabled(enabled: boolean): void {
    this.edgePanEnabled = enabled;
  }
}
