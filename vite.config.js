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
    // The desktop terminal is lazy-loaded. Its split CSS preload can fail on
    // production deployment transitions, preventing React from ever mounting.
    // Ship one versioned CSS asset with the entry HTML, not a second stylesheet
    // loaded during the authenticated terminal's dynamic import.
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        v4ChartPreview: 'v4-chart-preview.html',
        // Public mock pages are available only on isolated Firebase PR channels.
        // The production site exposes ONLY the authenticated URL-gated audit.
        ...(process.env.VITE_ACG_PUBLIC_DOCK_PREVIEW === 'true' ? {
          v4DockPreview: 'v4-dock-preview.html',
          v4FullTerminalReview: 'v4-positions-audit.html',
        } : {}),
      },
    },
  },
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
})
