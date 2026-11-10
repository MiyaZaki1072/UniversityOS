import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:preview` produces one self-contained HTML file (used for design review).
// Normal `npm run build` produces the regular multi-file bundle served behind Django.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
}))
