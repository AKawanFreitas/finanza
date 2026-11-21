import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 4747}`,
        // O formato curto do proxy usa changeOrigin: true, que troca o cabeçalho Host pelo da API.
        // A API compara o Origin do navegador com o Host (proteção CSRF), então o Host original
        // (localhost:5173) precisa chegar intacto, senão todo POST/PUT/DELETE em desenvolvimento dá 403.
        changeOrigin: false,
      },
    },
  },
})
