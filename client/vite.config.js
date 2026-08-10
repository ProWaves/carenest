import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ensure-redirects',
      closeBundle() {
        const src = resolve(__dirname, 'public/_redirects');
        const destDir = resolve(__dirname, 'dist');
        const dest = resolve(destDir, '_redirects');
        
        // Ensure dist exists
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        
        // Copy _redirects to dist
        if (existsSync(src)) {
          copyFileSync(src, dest);
          console.log('✅ _redirects copied to dist');
        } else {
          // Create _redirects directly in dist
          const fs = require('fs');
          fs.writeFileSync(dest, '/* /index.html 200');
          console.log('✅ _redirects created in dist');
        }
      }
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://sitterspot-backend.onrender.com',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://sitterspot-backend.onrender.com',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://sitterspot-backend.onrender.com',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
