/* security.js - Anti-F12, Anti-Inspect, Anti-RightClick & PIN Security System */

(function () {
    // ==========================================
    // 0. ROLE DETECTOR & REALTIME SECURITY CHANNEL
    // ==========================================
    function getRoleLabel() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('player')) return 'Người Chơi (Player)';
        if (path.includes('controller')) return 'Bàn Điều Khiển (Controller)';
        if (path.includes('host')) return 'MC Host';
        if (path.includes('projector')) return 'Máy Chiếu (Projector)';
        if (path.includes('answer')) return 'Màn Hình Cửa (Sound/MC)';
        if (path.includes('server')) return 'Máy Chủ (Server)';
        return document.title || 'Màn Hình Game';
    }

    let _secChannel = null;
    function getSecurityChannel() {
        if (_secChannel) return _secChannel;
        if (typeof GameSyncChannel !== 'undefined') {
            _secChannel = new GameSyncChannel('gameshow_money_drop');
        } else if (typeof BroadcastChannel !== 'undefined') {
            _secChannel = new BroadcastChannel('gameshow_money_drop');
        }
        return _secChannel;
    }

    let lastLoggedEvents = {};
    function sendSecurityLogToController(type, title, details) {
        const eventKey = `${type}_${title}`;
        const now = Date.now();
        if (lastLoggedEvents[eventKey] && (now - lastLoggedEvents[eventKey] < 3000)) {
            return; // Cooldown to avoid spam
        }
        lastLoggedEvents[eventKey] = now;

        const channel = getSecurityChannel();
        if (channel) {
            channel.postMessage({
                action: 'security_event',
                data: {
                    type: type,
                    role: getRoleLabel(),
                    title: title,
                    details: details,
                    timestamp: new Date().toTimeString().split(' ')[0]
                }
            });
        }
    }

    // ==========================================
    // 1. DEVTOOLS & SOURCE INSPECTION PROTECTION
    // ==========================================
    
    // Prevent Context Menu (Right Click)
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        showSecurityWarning('⚠️ Thao tác chuột phải (Xem nguồn trang) bị cấm để bảo mật Gameshow!');
        sendSecurityLogToController('inspect_click', 'CỐ TÌNH BẤM CHUỘT PHẢI', `Thao tác chuột phải (Xem nguồn / Inspect element).`);
        return false;
    });

    // Prevent Key Shortcuts for Inspecting / Saving
    document.addEventListener('keydown', function (e) {
        // F12
        if (e.keyCode === 123 || e.key === 'F12') {
            e.preventDefault();
            showSecurityWarning('⚠️ Phím F12 (Developer Tools) bị vô hiệu hóa!');
            sendSecurityLogToController('f12_key', 'CỐ TÌNH BẤM PHÍM F12', `Phát hiện thao tác bấm phím F12 (Developer Tools).`);
            return false;
        }
        // Ctrl + Shift + I / J / C
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) {
            e.preventDefault();
            showSecurityWarning('⚠️ Phím tắt Developer Tools bị vô hiệu hóa!');
            sendSecurityLogToController('f12_key', 'CỐ TÌNH BẤM PHÍM TẮT INSPECT', `Bấm tổ hợp phím Ctrl+Shift+${(e.key||'').toUpperCase()} mở Developer Tools.`);
            return false;
        }
        // Cmd + Option + I / J / C (Mac)
        if (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67 || e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c')) {
            e.preventDefault();
            showSecurityWarning('⚠️ Phím tắt Developer Tools bị vô hiệu hóa!');
            sendSecurityLogToController('f12_key', 'CỐ TÌNH BẤM PHÍM TẮT INSPECT (MAC)', `Bấm tổ hợp phím Cmd+Opt+${(e.key||'').toUpperCase()} mở Developer Tools.`);
            return false;
        }
        // Ctrl + U (View Source)
        if (e.ctrlKey && (e.keyCode === 85 || e.key === 'U' || e.key === 'u')) {
            e.preventDefault();
            showSecurityWarning('⚠️ Xem nguồn trang (Ctrl+U) bị vô hiệu hóa!');
            sendSecurityLogToController('f12_key', 'CỐ TÌNH XEM CODE NGUỒN (CTRL+U)', `Bấm Ctrl+U mở View Source.`);
            return false;
        }
        // Ctrl + S (Save Page)
        if (e.ctrlKey && (e.keyCode === 83 || e.key === 'S' || e.key === 's')) {
            e.preventDefault();
            showSecurityWarning('⚠️ Lưu trang web bị vô hiệu hóa!');
            return false;
        }
    });

    // DevTools Open Detection (Window Size Heuristics)
    let devToolsOpen = false;
    function checkDevToolsOpened() {
        const widthThreshold = (window.outerWidth - window.innerWidth) > 160;
        const heightThreshold = (window.outerHeight - window.innerHeight) > 160;
        if ((widthThreshold || heightThreshold) && window.outerWidth > 0 && window.outerHeight > 0) {
            if (!devToolsOpen) {
                devToolsOpen = true;
                sendSecurityLogToController('devtools_open', 'PHÁT HIỆN DÙNG F12 / DEVTOOLS', `Cửa sổ Developer Tools (Console / Inspect) đang mở trên màn hình.`);
            }
        } else {
            devToolsOpen = false;
        }
    }
    window.addEventListener('resize', checkDevToolsOpened);
    setInterval(checkDevToolsOpened, 2500);

    // Tab Switch & Window Focus Detection
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            sendSecurityLogToController('tab_switch', 'CHUYỂN TAB / RỜI MÀN HÌNH', `Đã chuyển sang Tab khác hoặc thu nhỏ trình duyệt (Rời khỏi màn hình game).`);
        } else {
            sendSecurityLogToController('tab_return', 'QUAY LẠI TÀI KHOẢN GAME', `Đã quay trở lại tab màn hình game.`);
        }
    });

    window.addEventListener('blur', function () {
        if (!document.hidden) {
            sendSecurityLogToController('window_blur', 'RỜI TIÊU ĐIỂM (FOCUS)', `Con trỏ / Tiêu điểm bị rời khỏi màn hình game (Mở ứng dụng khác).`);
        }
    });

    // Toast Alert Generator
    function showSecurityWarning(msg) {
        let warningEl = document.getElementById('security-warning-toast');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'security-warning-toast';
            warningEl.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #da3633 0%, #8e1519 100%);
                color: #ffffff;
                padding: 12px 24px;
                border-radius: 10px;
                font-family: 'Segoe UI', system-ui, sans-serif;
                font-size: 14px;
                font-weight: 700;
                box-shadow: 0 8px 24px rgba(218, 54, 51, 0.5), 0 0 20px rgba(0,0,0,0.8);
                border: 1px solid #f85149;
                z-index: 999999;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
                text-align: center;
                letter-spacing: 0.5px;
            `;
            document.body.appendChild(warningEl);
        }
        warningEl.innerText = msg;
        warningEl.style.opacity = '1';
        warningEl.style.transform = 'translateX(-50%) translateY(0)';
        
        clearTimeout(window._secWarningTimer);
        window._secWarningTimer = setTimeout(() => {
            if (warningEl) {
                warningEl.style.opacity = '0';
                warningEl.style.transform = 'translateX(-50%) translateY(-20px)';
            }
        }, 2500);
    }

    window.showSecurityWarning = showSecurityWarning;

    // ==========================================
    // 2. PIN CODE SECURITY MANAGEMENT SYSTEM
    // ==========================================

    const DEFAULT_PINS = {
        player: '1234',
        controller: '8888',
        host: '6666'
    };

    // Helper to get active PIN for a role
    function getRolePin(role) {
        const savedPins = localStorage.getItem('gameshow_role_pins');
        if (savedPins) {
            try {
                const parsed = JSON.parse(savedPins);
                if (parsed && parsed[role]) return String(parsed[role]);
            } catch (e) {}
        }
        return DEFAULT_PINS[role] || '1234';
    }

    // Helper to check if PIN requirement is enabled globally
    function isPinSecurityEnabled() {
        const enabled = localStorage.getItem('gameshow_pin_security_enabled');
        return enabled !== 'false'; // Enabled by default
    }

    // System to Initialize PIN Modal Lock
    function initPinProtection(role, roleTitle) {
        if (!role || !roleTitle) return;

        // Listen for realtime PIN updates or logout signals
        if (window.GameSyncChannel && !window._pinSyncChannel) {
            window._pinSyncChannel = new window.GameSyncChannel('gameshow_money_drop');
            window._pinSyncChannel.onmessage = function(event) {
                if (!event.data) return;
                const { action, data } = event.data;

                if (action === 'update_pins') {
                    if (data && data.pins) {
                        localStorage.setItem('gameshow_role_pins', JSON.stringify(data.pins));
                        if (typeof data.enabled !== 'undefined') {
                            localStorage.setItem('gameshow_pin_security_enabled', data.enabled ? 'true' : 'false');
                        }
                    }
                    // Re-verify session with new PIN
                    verifyOrLock();
                }

                if (action === 'logout_all_sessions') {
                    sessionStorage.removeItem(`auth_pin_${role}`);
                    verifyOrLock();
                }
            };
        }

        function verifyOrLock() {
            if (!isPinSecurityEnabled()) {
                removeLockOverlay();
                return;
            }

            const activePin = getRolePin(role);
            const userSessionAuth = sessionStorage.getItem(`auth_pin_${role}`);

            if (userSessionAuth === activePin) {
                removeLockOverlay();
            } else {
                showLockOverlay(role, roleTitle, activePin);
            }
        }

        // Run verification on initial load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', verifyOrLock);
        } else {
            verifyOrLock();
        }
    }

    function removeLockOverlay() {
        const modal = document.getElementById('pin-lock-modal-overlay');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
            }, 300);
        }
    }

    function showLockOverlay(role, roleTitle, correctPin) {
        let modal = document.getElementById('pin-lock-modal-overlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pin-lock-modal-overlay';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(5, 8, 12, 0.96);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 999990;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #ffffff;
                transition: opacity 0.3s ease;
            `;

            modal.innerHTML = `
                <div id="pin-modal-card" style="
                    background: #161b22;
                    border: 2px solid #30363d;
                    border-radius: 16px;
                    padding: 32px 36px;
                    width: 90%;
                    max-width: 420px;
                    text-align: center;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.8), 0 0 30px rgba(241, 224, 90, 0.15);
                    position: relative;
                ">
                    <div style="
                        width: 64px;
                        height: 64px;
                        background: linear-gradient(135deg, #f1e05a 0%, #d4a72c 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 18px;
                        box-shadow: 0 0 20px rgba(241, 224, 90, 0.4);
                        font-size: 28px;
                    ">🔒</div>

                    <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: 0.5px;">XÁC NHẬN MÃ PIN</h2>
                    <p style="font-size: 13px; color: #8b949e; margin-bottom: 22px;">
                        Vui lòng nhập mã PIN cho vai trò <strong style="color: #f1e05a;">${roleTitle}</strong>
                    </p>

                    <div style="margin-bottom: 20px; position: relative;">
                        <input type="password" id="pin-input-field" maxlength="10" placeholder="••••" style="
                            width: 100%;
                            background: #0d1117;
                            border: 2px solid #30363d;
                            border-radius: 10px;
                            padding: 14px;
                            font-size: 28px;
                            text-align: center;
                            letter-spacing: 8px;
                            color: #ffffff;
                            outline: none;
                            transition: all 0.3s ease;
                            font-family: monospace;
                        " autocomplete="off" />
                        <div id="pin-error-text" style="
                            color: #f85149;
                            font-size: 12px;
                            font-weight: 700;
                            margin-top: 8px;
                            min-height: 18px;
                            display: none;
                        ">Mã PIN không đúng. Vui lòng thử lại!</div>
                    </div>

                    <button id="pin-submit-btn" style="
                        width: 100%;
                        background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
                        color: #ffffff;
                        border: 1px solid #3fb950;
                        border-radius: 10px;
                        padding: 14px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 14px rgba(46, 160, 67, 0.4);
                    ">XÁC NHẬN VÀO TRANG</button>

                    <div style="margin-top: 18px; font-size: 11px; color: #6e7681;">
                        💡 Quản lý hoặc cài đặt lại mã PIN tại trang <strong style="color: #58a6ff;">server.html</strong>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const input = modal.querySelector('#pin-input-field');
            const submitBtn = modal.querySelector('#pin-submit-btn');
            const errorText = modal.querySelector('#pin-error-text');
            const card = modal.querySelector('#pin-modal-card');

            input.focus();

            const handleSubmit = () => {
                const val = input.value.trim();
                const currentCorrectPin = getRolePin(role);

                if (val === currentCorrectPin) {
                    sessionStorage.setItem(`auth_pin_${role}`, currentCorrectPin);
                    errorText.style.display = 'none';
                    removeLockOverlay();
                } else {
                    errorText.style.display = 'block';
                    errorText.innerText = '❌ Mã PIN không chính xác. Vui lòng thử lại!';
                    input.style.borderColor = '#f85149';
                    input.value = '';
                    input.focus();

                    // Shake animation
                    card.style.transform = 'translateX(-10px)';
                    setTimeout(() => card.style.transform = 'translateX(10px)', 80);
                    setTimeout(() => card.style.transform = 'translateX(-6px)', 160);
                    setTimeout(() => card.style.transform = 'translateX(6px)', 240);
                    setTimeout(() => card.style.transform = 'translateX(0)', 320);
                }
            };

            submitBtn.addEventListener('click', handleSubmit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSubmit();
                input.style.borderColor = '#30363d';
            });
        }
    }

    // Expose functions on window
    window.initPinProtection = initPinProtection;
    window.getRolePin = getRolePin;
    window.isPinSecurityEnabled = isPinSecurityEnabled;

})();
