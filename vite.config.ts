import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative URLs, so the build runs from any folder or host path, not
  // just a site root.
  base: './',
})
