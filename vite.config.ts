import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative URLs, so the build runs from any folder or host path, not
  // just a site root.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
