import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Anatomy OBJ/MTL live on the R2 bucket (proxied by Vercel in prod — see
// vercel.json). Mirror that rewrite for local dev/preview so `/models/segments/*`
// loads through the dev server (same-origin), avoiding the bucket's missing CORS.
const MODELS_PROXY = {
  '/models/segments': {
    target: 'https://pub-4cafc161d51047b8b22ca1a006be74b3.r2.dev',
    changeOrigin: true,
    secure: true,
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: MODELS_PROXY },
  preview: { proxy: MODELS_PROXY },
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
