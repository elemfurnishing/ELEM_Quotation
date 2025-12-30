import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external access from mobile devices
    port: 5173,
    strictPort: false,
    open: false,
  },
  optimizeDeps: {
    // exclude: ['lucide-react'], // REMOVED: Causing ERR_INSUFFICIENT_RESOURCES
  },
});