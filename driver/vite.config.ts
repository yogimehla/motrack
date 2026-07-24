import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Required for Capacitor: assets need relative paths in the native WebView
  base: './',
  server: {
    port: 4012,
    proxy: {
      '/api': 'http://localhost:4010',
    },
  },
});
