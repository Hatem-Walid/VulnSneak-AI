// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      three: path.resolve('./node_modules/three'),
    },
    // ✅ Fix: Force a single copy of React — prevents the useState crash
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // ✅ Fix: HMR WebSocket was failing because browser was on 5174
    // while server was on 5173. This pins the WS to the correct port.
    hmr: {
      port: 5173,
    },
  },
});