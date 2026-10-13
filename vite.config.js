import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port API harus sama dengan `PORT` pada server Express (lihat server/index.js).
const API_PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000)
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: WEB_PORT,
    proxy: {
      // Semua request /api diteruskan ke server Express.
      // Target memakai 127.0.0.1 (bukan "localhost") supaya tidak bergantung
      // pada urutan resolusi IPv6/IPv4 — di Windows "localhost" sering
      // diarahkan ke ::1 lebih dulu dan membuat proxy gagal terhubung.
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
