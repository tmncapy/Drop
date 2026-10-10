<?php
/**
 * GAMESHOW "ĐỪNG ĐỂ TIỀN RƠI" - MEDIA UPLOAD & MANAGER SCRIPT (PHP)
 * Tương thích PHP 7.4, 8.0, 8.1, 8.2, 8.3
 * Tự động tạo thư mục /uploads/, hỗ trợ tải lên Hình ảnh, Video MP4, xem danh sách và XÓA file.
 */

// Enable CORS for remote domain access from Controller and Projector
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Uploads directory path
$uploadDir = __DIR__ . '/uploads/';
if (!file_exists($uploadDir)) {
    @mkdir($uploadDir, 0777, true);
}

// Base URL helper
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$baseUrl = $protocol . $host . ($scriptDir ? $scriptDir : '') . '/uploads/';

// Helper function: Determine media type
function getMediaType($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $videoExts = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
    if (in_array($ext, $videoExts)) {
        return 'video';
    }
    return 'image';
}

// -------------------------------------------------------------
// 1. API: XỬ LÝ XÓA FILE (DELETE ACTION)
// -------------------------------------------------------------
$action = $_REQUEST['action'] ?? '';
$isAjax = (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest') 
          || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false)
          || isset($_GET['api']) || isset($_POST['api']);

// If JSON body sent
$jsonInput = json_decode(file_get_contents('php://input'), true);
if (is_array($jsonInput)) {
    if (isset($jsonInput['action'])) $action = $jsonInput['action'];
    if (isset($jsonInput['filename'])) $_POST['filename'] = $jsonInput['filename'];
}

if ($action === 'delete') {
    $filename = basename($_POST['filename'] ?? $_GET['filename'] ?? '');
    if (!$filename) {
        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => 'Thiếu tên file cần xóa']);
            exit();
        }
        $errorMsg = 'Thiếu tên file cần xóa!';
    } else {
        $filePath = $uploadDir . $filename;
        if (file_exists($filePath) && is_file($filePath)) {
            if (@unlink($filePath)) {
                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['status' => 'success', 'message' => "Đã xóa file {$filename} thành công"]);
                    exit();
                }
                $successMsg = "Đã xóa file {$filename} thành công!";
            } else {
                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['status' => 'error', 'message' => 'Không có quyền xóa file trên máy chủ']);
                    exit();
                }
                $errorMsg = 'Không thể xóa file. Vui lòng kiểm tra quyền thư mục (CHMOD 777)!';
            }
        } else {
            if ($isAjax) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['status' => 'error', 'message' => 'File không tồn tại trên hệ thống']);
                exit();
            }
            $errorMsg = 'File không tồn tại!';
        }
    }
}

// -------------------------------------------------------------
// 2. API: LẤY DANH SÁCH FILE (LIST ACTION)
// -------------------------------------------------------------
if ($action === 'list') {
    header('Content-Type: application/json; charset=utf-8');
    $files = [];
    if (file_exists($uploadDir)) {
        $scan = scandir($uploadDir);
        foreach ($scan as $file) {
            if ($file === '.' || $file === '..' || substr($file, 0, 1) === '.') continue;
            $filePath = $uploadDir . $file;
            if (is_file($filePath)) {
                $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mov'];
                if (in_array($ext, $allowed)) {
                    $files[] = [
                        'filename' => $file,
                        'url' => $baseUrl . $file,
                        'type' => getMediaType($file),
                        'size' => filesize($filePath),
                        'createdAt' => filemtime($filePath) * 1000
                    ];
                }
            }
        }
    }
    // Sort newest first
    usort($files, function($a, $b) {
        return $b['createdAt'] - $a['createdAt'];
    });
    echo json_encode(['status' => 'success', 'files' => $files]);
    exit();
}

