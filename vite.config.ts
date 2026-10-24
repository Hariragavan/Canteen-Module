import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/canteen-module/',
  plugins: [
    react(),
    {
      name: 'root-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (url === '/' || url === '') {
            res.writeHead(302, { Location: '/canteen-module/' });
            res.end();
            return;
          }
          if (url.startsWith('/admin')) {
            res.writeHead(302, { Location: '/canteen-module/admin' });
            res.end();
            return;
          }
          if (url.startsWith('/kitchen-analysis')) {
            res.writeHead(302, { Location: '/canteen-module/kitchen-analysis' });
            res.end();
            return;
          }
          if (url.startsWith('/staff-counter')) {
            res.writeHead(302, { Location: '/canteen-module/staff-counter' });
            res.end();
            return;
          }
          if (url.startsWith('/kiosk')) {
            res.writeHead(302, { Location: '/canteen-module/kiosk' });
            res.end();
            return;
          }
          next();
        });
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
      },
      '/canteen-module/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/canteen-module\/api/, '/api'),
      },
    },
  },
})

