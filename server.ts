import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configure upload directory and multer
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, '_')
      .substring(0, 50);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${uniqueSuffix}-${cleanBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit for high quality media/video
});

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

// ==========================================
// MEDIA UPLOAD, LIST & DELETE API
// ==========================================
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Vui lòng chọn file để tải lên.' });
  }
  const ext = path.extname(req.file.filename).toLowerCase();
  const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].includes(ext) || req.file.mimetype.startsWith('video/');
  const mediaType = isVideo ? 'video' : 'image';
  const fileUrl = `/uploads/${req.file.filename}`;

  return res.json({
    status: 'success',
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    type: mediaType,
    size: req.file.size
  });
});

app.get('/api/media-list', (_req, res) => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return res.json({ status: 'success', files: [] });
    }
    const files = fs.readdirSync(uploadDir);
    const mediaFiles = files
      .filter(f => !f.startsWith('.') && fs.statSync(path.join(uploadDir, f)).isFile())
      .map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
        return {
          filename,
          url: `/uploads/${filename}`,
          type: isVideo ? 'video' : 'image',
          size: stats.size,
          createdAt: stats.mtimeMs
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return res.json({ status: 'success', files: mediaFiles });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Không thể đọc danh sách file.' });
  }
});

app.post('/api/delete-media', (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tên file cần xóa.' });
    }
    const safeName = path.basename(filename);
    const targetPath = path.join(uploadDir, safeName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return res.json({ status: 'success', message: `Đã xóa file ${safeName} thành công.` });
    } else {
      return res.status(404).json({ status: 'error', message: 'File không tồn tại trên hệ thống.' });
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Lỗi khi xóa file: ' + (err as Error).message });
  }
});

// Serve static assets directory with caching
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '1d' }));

// ==========================================
// AUTHORITATIVE REAL-TIME GAME STATE & WS SYNC
// ==========================================
interface ConnectedRoleClient {
  id: string;
  role: string;
  ip: string;
  connectedAt: number;
  lastPing: number;
  ws: WebSocket;
}

const connectedRoleClients: Map<string, ConnectedRoleClient> = new Map();

const realtimeGameState = {
  currentRound: 1,
  doorRule: 4,
  topics: { topicA: 'CHỦ ĐỀ A', topicB: 'CHỦ ĐỀ B', active: false, selected: null as string | null },
  question: { text: '', mediaType: 'none', mediaUrl: '', mediaKey: 'active_main_media' },
  answers: { '1': '', '2': '', '3': '', '4': '' } as Record<string, string>,
  answersRevealed: false,
  mediaStage: 'none' as 'center' | 'center-compact' | 'left' | 'left-compact' | 'none',
  clock: { status: 'reset' as string, time: 60, timestamp: Date.now(), sfxFile: '' },
  trapdoors: { '1': false, '2': false, '3': false, '4': false } as Record<string, boolean>,
  winningMoney: { shown: false, amount: '0 $A' },
  progressOverlay: { shown: false, remaining: '', money: '' },
  currentPin: '1234',
  volume: 1.0,
  lastUpdated: Date.now()
};

function getOnlineRolesSummary() {
  const summary: Record<string, number> = {
    projector: 0,
    controller: 0,
    host: 0,
    player: 0,
    answer: 0,
    unknown: 0
  };
  for (const client of connectedRoleClients.values()) {
    const r = client.role || 'unknown';
    summary[r] = (summary[r] || 0) + 1;
  }
  return summary;
}

function broadcastToClients(msgObj: any, excludeWs?: WebSocket) {
  const jsonStr = typeof msgObj === 'string' ? msgObj : JSON.stringify(msgObj);
  for (const client of connectedRoleClients.values()) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(jsonStr);
      } catch (err) {
        console.warn('WS broadcast error:', err);
      }
    }
  }
}

