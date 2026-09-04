import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// JSON and URLencoded parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date() });
});

// Serve static assets directory
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ==========================================
// VITE MIDDLEWARE / PRODUCTION STATIC SERVER
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use(express.static(process.cwd()));
    app.get('*', (req, res) => {
      const distIndex = path.join(distPath, 'index.html');
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gameshow Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

