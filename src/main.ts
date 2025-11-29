/**
 * SimCity Clone - Main Entry Point
 * 
 * This is the entry point for the game application.
 * It initializes the game engine, renderer, and starts the game loop.
 */

import { Application, Graphics, Text, TextStyle } from 'pixi.js';

// Game configuration
const CONFIG = {
  // Display
  backgroundColor: 0x1a1a2e,
  
  // Tile dimensions (isometric 2:1)
  tileWidth: 64,
  tileHeight: 32,
  
  // Map
  defaultMapSize: 64,
  
  // Simulation
  simulationTickMs: 100,
};

/**
 * Initialize and start the game
 */
async function main(): Promise<void> {
  console.log('SimCity Clone - Initializing...');
  
  // Hide loading indicator
  const loadingElement = document.getElementById('loading');
  
  // Get canvas element
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }
  
  // Initialize PixiJS application
  const app = new Application();
  
  try {
    await app.init({
      canvas,
      background: CONFIG.backgroundColor,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
  } catch (e) {
    console.error('Failed to init PixiJS:', e);
    throw e;
  }
  
  // Hide loading indicator after initialization
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  console.log('PixiJS initialized:', app.screen.width, 'x', app.screen.height);
  
  // Add a test graphic to verify rendering works
  const graphics = new Graphics();
  
  // Draw an isometric tile at the center of the screen
  const centerX = app.screen.width / 2;
  const centerY = app.screen.height / 2;
  
  // Draw a simple isometric grid for testing
  drawIsometricGrid(graphics, centerX, centerY, 10, 10);
  
  app.stage.addChild(graphics);
  
  // Display initialization message
  const style = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 0xffffff,
    align: 'center',
  });
  
  const text = new Text({
    text: 'SimCity Clone - Engine Ready\nPress any key to start',
    style,
  });
  text.anchor.set(0.5);
  text.x = centerX;
  text.y = 50;
  app.stage.addChild(text);
  
  // Set up game loop
  app.ticker.add(() => {
    // Game update logic will go here
    // For now, just a placeholder
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    // Renderer auto-resizes, but we may need to update camera/UI
    console.log('Window resized:', window.innerWidth, 'x', window.innerHeight);
  });
  
  console.log('Game ready!');
}

/**
 * Draw an isometric grid for testing
 */
function drawIsometricGrid(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  gridWidth: number,
  gridHeight: number
): void {
  const tileW = CONFIG.tileWidth;
  const tileH = CONFIG.tileHeight;
  
  // Calculate world to screen transform for isometric view
  const worldToScreen = (wx: number, wy: number) => ({
    x: centerX + (wx - wy) * (tileW / 2),
    y: centerY + (wx + wy) * (tileH / 2) - (gridHeight * tileH / 2),
  });
  
  // Draw tiles
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const pos = worldToScreen(x, y);
      
      // Alternate colors for checkerboard pattern
      const isEven = (x + y) % 2 === 0;
      const fillColor = isEven ? 0x2d5a27 : 0x3d7a37; // Green grass colors
      
      // Draw isometric tile using PixiJS v8 API
      graphics.poly([
        pos.x, pos.y - tileH / 2,           // Top
        pos.x + tileW / 2, pos.y,           // Right
        pos.x, pos.y + tileH / 2,           // Bottom
        pos.x - tileW / 2, pos.y,           // Left
      ]);
      graphics.fill(fillColor);
      graphics.stroke({ color: 0x1a3a17, width: 1 });
    }
  }
}

// Start the application
main().catch((error) => {
  console.error('Failed to initialize game:', error);
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.textContent = `Error: ${error.message}`;
    loadingElement.style.color = '#ff4444';
  }
});
