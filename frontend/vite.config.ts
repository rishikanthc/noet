import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Build to the Go backend static dir and allow importing from ../../quill
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@quill': resolve(__dirname, '../../quill/src'),
    },
  },
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

