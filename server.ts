import express from 'express';
import path from 'path';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable Gzip compression for high performance
app.use(compression());

// JSON and URLencoded parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date() });
});

// ==========================================
// CENTRALIZED GAMESHOW RUNTIME STATE STORAGE
// ==========================================
interface PlayerPresence {
  id: string;
  lastSeen: number;
  ip: string;
  viaLink: boolean;
  roomid?: string;
}

let activeConnectedPlayers: Map<string, PlayerPresence> = new Map();

let gameState: {
  activePlayerRoomId: string;
  activePlayerAuth: string;
  playerBaseUrlMode: string;
  activeHostRoomId: string;
  activeHostAuth: string;
  hostBaseUrlMode: string;
  currentPin: string;
  gameSettings: {
    timerSeconds: number;
    initialStacks: number;
    stackValue: number;
    currencyUnit: string;
    totalQuestions: number;
    betDelaySeconds: number;
    showScreenFrames: boolean;
    maxConnectedPlayers: number;
    questionTimers: number[];
  };
  currentRound: number;
  lastMcBetsData: {
    b1: number;
    b2: number;
    b3: number;
    b4: number;
    totalMoney: number | null;
    totalStacks: number | null;
  };
  lastUpdated: number;
} = {
  activePlayerRoomId: 'R' + Math.floor(1000 + Math.random() * 9000),
  activePlayerAuth: Math.random().toString(36).substring(2, 8).toLowerCase(),
  playerBaseUrlMode: 'github',
  activeHostRoomId: 'HR' + Math.floor(1000 + Math.random() * 9000),
  activeHostAuth: 'mchost_' + Math.random().toString(36).substring(2, 8).toLowerCase(),
  hostBaseUrlMode: 'origin',
  currentPin: '1234',
  gameSettings: {
    timerSeconds: 60,
    initialStacks: 40,
    stackValue: 25000,
    currencyUnit: '$A',
    totalQuestions: 8,
    betDelaySeconds: 0.125,
    showScreenFrames: true,
    maxConnectedPlayers: 1,
    questionTimers: [60, 60, 60, 60, 60, 60, 60, 60]
  },
  currentRound: 1,
  lastMcBetsData: { b1: 0, b2: 0, b3: 0, b4: 0, totalMoney: null, totalStacks: null },
  lastUpdated: Date.now()
};

function purgeStalePlayers() {
  const now = Date.now();
  for (const [id, p] of activeConnectedPlayers.entries()) {
    if (now - p.lastSeen > 12000) {
      activeConnectedPlayers.delete(id);
    }
  }
}

app.get('/api/game-state', (_req, res) => {
  purgeStalePlayers();
  res.json({
    ...gameState,
    connectedPlayersCount: activeConnectedPlayers.size,
    connectedPlayers: Array.from(activeConnectedPlayers.values())
  });
});

app.post('/api/game-state', (req, res) => {
  const updates = req.body || {};
  if (updates.activePlayerRoomId) gameState.activePlayerRoomId = updates.activePlayerRoomId;
  if (updates.activePlayerAuth) gameState.activePlayerAuth = updates.activePlayerAuth;
  if (updates.playerBaseUrlMode) gameState.playerBaseUrlMode = updates.playerBaseUrlMode;
  if (updates.activeHostRoomId) gameState.activeHostRoomId = updates.activeHostRoomId;
  if (updates.activeHostAuth) gameState.activeHostAuth = updates.activeHostAuth;
  if (updates.hostBaseUrlMode) gameState.hostBaseUrlMode = updates.hostBaseUrlMode;
  if (updates.currentPin) gameState.currentPin = updates.currentPin;
  if (updates.currentRound !== undefined) gameState.currentRound = updates.currentRound;
  if (updates.gameSettings) {
    gameState.gameSettings = {
      ...gameState.gameSettings,
      ...updates.gameSettings
    };
  }
  if (updates.lastMcBetsData) {
    gameState.lastMcBetsData = {
      ...gameState.lastMcBetsData,
      ...updates.lastMcBetsData
    };
  }
  gameState.lastUpdated = Date.now();
  res.json({ status: 'ok', state: gameState });
});

// Player connection & ping heartbeat endpoint
app.post('/api/player-presence/ping', (req, res) => {
  purgeStalePlayers();
  const { senderId, roomid, viaLink } = req.body || {};
  if (!senderId) {
    return res.status(400).json({ error: 'senderId required' });
  }

  const maxAllowed = gameState.gameSettings.maxConnectedPlayers || 1;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const isExisting = activeConnectedPlayers.has(senderId);

  if (!isExisting && activeConnectedPlayers.size >= maxAllowed) {
    return res.json({
      allowed: false,
      reason: `Số lượng máy Player kết nối đã đạt giới hạn tối đa (${maxAllowed} máy). Vui lòng liên hệ Kỹ thuật/MC để tăng cấu hình kết nối.`,
      currentCount: activeConnectedPlayers.size,
      maxAllowed
    });
  }

  activeConnectedPlayers.set(senderId, {
    id: senderId,
    lastSeen: Date.now(),
    ip: clientIp,
    viaLink: !!viaLink,
    roomid: roomid || gameState.activePlayerRoomId
  });

  return res.json({
    allowed: true,
    currentCount: activeConnectedPlayers.size,
    maxAllowed
  });
});

app.post('/api/player-presence/disconnect', (req, res) => {
  const { senderId } = req.body || {};
  if (senderId) {
    activeConnectedPlayers.delete(senderId);
  }
  purgeStalePlayers();
  res.json({ status: 'ok', currentCount: activeConnectedPlayers.size });
});

app.post('/api/player-presence/reset', (_req, res) => {
  activeConnectedPlayers.clear();
  res.json({ status: 'ok', currentCount: 0 });
});

app.get('/api/player-presence/list', (_req, res) => {
  purgeStalePlayers();
  res.json({
    currentCount: activeConnectedPlayers.size,
    maxAllowed: gameState.gameSettings.maxConnectedPlayers || 1,
    players: Array.from(activeConnectedPlayers.values())
  });
});

// Serve static assets directory with caching
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '1d' }));

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