function processIncomingGameAction(payload: any, sourceWs?: WebSocket) {
  if (!payload) return;
  const action = payload.action || payload.type;
  const data = payload.data || {};
  realtimeGameState.lastUpdated = Date.now();

  switch (action) {
    case 'show_topics':
      realtimeGameState.topics = {
        topicA: data.topicA || 'CHỦ ĐỀ A',
        topicB: data.topicB || 'CHỦ ĐỀ B',
        active: true,
        selected: null
      };
      break;

    case 'lock_topic':
      realtimeGameState.topics.selected = data.type || null;
      break;

    case 'update_content':
      if (data.type === 'question') {
        const qText = (data.data && data.data.question) !== undefined ? data.data.question : (data.question || '');
        const mType = data.mediaType || (data.data && data.data.mediaType) || 'none';
        const mUrl = data.mediaUrl || (data.data && data.data.mediaUrl) || '';
        const mKey = data.mediaKey || (data.data && data.data.mediaKey) || 'active_main_media';

        realtimeGameState.question = { text: qText, mediaType: mType, mediaUrl: mUrl, mediaKey: mKey };
        if (mType !== 'none') {
          realtimeGameState.mediaStage = (!qText.trim()) ? 'center' : 'left';
        } else {
          realtimeGameState.mediaStage = 'none';
        }
      }
      break;

    case 'show_media':
      realtimeGameState.mediaStage = 'center';
      if (data.mediaType) realtimeGameState.question.mediaType = data.mediaType;
      if (data.mediaUrl) realtimeGameState.question.mediaUrl = data.mediaUrl;
      if (data.mediaKey) realtimeGameState.question.mediaKey = data.mediaKey;
      break;

    case 'update_single_answer':
      if (data.id) {
        realtimeGameState.answers[String(data.id)] = data.text || '';
      }
      break;

    case 'show_all_q_and_a':
      realtimeGameState.answersRevealed = true;
      if (realtimeGameState.question.mediaType !== 'none') {
        realtimeGameState.mediaStage = (!realtimeGameState.question.text.trim()) ? 'center-compact' : 'left-compact';
      }
      break;

    case 'change_round':
      realtimeGameState.currentRound = parseInt(data.roundNum) || parseInt(data.round) || 1;
      realtimeGameState.doorRule = parseInt(data.round) || 4;
      realtimeGameState.trapdoors = { '1': false, '2': false, '3': false, '4': false };
      realtimeGameState.answersRevealed = false;
      realtimeGameState.topics.active = false;
      realtimeGameState.topics.selected = null;
      break;

    case 'timer_control':
      realtimeGameState.clock.status = data.status || 'reset';
      if (data.time !== undefined && data.time !== null) {
        realtimeGameState.clock.time = parseInt(data.time) || 0;
      }
      if (data.sfxFile) realtimeGameState.clock.sfxFile = data.sfxFile;
      realtimeGameState.clock.timestamp = Date.now();
      break;

    case 'timer_tick':
      realtimeGameState.clock.time = Math.max(0, parseInt(data.time) || 0);
      realtimeGameState.clock.timestamp = Date.now();
      break;

    case 'open_door':
      if (data.doorId) {
        realtimeGameState.trapdoors[String(data.doorId)] = true;
      }
      break;

    case 'reset_round':
      realtimeGameState.topics.active = false;
      realtimeGameState.topics.selected = null;
      realtimeGameState.question = { text: '', mediaType: 'none', mediaUrl: '', mediaKey: 'active_main_media' };
      realtimeGameState.answers = { '1': '', '2': '', '3': '', '4': '' };
      realtimeGameState.answersRevealed = false;
      realtimeGameState.mediaStage = 'none';
      realtimeGameState.trapdoors = { '1': false, '2': false, '3': false, '4': false };
      realtimeGameState.clock = { status: 'reset', time: 60, timestamp: Date.now(), sfxFile: '' };
      realtimeGameState.winningMoney.shown = false;
      break;

    case 'show_winning_money':
      realtimeGameState.winningMoney = { shown: true, amount: data.amount || '0 $A' };
      break;

    case 'hide_winning_money':
      realtimeGameState.winningMoney.shown = false;
      break;

    case 'show_progress':
      realtimeGameState.progressOverlay = { shown: true, remaining: data.remaining || '', money: data.money || '' };
      break;

    case 'hide_progress':
      realtimeGameState.progressOverlay.shown = false;
      break;

    case 'update_pin':
      if (data.pin) realtimeGameState.currentPin = data.pin;
      break;

    case 'set_volume':
      if (data.volume !== undefined) realtimeGameState.volume = data.volume;
      break;
  }

  // Broadcast to all other connected clients
  broadcastToClients(payload, sourceWs);
}

