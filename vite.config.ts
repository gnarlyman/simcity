import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@rendering': resolve(__dirname, 'src/rendering'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@data': resolve(__dirname, 'src/data'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  
  build: {
    target: 'ES2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          vendor: ['simplex-noise', 'pathfinding', 'eventemitter3'],
        },
      },
    },
  },
  
  optimizeDeps: {
    include: ['pixi.js', 'simplex-noise', 'pathfinding', 'eventemitter3'],
  },
  
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
