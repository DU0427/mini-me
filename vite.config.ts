import { defineConfig } from 'vite'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  root: 'src/renderer',
  plugins: [
    renderer(),
  ],
  build: {
    outDir: '../../dist',
  },
  base: './',
})
