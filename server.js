import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date() });
});

// Serve assets
const distPath = path.join(process.cwd(), 'dist');
const hasDist = fs.existsSync(distPath);

if (hasDist) {
  app.use(express.static(distPath));
}

// Serve root directory files (html, css, js, images)
app.use(express.static(process.cwd()));
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// SPA & HTML Fallback
app.get('*', (req, res) => {
  const distIndex = path.join(distPath, 'index.html');
  if (hasDist && fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.sendFile(path.join(process.cwd(), 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Gameshow Server running on port ${PORT}`);
});
