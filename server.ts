import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const app = express();
const PORT = 3000;

// Directory setup
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'questions');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Auto-populate default excel files from root directory if available
const populateDefaultFiles = () => {
  const rootFiles = fs.readdirSync(process.cwd());
  rootFiles.forEach((file) => {
    if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
      const srcPath = path.join(process.cwd(), file);
      const destPath = path.join(UPLOADS_DIR, file);
      if (!fs.existsSync(destPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[Server] Copied sample question file to uploads: ${file}`);
        } catch (e) {
          console.warn(`[Server] Failed to copy ${file}:`, e);
        }
      }
    }
  });
};

populateDefaultFiles();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    let originalName = file.originalname;
    try {
      // Fix potential Latin1 encoding issue from browser FormData
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {}

    // Clean name while preserving ext
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\sàáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳỵỷỹ]/gi, '_');
    const safeName = `${baseName}_${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng Excel (.xlsx, .xls)'));
    }
  },
});

// JSON and URLencoded parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Active selected question file state
let activeQuestionFile: { filename: string; originalName: string; updatedAt: number } | null = null;

// ==========================================
// API ROUTES FOR QUESTIONS MANAGEMENT
// ==========================================

// 1. Get list of uploaded question files
app.get('/api/questions/list', (_req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ success: true, files: [], activeFile: activeQuestionFile });
    }

    const fileNames = fs.readdirSync(UPLOADS_DIR);
    const files = fileNames
      .filter((file) => file.endsWith('.xlsx') || file.endsWith('.xls'))
      .map((fileName) => {
        const filePath = path.join(UPLOADS_DIR, fileName);
        const stats = fs.statSync(filePath);
        return {
          filename: fileName,
          originalName: fileName.replace(/_\d+\.(xlsx|xls)$/i, '.$1'),
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          modifiedAt: stats.mtime,
          url: `/api/questions/file/${encodeURIComponent(fileName)}`,
        };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    res.json({
      success: true,
      files,
      activeFile: activeQuestionFile,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Upload question file to server
app.post('/api/questions/upload', (req, res) => {
  upload.single('questionFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy file gửi lên' });
    }

    const savedFile = req.file;
    let displayName = savedFile.originalname;
    try {
      displayName = Buffer.from(savedFile.originalname, 'latin1').toString('utf8');
    } catch (e) {}

    const fileInfo = {
      filename: savedFile.filename,
      originalName: displayName,
      size: savedFile.size,
      sizeFormatted: `${(savedFile.size / 1024).toFixed(1)} KB`,
      modifiedAt: new Date(),
      url: `/api/questions/file/${encodeURIComponent(savedFile.filename)}`,
    };

    activeQuestionFile = {
      filename: savedFile.filename,
      originalName: displayName,
      updatedAt: Date.now(),
    };

    console.log(`[Server] Question file uploaded: ${savedFile.filename}`);

    res.json({
      success: true,
      message: 'Nạp file đề thi lên server thành công!',
      file: fileInfo,
      activeFile: activeQuestionFile,
    });
  });
});

// 3. Serve/Download raw Excel question file
app.get('/api/questions/file/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File không tồn tại trên server' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete question file on server
app.delete('/api/questions/file/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (activeQuestionFile && activeQuestionFile.filename === filename) {
      activeQuestionFile = null;
    }

    res.json({
      success: true,
      message: `Đã xóa file ${filename} khỏi server`,
      activeFile: activeQuestionFile,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Select active server question file
app.post('/api/questions/select', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Thiếu tên file' });
    }

    const filePath = path.join(UPLOADS_DIR, path.basename(filename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File không tồn tại trên server' });
    }

    activeQuestionFile = {
      filename: path.basename(filename),
      originalName: filename.replace(/_\d+\.(xlsx|xls)$/i, '.$1'),
      updatedAt: Date.now(),
    };

    res.json({
      success: true,
      message: 'Đã chọn file đề thi làm dữ liệu mặc định trên server',
      activeFile: activeQuestionFile,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Get active question file
app.get('/api/questions/active', (_req, res) => {
  res.json({
    success: true,
    activeFile: activeQuestionFile,
  });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date() });
});

// Serve static assets directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/SFX', express.static(path.join(process.cwd(), 'SFX')));

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Gameshow Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
