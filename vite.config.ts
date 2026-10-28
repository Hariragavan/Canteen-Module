import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import http from 'node:http'
import { spawn, ChildProcess } from 'node:child_process'

let backendProcess: ChildProcess | null = null

function ensureBackendRunning() {
  const req = http.get('http://127.0.0.1:5000/health', () => {
    // Backend is already active and healthy
  })

  req.on('error', () => {
    if (!backendProcess) {
      console.log('\x1b[36m[Backend Auto-Launcher]\x1b[0m Starting Express MongoDB backend (server/index.js)...')
      backendProcess = spawn('node', ['server/index.js'], {
        stdio: 'inherit',
        shell: true,
      })

      process.on('exit', () => {
        if (backendProcess) backendProcess.kill()
      })
      process.on('SIGINT', () => {
        if (backendProcess) backendProcess.kill()
        process.exit()
      })
    }
  })
}

// https://vite.dev/config/
export default defineConfig({
  base: '/canteen-module/',
  plugins: [
    react(),
    {
      name: 'root-redirect',
      configureServer(server) {
        // Auto-start backend if not already running
        ensureBackendRunning()

        server.middlewares.use((req, res, next) => {
          // Prevent 304 Not Modified by stripping caching conditional headers
          delete req.headers['if-none-match']
          delete req.headers['if-modified-since']
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')

          const url = req.url || ''
          if (url === '/' || url === '') {
            res.writeHead(302, { Location: '/canteen-module/' })
            res.end()
            return
          }
          if (url.startsWith('/admin')) {
            res.writeHead(302, { Location: '/canteen-module/admin' })
            res.end()
            return
          }
          if (url.startsWith('/kitchen-analysis')) {
            res.writeHead(302, { Location: '/canteen-module/kitchen-analysis' })
            res.end()
            return
          }
          if (url.startsWith('/staff-counter')) {
            res.writeHead(302, { Location: '/canteen-module/staff-counter' })
            res.end()
            return
          }
          if (url.startsWith('/kiosk')) {
            res.writeHead(302, { Location: '/canteen-module/kiosk' })
            res.end()
            return
          }
          next()
        })

        server.httpServer?.on('close', () => {
          if (backendProcess) backendProcess.kill()
        })
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Backend server is starting up...', isConnected: false }))
            }
          })
        },
      },
      '/canteen-module/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/canteen-module\/api/, '/api'),
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Backend server is starting up...', isConnected: false }))
            }
          })
        },
      },
    },
  },
})