// Initialize native WebSocketServer on /ws
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const clientId = 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  let clientRole = 'unknown';
  try {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    clientRole = urlObj.searchParams.get('role') || 'unknown';
  } catch (e) {}

  const clientInfo: ConnectedRoleClient = {
    id: clientId,
    role: clientRole,
    ip: clientIp,
    connectedAt: Date.now(),
    lastPing: Date.now(),
    ws
  };
  connectedRoleClients.set(clientId, clientInfo);

  console.log(`🔌 [WS CONNECT] Client ${clientId} connected from ${clientIp} (Role: ${clientRole}). Total: ${connectedRoleClients.size}`);

  // Send full authoritative state snapshot to the newly connected client
  try {
    ws.send(JSON.stringify({
      action: 'sync_full_state',
      data: {
        state: realtimeGameState,
        rolesOnline: getOnlineRolesSummary()
      },
      _senderId: 'server',
      _msgId: 'init_' + Date.now(),
      timestamp: Date.now()
    }));
  } catch (err) {}

  // Broadcast updated roles presence to all clients
  broadcastToClients({
    action: 'roles_presence_update',
    data: {
      roles: getOnlineRolesSummary(),
      totalClients: connectedRoleClients.size
    },
    _senderId: 'server',
    timestamp: Date.now()
  });

  // Handle incoming messages from this client
  ws.on('message', (dataRaw: Buffer | string) => {
    try {
      const payload = JSON.parse(dataRaw.toString());
      if (!payload) return;

      if (payload.action === 'register_role' || payload.type === 'register_role') {
        const newRole = (payload.data && payload.data.role) || payload.role;
        if (newRole) {
          clientInfo.role = newRole;
          console.log(`🏷️ Client ${clientId} registered as: ${newRole}`);
          broadcastToClients({
            action: 'roles_presence_update',
            data: {
              roles: getOnlineRolesSummary(),
              totalClients: connectedRoleClients.size
            },
            _senderId: 'server',
            timestamp: Date.now()
          });
        }
        return;
      }

      if (payload.action === 'ping' || payload.type === 'ping') {
        clientInfo.lastPing = Date.now();
        ws.send(JSON.stringify({ action: 'pong', timestamp: Date.now() }));
        return;
      }

      processIncomingGameAction(payload, ws);
    } catch (e) {
      console.warn('WS message parse error:', e);
    }
  });

  ws.on('close', () => {
    connectedRoleClients.delete(clientId);
    console.log(`🔌 [WS DISCONNECT] Client ${clientId} disconnected. Total: ${connectedRoleClients.size}`);
    broadcastToClients({
      action: 'roles_presence_update',
      data: {
        roles: getOnlineRolesSummary(),
        totalClients: connectedRoleClients.size
      },
      _senderId: 'server',
      timestamp: Date.now()
    });
  });

  ws.on('error', (err) => {
    console.warn(`⚠️ WS Client ${clientId} error:`, err);
  });
});

// Periodic heartbeat ping to keep sockets alive and purge dead connections
setInterval(() => {
  for (const [id, client] of connectedRoleClients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.ping();
      } catch (e) {
        connectedRoleClients.delete(id);
      }
    } else {
      connectedRoleClients.delete(id);
    }
  }
}, 20000);

// HTTP Real-time Fallback Endpoints
app.post('/api/realtime/broadcast', (req, res) => {
  const payload = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Payload required' });
  }
  processIncomingGameAction(payload);
  return res.json({ status: 'ok', state: realtimeGameState });
});

app.get('/api/realtime/state', (_req, res) => {
  return res.json({
    status: 'ok',
    state: realtimeGameState,
    rolesOnline: getOnlineRolesSummary(),
    totalClients: connectedRoleClients.size
  });
});

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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gameshow Server running on http://0.0.0.0:${PORT} (WebSocket at /ws)`);
  });
}

startServer();

