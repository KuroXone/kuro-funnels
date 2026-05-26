import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read port from root .env — single source of truth for port config.
// Falls back to 5173 if the file or variable is missing.
function loadRootEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf-8')
    const match = raw.match(/^FRONTEND_PORT\s*=\s*(\d+)/m)
    return match ? parseInt(match[1], 10) : 5173
  } catch {
    return 5173
  }
}

const FRONTEND_PORT = loadRootEnv()

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.BACKEND_PORT || '8000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: FRONTEND_PORT,
      strictPort: true,   // error instead of silently jumping to a different port
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
