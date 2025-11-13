import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow Docker access
    port: 5173,
    watch: {
      usePolling: true, // Enable hot reload in Docker
    },
  },
})
