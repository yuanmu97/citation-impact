import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/citation-impact/',
  server: {
    proxy: {
      '/scholar-proxy': {
        target: 'https://scholar.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scholar-proxy/, ''),
      },
    },
  },
})
