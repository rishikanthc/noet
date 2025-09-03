import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Build to the Go backend static dir
export default defineConfig({
  plugins: [react()],
  cacheDir: resolve(__dirname, '.vite'),
  build: {
    outDir: resolve(__dirname, '../backend/static'),
    emptyOutDir: true
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '../../')]
    }
  }
})
