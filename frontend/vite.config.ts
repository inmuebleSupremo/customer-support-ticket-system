import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const backendOrigin = environment.RESOLVEDESK_BACKEND_ORIGIN || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: backendOrigin, changeOrigin: true },
        '/api-docs': { target: backendOrigin, changeOrigin: true },
        '/swagger-ui': { target: backendOrigin, changeOrigin: true }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts'
    }
  }
})
