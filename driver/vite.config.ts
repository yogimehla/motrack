import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4012,
    proxy: {
      '/api': 'http://localhost:4010',
    },
  },
});