// -------------------------------------------------------------
// 3. API: TẢI FILE LÊN (UPLOAD ACTION)
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errText = 'Lỗi upload mã: ' . $file['error'];
        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['status' => 'error', 'message' => $errText]);
            exit();
        }
        $errorMsg = $errText;
    } else {
        $origName = basename($file['name']);
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mov'];

        if (!in_array($ext, $allowedExts)) {
            $msg = 'Định dạng file không được hỗ trợ. Chỉ chấp nhận Ảnh (JPG, PNG, GIF, WEBP) và Video (MP4, WEBM, MOV).';
            if ($isAjax) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['status' => 'error', 'message' => $msg]);
                exit();
            }
            $errorMsg = $msg;
        } else {
            // Safe filename
            $cleanBase = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
            $cleanBase = substr($cleanBase, 0, 40);
            $newFileName = time() . '_' . mt_rand(1000, 9999) . '_' . $cleanBase . '.' . $ext;
            $destination = $uploadDir . $newFileName;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                @chmod($destination, 0644);
                $fullUrl = $baseUrl . $newFileName;
                $mediaType = getMediaType($newFileName);

                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'status' => 'success',
                        'url' => $fullUrl,
                        'filename' => $newFileName,
                        'originalName' => $origName,
                        'type' => $mediaType,
                        'size' => filesize($destination)
                    ]);
                    exit();
                }
                $successMsg = "Tải file lên thành công: {$origName}";
            } else {
                $msg = 'Không thể lưu file vào thư mục uploads/. Vui lòng kiểm tra quyền ghi CHMOD 777.';
                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['status' => 'error', 'message' => $msg]);
                    exit();
                }
                $errorMsg = $msg;
            }
        }
    }
}

