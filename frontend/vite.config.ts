import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Build to the Go backend static dir
export default defineConfig({
  plugins: [react()],
  cacheDir: resolve(__dirname, '.vite'),
  build: {
    outDir: resolve(__dirname, '../backend/static'),
    emptyOutDir: true,
    // Optimize for speed over size
    minify: 'esbuild',
    // Reduce chunk splitting for faster loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Bundle all vendor dependencies together
          vendor: ['react', 'react-dom', '@tanstack/react-query'],
          editor: ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit']
        }
      }
    },
    // Increase chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging
    sourcemap: false
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '../../')]
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'lucide-react',
      'marked',
      'katex'
    ]
  }
})
