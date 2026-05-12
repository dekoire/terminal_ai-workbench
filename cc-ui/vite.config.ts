import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 2002,
    proxy: {
      '/api': { target: 'http://localhost:2003', changeOrigin: false },
      '/ws':  { target: 'ws://localhost:2003',   ws: true },
    },
    watch: {
      // Ignore runtime data dirs so JSONL chat saves don't trigger page reloads
      ignored: ['**/context/**', '**/node_modules/**'],
    },
  },
})
