import { defineConfig } from 'vite';

// In development the Socket.IO server runs separately (port 3001); proxy it so the
// client can always connect to its own origin.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
