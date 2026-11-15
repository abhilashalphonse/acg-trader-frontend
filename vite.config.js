import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import process from 'node:process'

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        v4ChartPreview: 'v4-chart-preview.html',
        v4DockPreview: 'v4-dock-preview.html',
        // Ship the mock terminal fixture only for the explicitly isolated PR review.
        ...(process.env.VITE_ACG_PUBLIC_DOCK_PREVIEW === 'true' ? { v4FullTerminalReview: 'v4-positions-audit.html' } : {}),
      },
    },
  },
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
})
