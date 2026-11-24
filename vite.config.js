import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  optimizeDeps: {
    include: ['@novnc/novnc'],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || '127.0.0.1',
    hmr: host
      ? { protocol: 'ws', host, port: 5174, overlay: false }
      : { overlay: false },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'https://zerologic.lokanesa.com',
        changeOrigin: true,
        secure: true,
      },
      '/console': {
        target: 'https://zerologic.lokanesa.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
