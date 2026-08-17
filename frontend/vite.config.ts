import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:8000';

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },
        '/health': {
          target: backend,
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://127.0.0.1:8000',
          ws: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    }
});
