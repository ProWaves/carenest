import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      closeBundle() {
        const src = path.resolve(__dirname, 'public/_redirects');
        const dest = path.resolve(__dirname, 'dist/_redirects');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log('✅ _redirects copied to dist');
        } else {
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