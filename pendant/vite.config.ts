import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The pendant is served by the Circle server at /pendant/.
// In dev (npm run dev), API and live traffic go to the Circle server on port 8787.
export default defineConfig(() => {
  return {
    base: '/pendant/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': 'http://localhost:8787',
        '/ws': { target: 'ws://localhost:8787', ws: true },
      },
    },
  };
});
