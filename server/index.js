import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// REST API routes (supports both /api and /canteen-module/api)
app.use('/api', apiRoutes);
app.use('/canteen-module/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});
app.get('/canteen-module/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Serve frontend in production if built
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use('/canteen-module', express.static(distPath));

// For React Router HTML5 History fallback in production (Express 5 compatible)
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/canteen-module/api') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/canteen-module/health')
  ) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Not Found');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Smart Canteen Server] Backend listening on http://localhost:${PORT}`);
  console.log(`[Smart Canteen Server] API endpoints available at http://localhost:${PORT}/api`);
  console.log(`[Smart Canteen Server] Base path: http://localhost:${PORT}/canteen-module/`);
});

export default app;
