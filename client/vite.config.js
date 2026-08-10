import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          axios: ['axios'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
});
