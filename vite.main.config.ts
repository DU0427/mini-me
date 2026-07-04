import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-electron/main',
    lib: {
      entry: 'src/main/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    minify: false,
    rollupOptions: {
      external: [
        'electron',
        'events',
        'fs',
        'path',
        'uiohook-napi',
        'active-win',
      ],
    },
  },
  resolve: {
    conditions: ['node'],
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})
