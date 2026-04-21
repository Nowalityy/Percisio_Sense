import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // PERF: Isolate heavy runtime libs to improve cache hit rate.
        manualChunks: {
          'three-core': ['three'],
          'three-addons': [
            'three/examples/jsm/controls/OrbitControls',
            'three/examples/jsm/loaders/GLTFLoader',
            'three/examples/jsm/loaders/DRACOLoader',
          ],
          'react-core': ['react', 'react-dom'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          ui: ['react-window', 'framer-motion'],
        },
      },
    },
  },
})