// Scan files for Web GUI display
$existingFiles = [];
if (file_exists($uploadDir)) {
    $scan = scandir($uploadDir);
    foreach ($scan as $f) {
        if ($f === '.' || $f === '..' || substr($f, 0, 1) === '.') continue;
        $fp = $uploadDir . $f;
        if (is_file($fp)) {
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mov'];
            if (in_array($ext, $allowed)) {
                $existingFiles[] = [
                    'filename' => $f,
                    'url' => $baseUrl . $f,
                    'type' => getMediaType($f),
                    'size' => filesize($fp),
                    'time' => filemtime($fp)
                ];
            }
        }
    }
}
usort($existingFiles, function($a, $b) { return $b['time'] - $a['time']; });
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ Thống Tải & Quản Lý Media Gameshow (PHP Upload)</title>
    <style>
        :root {
            --bg-dark: #0f172a;
            --panel-bg: #1e293b;
            --border-color: #334155;
            --primary: #f59e0b;
            --primary-hover: #d97706;
            --danger: #ef4444;
            --text-light: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-light);
            padding: 24px;
            min-height: 100vh;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
        }
        h1 {
            font-size: 22px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .badge {
            background: #eab308;
            color: #000;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .alert {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .alert-success { background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #4ade80; }
        .alert-danger { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; }

        .upload-card {
            background: var(--panel-bg);
            border: 2px dashed var(--border-color);
            border-radius: 12px;
            padding: 32px 20px;
            text-align: center;
            margin-bottom: 30px;
            transition: all 0.2s;
        }
        .upload-card:hover {
            border-color: var(--primary);
        }
        .upload-card input[type="file"] {
            display: none;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        .btn-primary { background: var(--primary); color: #000; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid var(--danger); padding: 6px 12px; font-size: 12px; }
        .btn-danger:hover { background: var(--danger); color: #fff; }
        .btn-copy { background: #334155; color: #fff; padding: 6px 12px; font-size: 12px; }
        .btn-copy:hover { background: #475569; }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }
        .media-card {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: transform 0.2s;
        }
        .media-card:hover {
            transform: translateY(-2px);
            border-color: #64748b;
        }
        .media-preview {
            width: 100%;
            height: 180px;
            background: #090d16;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .media-preview img, .media-preview video {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .media-body {
            padding: 14px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .media-name {
            font-size: 13px;
            font-weight: 600;
            color: #f1f5f9;
            word-break: break-all;
            margin-bottom: 6px;
        }
        .media-meta {
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 12px;
        }
        .media-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid #334155;
            padding-top: 10px;
        }
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #10b981;
            color: #fff;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 9999;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>📁 Quản Lý Media & Video Gameshow <span class="badge">PHP Script</span></h1>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    Thư mục lưu trữ: <code>/uploads/</code> | Hỗ trợ Hình ảnh (JPG, PNG, GIF, WEBP) & Video (MP4, WEBM)
                </p>
            </div>
            <div>
                <a href="index.html" class="btn btn-copy" style="font-size: 13px;">Quay lại Gameshow</a>
            </div>
        </header>

        <?php if (!empty($successMsg)): ?>
            <div class="alert alert-success">✅ <?php echo htmlspecialchars($successMsg); ?></div>
        <?php endif; ?>
        <?php if (!empty($errorMsg)): ?>
            <div class="alert alert-danger">❌ <?php echo htmlspecialchars($errorMsg); ?></div>
        <?php endif; ?>

        <!-- Form Tải Lên -->
        <div class="upload-card">
            <form action="upload.php" method="POST" enctype="multipart/form-data" id="upload-form">
                <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Kéo & Thả hoặc Chọn file Ảnh / Video MP4</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 18px;">
                    Dung lượng tối đa tùy thuộc cấu hình <code>upload_max_filesize</code> trên server của bạn.
                </p>
                <input type="file" name="file" id="file-input" accept="image/*,video/mp4,video/webm" onchange="document.getElementById('upload-form').submit()">
                <button type="button" class="btn btn-primary" onclick="document.getElementById('file-input').click()">
                    ⬆️ Chọn Ảnh hoặc Video Tải Lên
                </button>
            </form>
        </div>

        <!-- Danh Sách Media -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="font-size: 18px;">Danh sách Media Đã Tải Lên (<?php echo count($existingFiles); ?>)</h2>
            <span style="font-size: 12px; color: var(--text-muted);">Bấm "Sao chép Link" để dán vào câu hỏi MC</span>
        </div>

        <?php if (empty($existingFiles)): ?>
            <div style="background: var(--panel-bg); border-radius: 8px; padding: 40px; text-align: center; color: var(--text-muted);">
                Chưa có hình ảnh hoặc video nào được tải lên trong thư mục <code>/uploads/</code>.
            </div>
        <?php else: ?>
            <div class="grid">
                <?php foreach ($existingFiles as $item): ?>
                    <div class="media-card">
                        <div class="media-preview">
                            <?php if ($item['type'] === 'video'): ?>
                                <video src="<?php echo htmlspecialchars($item['url']); ?>" controls preload="metadata"></video>
                            <?php else: ?>
                                <img src="<?php echo htmlspecialchars($item['url']); ?>" alt="Media" loading="lazy">
                            <?php endif; ?>
                        </div>
                        <div class="media-body">
                            <div>
                                <div class="media-name" title="<?php echo htmlspecialchars($item['filename']); ?>">
                                    <?php echo htmlspecialchars($item['filename']); ?>
                                </div>
                                <div class="media-meta">
                                    Loại: <strong style="color: var(--primary);"><?php echo strtoupper($item['type']); ?></strong> | 
                                    Size: <?php echo round($item['size'] / (1024 * 1024), 2); ?> MB | 
                                    Ngày: <?php echo date("d/m/Y H:i", $item['time']); ?>
                                </div>
                            </div>
                            <div class="media-actions">
                                <button type="button" class="btn btn-copy" onclick="copyLink('<?php echo htmlspecialchars($item['url']); ?>')">
                                    📋 Sao chép Link
                                </button>
                                <form action="upload.php" method="POST" onsubmit="return confirm('Bạn có chắc chắn muốn xóa file này không? Thao tác này không thể hoàn tác!')" style="margin: 0;">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="filename" value="<?php echo htmlspecialchars($item['filename']); ?>">
                                    <button type="submit" class="btn btn-danger">
                                        🗑️ Xóa File
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <div class="toast" id="toast">Đã sao chép link vào bộ nhớ tạm!</div>

    <script>
        function copyLink(url) {
            navigator.clipboard.writeText(url).then(() => {
                const toast = document.getElementById('toast');
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 2500);
            }).catch(e => {
                prompt("Sao chép link dưới đây:", url);
            });
        }
    </script>
</body>
</html>
