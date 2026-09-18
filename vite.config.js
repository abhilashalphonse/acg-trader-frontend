import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
})
