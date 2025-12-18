
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Manual definition of process.env is removed to follow guidelines as the API_KEY is injected automatically.
  server: {
    // historyApiFallback is not a valid property in Vite's ServerOptions.
    // Vite handles history API fallback for Single Page Applications (SPAs) by default during development.
  }
});
