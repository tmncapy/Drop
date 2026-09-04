const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
const DEFAULT_SETTINGS = {
    timerSeconds: 60,
    initialStacks: 40,
    stackValue: 25000,
    currencyUnit: '$A',
    totalQuestions: 8,
    betDelaySeconds: 0.125,
    showScreenFrames: true,
    questionTimers: [60, 60, 60, 60, 60, 60, 60, 60]
};

let gameSettings = loadGameSettings();

function loadGameSettings() {
    try {
        const saved = localStorage.getItem('game_settings');
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch(e) {}
    return { ...DEFAULT_SETTINGS };
}

// ==========================================
// SYSTEM LOGS & REALTIME MONITORING ENGINE
// ==========================================
let systemLogs = loadSystemLogs();
let activeLogFilter = 'all';

function loadSystemLogs() {
    try {
        const saved = localStorage.getItem('gameshow_system_logs');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [{
        id: 'init_log_' + Date.now(),
        timestamp: new Date().toTimeString().split(' ')[0],
        date: new Date().toLocaleDateString('vi-VN'),
        category: 'system',
        title: 'KHỞI TẠO HỆ THỐNG',
        message: 'Hệ thống Bàn Điều Khiển (Controller) sẵn sàng ghi nhận nhật ký.',
        remainingMoney: (gameSettings.initialStacks || 40) * (gameSettings.stackValue || 25000),
        remainingStacks: gameSettings.initialStacks || 40,
        totalLost: 0,
        totalLostStacks: 0
    }];
}

function saveSystemLogs() {
    try {
        if (systemLogs.length > 300) {
            systemLogs = systemLogs.slice(systemLogs.length - 300);
        }
        localStorage.setItem('gameshow_system_logs', JSON.stringify(systemLogs));
    } catch(e) {}
}

function addSystemLog(category, title, message, extraData = {}) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toLocaleDateString('vi-VN');

    const stackVal = gameSettings.stackValue || 25000;
    const initTotal = (gameSettings.initialStacks || 40) * stackVal;
    const currentLost = Math.max(0, initTotal - currentMoneyAmount);

    const logEntry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        timestamp: timeStr,
        date: dateStr,
        category: category, // 'bet', 'lost', 'auth', 'system'
        title: title,
        message: message,
        remainingMoney: currentMoneyAmount,
        remainingStacks: Math.round(currentMoneyAmount / stackVal),
        totalLost: currentLost,
        totalLostStacks: Math.round(currentLost / stackVal),
        ...extraData
    };

    systemLogs.push(logEntry);
    saveSystemLogs();

    renderSystemLogsUI();
    updateLogStatsSummaryUI();
}

function updateLogStatsSummaryUI() {
    const unit = gameSettings.currencyUnit || '$A';
    const stackVal = gameSettings.stackValue || 25000;
    const initTotal = (gameSettings.initialStacks || 40) * stackVal;
    const currentLost = Math.max(0, initTotal - currentMoneyAmount);

    const totalBet = (lastMcBetsData.b1 || 0) + (lastMcBetsData.b2 || 0) + (lastMcBetsData.b3 || 0) + (lastMcBetsData.b4 || 0);

    const remainingEl = document.getElementById('log-stat-remaining');
    const remainingStacksEl = document.getElementById('log-stat-remaining-stacks');
    if (remainingEl) remainingEl.innerText = `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit}`;
    if (remainingStacksEl) remainingStacksEl.innerText = `(${Math.round(currentMoneyAmount / stackVal)} cọc)`;

    const betEl = document.getElementById('log-stat-bet');
    const betStacksEl = document.getElementById('log-stat-bet-stacks');
    if (betEl) betEl.innerText = `${totalBet.toLocaleString('vi-VN')} ${unit}`;
    if (betStacksEl) betStacksEl.innerText = `(${Math.round(totalBet / stackVal)} cọc)`;

    const lostEl = document.getElementById('log-stat-lost');
    const lostStacksEl = document.getElementById('log-stat-lost-stacks');
    if (lostEl) lostEl.innerText = `${currentLost.toLocaleString('vi-VN')} ${unit}`;
    if (lostStacksEl) lostStacksEl.innerText = `(${Math.round(currentLost / stackVal)} cọc)`;

    const authStatusEl = document.getElementById('log-stat-auth-status');
    const authDetailEl = document.getElementById('log-stat-auth-detail');
    if (authStatusEl) authStatusEl.innerText = `🟢 PIN: ${currentPin}`;
    if (authDetailEl) authDetailEl.innerText = `Đã xác thực & Đồng bộ`;
}

function setLogFilter(filterCategory) {
    activeLogFilter = filterCategory;
    const filterBtns = ['all', 'bet', 'lost', 'sec', 'auth', 'system'];
    filterBtns.forEach(cat => {
        const btn = document.getElementById(`log-filter-btn-${cat}`);
        if (btn) {
            if (cat === filterCategory) {
                btn.className = 'btn-blue';
                btn.style.opacity = '1';
            } else {
                btn.className = 'btn-orange';
                btn.style.opacity = '0.6';
            }
        }
    });
    renderSystemLogsUI();
}

function renderSystemLogsUI() {
    const container = document.getElementById('logs-list-container');
    if (!container) return;

    const searchQuery = (document.getElementById('log-search-input')?.value || '').toLowerCase().trim();

    let filtered = systemLogs.filter(log => {
        if (activeLogFilter !== 'all' && log.category !== activeLogFilter) {
            return false;
        }
        if (searchQuery) {
            const matchTitle = (log.title || '').toLowerCase().includes(searchQuery);
            const matchMsg = (log.message || '').toLowerCase().includes(searchQuery);
            const matchTime = (log.timestamp || '').toLowerCase().includes(searchQuery);
            return matchTitle || matchMsg || matchTime;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 40px 0; font-size: 12px;">
                Không có nhật ký log nào phù hợp với bộ lọc hiện tại.
            </div>
        `;
        return;
    }

    const unit = gameSettings.currencyUnit || '$A';

    container.innerHTML = filtered.map(log => {
        let tagBg = '#1e293b';
        let tagColor = '#94a3b8';
        let tagLabel = 'HỆ THỐNG';

        if (log.category === 'bet') {
            tagBg = '#1e3a8a'; tagColor = '#60a5fa'; tagLabel = 'ĐẶT TIỀN';
        } else if (log.category === 'lost') {
            tagBg = '#7f1d1d'; tagColor = '#fca5a5'; tagLabel = 'MẤT TIỀN';
        } else if (log.category === 'auth') {
            tagBg = '#064e3b'; tagColor = '#34d399'; tagLabel = 'ĐĂNG NHẬP / PIN';
        } else if (log.category === 'sec') {
            tagBg = '#7c2d12'; tagColor = '#fb923c'; tagLabel = '⚠️ F12 / TÁC VỤ';
        }

        return `
            <div style="background: #161b22; border: 1px solid #222632; border-left: 3px solid ${tagColor}; border-radius: 4px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="background: ${tagBg}; color: ${tagColor}; font-size: 9px; font-weight: bold; padding: 1px 6px; border-radius: 3px;">
                            [${tagLabel}]
                        </span>
                        <strong style="color: #f3f4f6; font-size: 11px;">${log.title}</strong>
                    </div>
                    <span style="color: #64748b; font-size: 10px;">🕒 ${log.timestamp} (${log.date})</span>
                </div>
                <div style="color: #cbd5e1; font-size: 11px; line-height: 1.4;">
                    ${log.message}
                </div>
                <div style="display: flex; gap: 12px; font-size: 10px; color: #94a3b8; border-top: 1px dashed #222632; padding-top: 3px; margin-top: 2px;">
                    <span>💰 Còn lại: <strong style="color: #38bdf8;">${(log.remainingMoney || 0).toLocaleString('vi-VN')} ${unit}</strong> (${log.remainingStacks || 0} cọc)</span>
                    <span>📉 Tổng mất: <strong style="color: #f85149;">${(log.totalLost || 0).toLocaleString('vi-VN')} ${unit}</strong> (${log.totalLostStacks || 0} cọc)</span>
                </div>
            </div>
        `;
    }).join('');

    const autoScrollChk = document.getElementById('log-autoscroll-chk');
    if (autoScrollChk && autoScrollChk.checked) {
        container.scrollTop = container.scrollHeight;
    }
}

function clearSystemLogs() {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký log hệ thống?")) {
        systemLogs = [];
        saveSystemLogs();
        addSystemLog('system', 'XÓA NHẬT KÝ', 'Đã xóa sạch nhật ký log hệ thống.');
    }
}

function exportSystemLogsText() {
    if (systemLogs.length === 0) {
        alert("Hiện chưa có dữ liệu log để xuất!");
        return;
    }
    const unit = gameSettings.currencyUnit || '$A';
    let textContent = `====================================================\n`;
    textContent += `   NHẬT KÝ HỆ THỐNG GAMESHOW MONEY DROP (LOGS)\n`;
    textContent += `   Ngày xuất: ${new Date().toLocaleString('vi-VN')}\n`;
    textContent += `====================================================\n\n`;

    systemLogs.forEach((log, index) => {
        textContent += `[#${index + 1}] [${log.timestamp} ${log.date}] [${(log.category || 'system').toUpperCase()}]\n`;
        textContent += `Tiêu đề : ${log.title}\n`;
        textContent += `Nội dung: ${log.message}\n`;
        textContent += `Trạng thái tài chính: Còn lại ${(log.remainingMoney || 0).toLocaleString('vi-VN')} ${unit} (${log.remainingStacks || 0} cọc) | Tổng mất ${(log.totalLost || 0).toLocaleString('vi-VN')} ${unit}\n`;
        textContent += `----------------------------------------------------\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nhat_ky_gameshow_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- DYNAMIC CONTROLLER BUTTON LABELS & TIMERS ---
function updateDynamicControllerButtonLabels() {
    const topicA = (document.getElementById('topic-a')?.value || '').trim();
    const topicB = (document.getElementById('topic-b')?.value || '').trim();

    const btnLockA = document.getElementById('btn-lock-topic-a');
    const btnLockB = document.getElementById('btn-lock-topic-b');
    if (btnLockA) btnLockA.innerText = topicA ? `Chốt A: ${topicA}` : 'Chốt Chủ Đề A';
    if (btnLockB) btnLockB.innerText = topicB ? `Chốt B: ${topicB}` : 'Chốt Chủ Đề B';

    for (let i = 1; i <= 4; i++) {
        const ansVal = (document.getElementById(`ans-${i}`)?.value || '').trim();

        // 1. Single Answer Reveal Button
        const btnReveal = document.getElementById(`btn-reveal-ans-${i}`);
        if (btnReveal) btnReveal.innerText = `Hiện Cửa ${i}`;

        // 2. Trapdoor Checkbox Label
        const chkLabel = document.getElementById(`chk-label-${i}`);
        if (chkLabel) chkLabel.innerText = ansVal ? `Cửa ${i}: ${ansVal}` : `Cửa ${i}`;

        // 3. Single Trapdoor Button
        const btnTrap = document.getElementById(`btn-trap-door-${i}`);
        if (btnTrap) btnTrap.innerText = ansVal ? `SẬP ${i}: ${ansVal}` : `SẬP HỐ LỖI ${i}`;

        // 4. Bet Box Title
        const betTitle = document.getElementById(`mc-bet-title-${i}`);
        if (betTitle) betTitle.innerText = ansVal ? `Cửa ${i} (${ansVal})` : `Cửa ${i}`;
    }
}

function getQuestionTimeLimit(rNum) {
    const roundNum = rNum || getCurrentRoundNumber();

    // 1. First priority: Selected question in Excel dropdown if it has custom timerSeconds
    const selectedQIndexVal = document.getElementById('select-question-index')?.value;
    if (selectedQIndexVal) {
        const [idx] = selectedQIndexVal.split('-');
        if (excelDataStore[idx] && excelDataStore[idx].timerSeconds !== undefined && excelDataStore[idx].timerSeconds !== null && excelDataStore[idx].timerSeconds !== '') {
            const val = parseInt(excelDataStore[idx].timerSeconds);
            if (!isNaN(val) && val > 0) return val;
        }
    }

    // 2. Second priority: Excel store data for this round number
    const roundData = excelDataStore.find(q => Number(q.round) === Number(roundNum));
    if (roundData && roundData.timerSeconds !== undefined && roundData.timerSeconds !== null && roundData.timerSeconds !== '') {
        const val = parseInt(roundData.timerSeconds);
        if (!isNaN(val) && val > 0) return val;
    }

    // 3. Third priority: Custom question timer in gameSettings.questionTimers array
    if (gameSettings.questionTimers && gameSettings.questionTimers[roundNum - 1] !== undefined) {
        const val = parseInt(gameSettings.questionTimers[roundNum - 1]);
        if (!isNaN(val) && val > 0) return val;
    }

    // 4. Default global fallback
    return gameSettings.timerSeconds || 60;
}

function updateTimerForCurrentQuestion() {
    if (!timerInterval) {
        timeLeft = getQuestionTimeLimit();
        updateTimerDisplay();
    }
}

const DEFAULT_QUESTIONS_STORE = [
    { round: 1, topicA: "cd1", topicB: "cd2", questionA: "q1", questionB: "q2", ansA: ["a1", "b1", "c1", "d1"], ansB: ["a2", "b2", "c2", "d2"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 2, topicA: "cd3", topicB: "cd4", questionA: "q3", questionB: "q4", ansA: ["a3", "b3", "c3", "d3"], ansB: ["a4", "b4", "c4", "d4"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 3, topicA: "cd5", topicB: "cd6", questionA: "q1", questionB: "q2", ansA: ["a5", "b5", "c5", "d5"], ansB: ["a6", "b6", "c6", "d6"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 4, topicA: "cd7", topicB: "cd8", questionA: "q3", questionB: "q4", ansA: ["a7", "b7", "c7", "d7"], ansB: ["a8", "b8", "c8", "d8"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 5, topicA: "cd9", topicB: "cd10", questionA: "q1", questionB: "q2", ansA: ["a9", "b9", "c9"], ansB: ["a10", "b10", "c10"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 6, topicA: "cd11", topicB: "cd12", questionA: "q3", questionB: "q4", ansA: ["a11", "b11", "c11"], ansB: ["a12", "b12", "c12"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 7, topicA: "cd13", topicB: "cd14", questionA: "q1", questionB: "q2", ansA: ["a13", "b13", "c13"], ansB: ["a14", "b14", "c14"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' },
    { round: 8, topicA: "cd15", topicB: "cd16", questionA: "q3", questionB: "q4", ansA: ["a15", "b15"], ansB: ["a16", "b16"], mediaTypeA: 'none', mediaUrlA: '', mediaTypeB: 'none', mediaUrlB: '' }
];

let excelDataStore = loadExcelDataStore();

function loadExcelDataStore() {
    try {
        const saved = localStorage.getItem('excel_data_store');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch(e) {}
    return DEFAULT_QUESTIONS_STORE;
}

function saveExcelDataStore() {
    try {
        localStorage.setItem('excel_data_store', JSON.stringify(excelDataStore));
    } catch(e) {}
}
let timeLeft = gameSettings.timerSeconds || 60;
let timerInterval = null;

let currentPin = localStorage.getItem('game_pin') || '1234';

// Progress state tracking
let totalQuestionsCount = gameSettings.totalQuestions || 8;
let questionStates = Array(totalQuestionsCount).fill(false);
if (totalQuestionsCount >= 2) {
    questionStates[0] = true;
    questionStates[1] = true;
}
let currentMoneyAmount = (gameSettings.initialStacks || 40) * (gameSettings.stackValue || 25000);
let isProgressShowingOnProjector = false;

// Global Volume Management
let currentGlobalVolume = localStorage.getItem('game_volume') !== null ? parseFloat(localStorage.getItem('game_volume')) : 1.0;

function setGlobalVolume(vol) {
    currentGlobalVolume = Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
    const percent = Math.round(currentGlobalVolume * 100);
    
    const slider = document.getElementById('volume-slider');
    if (slider) slider.value = percent;
    
    const display = document.getElementById('vol-display-val');
    if (display) display.innerText = `${percent}%`;
    
    localStorage.setItem('game_volume', currentGlobalVolume.toString());
    sendCommand('set_volume', { volume: currentGlobalVolume });
}

function adjustVolume(delta) {
    setGlobalVolume(currentGlobalVolume + delta);
}

function onVolumeSliderChange(val) {
    setGlobalVolume(parseFloat(val) / 100);
}

// Populate dropdown and PIN on load
window.addEventListener('DOMContentLoaded', () => {
    updateQuestionSelector();
    initPinCode();
    populateSettingsFormUI();
    updateControllerMoneyLabels();
    updateProgressDataUI();
    setGlobalVolume(currentGlobalVolume);
    updateDynamicControllerButtonLabels();
    updateTimerForCurrentQuestion();
    renderSystemLogsUI();
    updateLogStatsSummaryUI();
    renderControllerChatHistory();

    const badge = document.getElementById('current-loaded-question-badge');
    if (badge && excelDataStore) {
        badge.innerText = `Đã nạp ${excelDataStore.length} vòng`;
    }
});

function initPinCode() {
    const pinInput = document.getElementById('pin-code-input');
    if (pinInput) {
        pinInput.value = currentPin;
    }
    localStorage.setItem('game_pin', currentPin);
    sendCommand('update_pin', { pin: currentPin });
}

function updatePinCode() {
    const pinInput = document.getElementById('pin-code-input');
    const val = pinInput.value.trim();
    if (!/^\d{4}$/.test(val)) {
        alert("Mã PIN phải là 4 chữ số!");
        pinInput.value = currentPin;
        return;
    }
    currentPin = val;
    localStorage.setItem('game_pin', currentPin);
    sendCommand('update_pin', { pin: currentPin, forceLock: true });
    addSystemLog('auth', 'CẬP NHẬT MÃ PIN', `Đã đổi mã PIN mới thành [${currentPin}]. Đã gửi tín hiệu bắt buộc Player xác nhận lại.`);
    alert(`Đã cập nhật mã PIN mới: ${currentPin} (Đã yêu cầu tất cả Player xác nhận lại)`);
}

function generateRandomPin() {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinInput = document.getElementById('pin-code-input');
    if (pinInput) pinInput.value = randomPin;
    updatePinCode();
}

function forceLockPlayers() {
    localStorage.removeItem('player_auth_pin');
    sendCommand('update_pin', { pin: currentPin, forceLock: true });
    addSystemLog('auth', 'KHÓA MÀN HÌNH PLAYER', `Đã gửi lệnh khóa khẩn cấp toàn bộ màn hình Người Chơi.`);
    alert("Đã gửi lệnh khóa tất cả màn hình Player!");
}

let lastMcBetsData = { b1: 0, b2: 0, b3: 0, b4: 0, totalMoney: null, totalStacks: null };

// Listen to messages from other windows/tabs (e.g., live player bets)
channel.onmessage = function(event) {
    const { action, data } = event.data;
    if (action === 'host_to_tech_msg' && data) {
        handleIncomingHostMessage(data);
    }
    if (action === 'clear_script_chat') {
        handleClearScriptChat(false);
    }
    if (action === 'mqtt_connected' || action === 'request_pin') {
        sendCommand('update_pin', { pin: currentPin });
        sendCommand('set_volume', { volume: currentGlobalVolume });
    }
    if (action === 'player_authenticated') {
        addSystemLog('auth', 'PLAYER XÁC THỰC', `Màn hình Player đã nhập đúng mã PIN và đăng nhập thành công.`);
    }
    if (action === 'request_player_state') {
        addSystemLog('auth', 'KẾT NỐI PLAYER', `Màn hình Player kết nối và gửi yêu cầu đồng bộ.`);
    }
    if (action === 'security_event' && data) {
        addSystemLog('sec', `⚠️ ${data.title || 'CẢNH BÁO BẢO MẬT'}`, `[${data.role || 'Màn Hình'}] ${data.details || ''}`, {
            secType: data.type,
            role: data.role
        });
    }
    if (action === 'sync_bets_to_mc' && data) {
        const prevB1 = lastMcBetsData.b1 || 0;
        const prevB2 = lastMcBetsData.b2 || 0;
        const prevB3 = lastMcBetsData.b3 || 0;
        const prevB4 = lastMcBetsData.b4 || 0;

        lastMcBetsData.b1 = data.b1 || 0;
        lastMcBetsData.b2 = data.b2 || 0;
        lastMcBetsData.b3 = data.b3 || 0;
        lastMcBetsData.b4 = data.b4 || 0;

        if (data.totalMoney !== undefined) {
            currentMoneyAmount = data.totalMoney;
            lastMcBetsData.totalMoney = data.totalMoney;
        }
        if (data.totalStacks !== undefined) {
            lastMcBetsData.totalStacks = data.totalStacks;
        }

        const inputEl = document.getElementById('custom-stacks-input');
        if (inputEl && document.activeElement !== inputEl && data.totalStacks !== undefined) {
            inputEl.value = data.totalStacks;
        }

        // Log bet changes if placement amounts updated
        if (prevB1 !== data.b1 || prevB2 !== data.b2 || prevB3 !== data.b3 || prevB4 !== data.b4) {
            const unit = gameSettings.currencyUnit || '$A';
            const totalBet = (data.b1 || 0) + (data.b2 || 0) + (data.b3 || 0) + (data.b4 || 0);
            const betDetails = `Cửa 1: ${(data.b1||0).toLocaleString('vi-VN')} ${unit} | Cửa 2: ${(data.b2||0).toLocaleString('vi-VN')} ${unit} | Cửa 3: ${(data.b3||0).toLocaleString('vi-VN')} ${unit} | Cửa 4: ${(data.b4||0).toLocaleString('vi-VN')} ${unit}`;
            addSystemLog('bet', 'PLAYER ĐẶT TIỀN', `Đặt cược mới trên bàn: ${betDetails} (Tổng đặt: ${totalBet.toLocaleString('vi-VN')} ${unit}).`, {
                b1: data.b1, b2: data.b2, b3: data.b3, b4: data.b4, totalBet: totalBet
            });
        }

        updateControllerMoneyLabels();
        updateProgressDataUI();
        updateLogStatsSummaryUI();
        if (isProgressShowingOnProjector) {
            showProgressOnProjector();
        }
    }
};

// Periodic heartbeat broadcast every 3s to guarantee cross-device sync
setInterval(() => {
    if (typeof channel !== 'undefined' && channel.postMessage) {
        sendCommand('update_pin', { pin: currentPin });
    }
}, 3000);

function sendCommand(action, data = {}) {
    channel.postMessage({
        action,
        data,
        timestamp: Date.now()
    });
}

function importExcel(element) {
    const file = element.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        parseExcelQuestions(json);
    };
    reader.readAsArrayBuffer(file);
}

function parseExcelQuestions(rows) {
    if (!rows || rows.length < 2) return;

    // Filter out completely empty or header rows
    const cleanRows = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const col0 = String(row[0] || '').trim().toLowerCase();
        const col1 = String(row[1] || '').trim().toLowerCase();
        const col2 = String(row[2] || '').trim().toLowerCase();

        // Skip header rows
        if (col0 === 'vòng' || col1 === 'chủ đề' || col2 === 'câu hỏi' || col1 === 'topic') {
            continue;
        }

        const hasContent = row.some((cell, idx) => idx > 0 && cell !== undefined && cell !== null && String(cell).trim() !== '');
        if (hasContent) {
            cleanRows.push(row);
        }
    }

    if (cleanRows.length === 0) return;

    // Detect Single-Row format vs Multi-Row format
    let isSingleRowFormat = false;
    const sample = cleanRows[0];
    if (sample && sample.length >= 9) {
        const col8Val = String(sample[8] || '').trim().toLowerCase();
        if (col8Val !== '' && !col8Val.includes('hình') && !col8Val.includes('media') && !col8Val.includes('video')) {
            isSingleRowFormat = true;
        }
    }

    excelDataStore = [];

    if (isSingleRowFormat) {
        cleanRows.forEach((row, i) => {
            const rawRound = String(row[0] || '').replace(/\D/g, '');
            const roundNum = rawRound ? parseInt(rawRound) : (i + 1);

            const getAnswers = (r, startCol, endCol) => {
                const arr = [];
                for (let c = startCol; c <= endCol; c++) {
                    const value = r[c];
                    if (value !== undefined && value !== null && String(value).trim() !== "") {
                        arr.push(String(value).trim());
                    }
                }
                return arr;
            };

            excelDataStore.push({
                round: roundNum,
                topicA: String(row[1] || "").trim(),
                topicB: String(row[7] || "").trim(),
                questionA: String(row[2] || "").trim(),
                questionB: String(row[8] || "").trim(),
                ansA: getAnswers(row, 3, 6),
                ansB: getAnswers(row, 9, 12),
                mediaTypeA: row[13] ? (String(row[13]).includes('video') ? 'video' : 'image') : 'none',
                mediaUrlA: row[13] ? String(row[13]).trim() : '',
                mediaTypeB: row[14] ? (String(row[14]).includes('video') ? 'video' : 'image') : 'none',
                mediaUrlB: row[14] ? String(row[14]).trim() : ''
            });
        });
    } else {
        // Multi-Row format (2 consecutive rows per round)
        let currentRound = 1;
        for (let i = 0; i < cleanRows.length; i += 2) {
            const rowA = cleanRows[i];
            const rowB = cleanRows[i + 1];

            if (rowA && rowA[0] !== undefined && rowA[0] !== null) {
                const digits = String(rowA[0]).replace(/\D/g, '');
                if (digits) {
                    currentRound = parseInt(digits);
                }
            }

            const getAnswers = (row) => {
                if (!row) return [];
                const arr = [];
                for (let c = 3; c <= 6; c++) {
                    const value = row[c];
                    if (value !== undefined && value !== null && String(value).trim() !== "") {
                        arr.push(String(value).trim());
                    }
                }
                return arr;
            };

            excelDataStore.push({
                round: currentRound,
                topicA: rowA ? String(rowA[1] || "").trim() : "",
                topicB: rowB ? String(rowB[1] || "").trim() : "",
                questionA: rowA ? String(rowA[2] || "").trim() : "",
                questionB: rowB ? String(rowB[2] || "").trim() : "",
                ansA: getAnswers(rowA),
                ansB: getAnswers(rowB),
                mediaTypeA: (rowA && rowA[7]) ? (String(rowA[7]).includes('video') ? 'video' : 'image') : 'none',
                mediaUrlA: (rowA && rowA[7]) ? String(rowA[7]).trim() : '',
                mediaTypeB: (rowB && rowB[7]) ? (String(rowB[7]).includes('video') ? 'video' : 'image') : 'none',
                mediaUrlB: (rowB && rowB[7]) ? String(rowB[7]).trim() : ''
            });

            currentRound++;
        }
    }

    saveExcelDataStore();
    updateQuestionSelector();

    const badge = document.getElementById('current-loaded-question-badge');
    if (badge) {
        badge.innerText = `Đã nạp ${excelDataStore.length} vòng`;
    }
}

function populateRoundNumSelect() {
    const roundNumSelect = document.getElementById("select-round-num");
    if (!roundNumSelect) return;

    const currentVal = parseInt(roundNumSelect.value) || 1;
    roundNumSelect.innerHTML = "";

    const maxRounds = Math.max(gameSettings.totalQuestions || 8, excelDataStore.length, 8);
    for (let r = 1; r <= maxRounds; r++) {
        const op = document.createElement("option");
        op.value = r;
        op.textContent = `Vòng ${r}`;
        roundNumSelect.appendChild(op);
    }

    roundNumSelect.value = (currentVal <= maxRounds && currentVal >= 1) ? currentVal : 1;
}

function updateQuestionSelector() {
    populateRoundNumSelect();

    const qSelect = document.getElementById("select-question-index");
    if (!qSelect) return;
    qSelect.innerHTML = "";

    const emptyOp = document.createElement("option");
    emptyOp.value = "";
    emptyOp.textContent = "-- Chọn câu hỏi --";
    qSelect.appendChild(emptyOp);

    excelDataStore.forEach((q, index) => {
        if (q.topicA || q.questionA) {
            const opA = document.createElement("option");
            opA.value = index + "-A";
            opA.textContent = `Vòng ${q.round} - Chủ đề A: ${q.topicA || '---'} (${q.questionA || ''})`;
            qSelect.appendChild(opA);
        }

        if (q.topicB || q.questionB) {
            const opB = document.createElement("option");
            opB.value = index + "-B";
            opB.textContent = `Vòng ${q.round} - Chủ đề B: ${q.topicB || '---'} (${q.questionB || ''})`;
            qSelect.appendChild(opB);
        }
    });
}

function handleRoundNumSelectChange() {
    const roundNumSelect = document.getElementById("select-round-num");
    const roundNum = parseInt(roundNumSelect?.value) || 1;

    // Determine default door rule for this round number
    const roundSelect = document.getElementById("select-round");
    let doorRuleVal = "1";
    if (roundNum >= 5 && roundNum <= 7) {
        doorRuleVal = "5";
    } else if (roundNum >= 8) {
        doorRuleVal = "8";
    }
    if (roundSelect) {
        roundSelect.value = doorRuleVal;
    }

    // Load topics for this round from excelDataStore if available
    const idx = excelDataStore.findIndex(q => Number(q.round) === Number(roundNum));
    if (idx !== -1) {
        const data = excelDataStore[idx];
        const topicAEl = document.getElementById('topic-a');
        const topicBEl = document.getElementById('topic-b');
        if (topicAEl) topicAEl.value = data.topicA || "";
        if (topicBEl) topicBEl.value = data.topicB || "";

        // Select the question in select-question-index dropdown if present
        const qSelect = document.getElementById('select-question-index');
        if (qSelect) {
            const opVal = `${idx}-A`;
            if ([...qSelect.options].some(o => o.value === opVal)) {
                qSelect.value = opVal;
            } else {
                qSelect.value = "";
            }
        }
    }

    sendCommand("change_round", { round: parseInt(doorRuleVal), roundNum: roundNum });
    updateTimerForCurrentQuestion();
    updateDynamicControllerButtonLabels();
}

function handleDoorRuleChange() {
    const roundSelect = document.getElementById("select-round");
    const doorRuleVal = parseInt(roundSelect?.value) || 1;
    const roundNum = getCurrentRoundNumber();
    sendCommand("change_round", { round: doorRuleVal, roundNum: roundNum });
    updateTimerForCurrentQuestion();
}

function getMediaUrl() {
    const urlInput = document.getElementById('main-media-url');
    if (!urlInput) return '';
    return urlInput.dataset.fullUrl || urlInput.value || '';
}

function setMediaUrlInput(fullUrl, customDisplayName) {
    const urlInput = document.getElementById('main-media-url');
    if (!urlInput) return;
    urlInput.dataset.fullUrl = fullUrl || '';
    if (!fullUrl) {
        urlInput.value = '';
    } else if (customDisplayName) {
        urlInput.value = customDisplayName;
    } else if (fullUrl.startsWith('data:')) {
        const mime = fullUrl.split(';')[0].split(':')[1] || 'media';
        urlInput.value = `📁 [File ${mime} đã đính kèm]`;
    } else {
        const parts = fullUrl.split('/');
        const fileName = parts[parts.length - 1] || fullUrl;
        urlInput.value = fileName.length > 50 ? (fileName.substring(0, 45) + '...') : fileName;
    }
}

function handleManualMediaUrlInput(el) {
    if (!el) return;
    const val = el.value || '';
    if (!val.startsWith('📁') && !val.startsWith('[File')) {
        el.dataset.fullUrl = val;
    }
    syncMainMediaToStore();
}

function loadSelectedQuestion() {
    const val = document.getElementById('select-question-index').value;
    if (!val) return;
    const [idx, type] = val.split('-');
    const data = excelDataStore[idx];
    if (!data) return;
    
    document.getElementById('topic-a').value = data.topicA || "";
    document.getElementById('topic-b').value = data.topicB || "";
    
    // Auto-update round num and door rule dropdowns
    const roundNum = Number(data.round) || 1;
    const roundNumSel = document.getElementById("select-round-num");
    if (roundNumSel) {
        roundNumSel.value = roundNum;
    }

    const roundSelect = document.getElementById("select-round");
    let doorRuleVal = "1";
    if (roundNum >= 5 && roundNum <= 7) {
        doorRuleVal = "5";
    } else if (roundNum >= 8) {
        doorRuleVal = "8";
    }
    if (roundSelect) roundSelect.value = doorRuleVal;

    sendCommand("change_round", { round: parseInt(doorRuleVal), roundNum: roundNum });

    let questionText = "";
    const mTypeEl = document.getElementById('main-media-type');

    if (type === 'A') {
        questionText = data.questionA || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansA || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeA || 'none';
        setMediaUrlInput(data.mediaUrlA || '');
    } else {
        questionText = data.questionB || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansB || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeB || 'none';
        setMediaUrlInput(data.mediaUrlB || '');
    }

    updateTimerForCurrentQuestion();
    updateDynamicControllerButtonLabels();
}

function syncMainMediaToStore() {
    const val = document.getElementById('select-question-index')?.value;
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = getMediaUrl();

    if (!val) return;
    const [idx, type] = val.split('-');
    const data = excelDataStore[idx];
    if (!data) return;

    if (type === 'A') {
        data.mediaTypeA = mType;
        data.mediaUrlA = mUrl;
    } else {
        data.mediaTypeB = mType;
        data.mediaUrlB = mUrl;
    }
    saveExcelDataStore();
}

// --- VIDEO COMPRESSION HELPERS (480P OPTIMIZATION) ---
function showVideoCompressingModal(fileName) {
    const modal = document.getElementById('video-compress-modal');
    const nameEl = document.getElementById('compress-file-name');
    const statusEl = document.getElementById('compress-status-text');
    const barEl = document.getElementById('compress-bar-fill');
    if (modal) modal.style.display = 'flex';
    if (nameEl) nameEl.innerText = fileName || 'video.mp4';
    if (statusEl) statusEl.innerText = 'Đang khởi tạo bộ nén... 0%';
    if (barEl) barEl.style.width = '0%';
}

function updateVideoCompressingProgress(percent) {
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    const statusEl = document.getElementById('compress-status-text');
    const barEl = document.getElementById('compress-bar-fill');
    if (statusEl) statusEl.innerText = `Đang xử lý nén 480p... ${p}%`;
    if (barEl) barEl.style.width = `${p}%`;
}

function hideVideoCompressingModal() {
    const modal = document.getElementById('video-compress-modal');
    if (modal) modal.style.display = 'none';
}

async function compressVideoTo480p(videoFile, onProgress = () => {}) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.volume = 0;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const fileUrl = URL.createObjectURL(videoFile);
        video.src = fileUrl;

        let resolved = false;
        const fallbackToRaw = () => {
            if (resolved) return;
            resolved = true;
            URL.revokeObjectURL(fileUrl);
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(videoFile);
        };

        const timeoutId = setTimeout(() => {
            console.warn("Video compression timed out, falling back to original file.");
            fallbackToRaw();
        }, 45000);

        video.onloadedmetadata = async () => {
            try {
                const origW = video.videoWidth || 854;
                const origH = video.videoHeight || 480;

                let targetH = 480;
                let targetW = Math.round((origW * targetH) / origH);

                if (origH <= 480 && origW <= 854) {
                    targetW = origW;
                    targetH = origH;
                } else if (origW < origH) {
                    targetW = 480;
                    targetH = Math.round((origH * targetW) / origW);
                    if (targetH > 854) {
                        targetH = 854;
                        targetW = Math.round((origW * targetH) / origH);
                    }
                } else {
                    targetH = 480;
                    targetW = Math.round((origW * targetH) / origH);
                    if (targetW > 854) {
                        targetW = 854;
                        targetH = Math.round((origH * targetW) / origH);
                    }
                }

                targetW = (targetW % 2 === 0) ? targetW : targetW - 1;
                targetH = (targetH % 2 === 0) ? targetH : targetH - 1;

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');

                let stream = canvas.captureStream ? canvas.captureStream(30) : null;
                if (!stream) {
                    fallbackToRaw();
                    clearTimeout(timeoutId);
                    return;
                }

                let audioCtx = null;
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioContextClass) {
                        audioCtx = new AudioContextClass();
                        const source = audioCtx.createMediaElementSource(video);
                        const dest = audioCtx.createMediaStreamDestination();
                        source.connect(dest);
                        source.connect(audioCtx.destination);
                        const audioTrack = dest.stream.getAudioTracks()[0];
                        if (audioTrack) {
                            stream.addTrack(audioTrack);
                        }
                    }
                } catch(e) {
                    console.warn("AudioContext capture info:", e);
                }

                let options = { videoBitsPerSecond: 1000000 };
                if (typeof MediaRecorder !== 'undefined') {
                    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                        options.mimeType = 'video/webm;codecs=vp8,opus';
                    } else if (MediaRecorder.isTypeSupported('video/webm')) {
                        options.mimeType = 'video/webm';
                    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                        options.mimeType = 'video/mp4';
                    }
                } else {
                    fallbackToRaw();
                    clearTimeout(timeoutId);
                    return;
                }

                const mediaRecorder = new MediaRecorder(stream, options);
                const chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    clearTimeout(timeoutId);
                    URL.revokeObjectURL(fileUrl);
                    if (audioCtx) {
                        try { audioCtx.close(); } catch(err) {}
                    }
                    if (resolved) return;

                    const blob = new Blob(chunks, { type: options.mimeType || 'video/webm' });
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolved = true;
                        resolve(reader.result);
                    };
                    reader.onerror = () => fallbackToRaw();
                    reader.readAsDataURL(blob);
                };

                mediaRecorder.start(100);

                const duration = video.duration || 1;
                video.currentTime = 0;
                
                video.play().catch(() => {});

                let animationFrameId = null;

                function renderLoop() {
                    if (video.paused || video.ended || video.currentTime >= duration) {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                        }
                        return;
                    }

                    ctx.drawImage(video, 0, 0, targetW, targetH);
                    const progressPercent = Math.min(99, Math.round((video.currentTime / duration) * 100));
                    onProgress(progressPercent);

                    animationFrameId = requestAnimationFrame(renderLoop);
                }

                video.onended = () => {
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    if (mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                    onProgress(100);
                };

                renderLoop();

            } catch (err) {
                console.error("Compression exception, using raw file:", err);
                clearTimeout(timeoutId);
                fallbackToRaw();
            }
        };

        video.onerror = (e) => {
            console.error("Video load error during compression:", e);
            clearTimeout(timeoutId);
            fallbackToRaw();
        };
    });
}

function handleMainMediaFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const typeSelect = document.getElementById('main-media-type');
    const fileName = file.name ? `📁 ${file.name}` : `📁 [File đính kèm]`;

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1280;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);

                if (typeSelect) typeSelect.value = 'image';
                setMediaUrlInput(compressedUrl, fileName);
                if (window.GameMediaCache) {
                    window.GameMediaCache.set('active_main_media', compressedUrl);
                }
                syncMainMediaToStore();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        showVideoCompressingModal(file.name);
        compressVideoTo480p(file, (percent) => {
            updateVideoCompressingProgress(percent);
        }).then(compressedVideoDataUrl => {
            hideVideoCompressingModal();
            if (typeSelect) typeSelect.value = 'video';
            setMediaUrlInput(compressedVideoDataUrl, `${fileName} (480p)`);
            if (window.GameMediaCache) {
                window.GameMediaCache.set('active_main_media', compressedVideoDataUrl);
            }
            syncMainMediaToStore();
        }).catch(err => {
            console.error("Video compression failed, using original file:", err);
            hideVideoCompressingModal();
            const reader = new FileReader();
            reader.onload = function(e) {
                if (typeSelect) typeSelect.value = 'video';
                setMediaUrlInput(e.target.result, fileName);
                if (window.GameMediaCache) {
                    window.GameMediaCache.set('active_main_media', e.target.result);
                }
                syncMainMediaToStore();
            };
            reader.readAsDataURL(file);
        });
    }
}

function sendMedia() {
    playSfx('SFX/drop_Reveal the Question_2.mp3', false, false);
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = getMediaUrl();

    if (mType === 'none' || !mUrl) {
        alert("Vui lòng chọn loại Media (Hình ảnh / Video) và chọn file/nhập URL trước!");
        return;
    }

    if (window.GameMediaCache && mUrl) {
        window.GameMediaCache.set('active_main_media', mUrl);
    }

    sendCommand('show_media', {
        mediaType: mType,
        mediaUrl: mUrl,
        mediaKey: 'active_main_media'
    });
}

function fillAnswers(ansList) {
    const r = getCurrentRoundNumber();
    let mapDoors = [1, 2, 3, 4];
    if (r >= 5 && r <= 7) {
        mapDoors = [2, 3, 4];
    } else if (r === 8) {
        mapDoors = [2, 3];
    }

    for (let doorId = 1; doorId <= 4; doorId++) {
        const input = document.getElementById("ans-" + doorId);
        if (!input) continue;
        const parentRow = input.closest('.ans-row');
        
        const ansIndex = mapDoors.indexOf(doorId);
        if (ansIndex !== -1 && ansList && ansList[ansIndex] !== undefined && ansList[ansIndex] !== null && String(ansList[ansIndex]).trim() !== "") {
            input.value = ansList[ansIndex];
            if (parentRow) parentRow.style.display = "flex";
            else input.style.display = "block";
        } else {
            input.value = "";
            if (parentRow) parentRow.style.display = "none";
            else input.style.display = "none";
        }
    }
    updateDynamicControllerButtonLabels();
}

function sendTopics() { 
    playSfx('SFX/drop_category.mp3');
    sendCommand("show_topics", {
        topicA: document.getElementById("topic-a").value,
        topicB: document.getElementById("topic-b").value
    });
}

function lockTopic(type) {   
    playSfx('SFX/drop_chosen_category.mp3');
    const topicName = type === "A"
        ? document.getElementById("topic-a").value
        : document.getElementById("topic-b").value;

    sendCommand("lock_topic", {
        type: type,
        topicName: topicName
    });

    loadQuestionForLockedTopic(type);
}

function loadQuestionForLockedTopic(type) {
    const roundNum = getCurrentRoundNumber();
    let idx = -1;
    let data = null;

    // Check if select-question-index has a selection matching this round
    const selVal = document.getElementById('select-question-index')?.value;
    if (selVal) {
        const [sIdx] = selVal.split('-');
        if (excelDataStore[sIdx] && Number(excelDataStore[sIdx].round) === Number(roundNum)) {
            idx = sIdx;
            data = excelDataStore[sIdx];
        }
    }

    if (!data) {
        idx = excelDataStore.findIndex(q => Number(q.round) === Number(roundNum));
        if (idx !== -1) {
            data = excelDataStore[idx];
        }
    }

    if (!data) return;

    const mTypeEl = document.getElementById('main-media-type');

    if (type === 'A') {
        document.getElementById('question-input').value = data.questionA || "";
        fillAnswers(data.ansA || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeA || 'none';
        setMediaUrlInput(data.mediaUrlA || '');
        const qSel = document.getElementById('select-question-index');
        if (qSel) qSel.value = `${idx}-A`;
    } else {
        document.getElementById('question-input').value = data.questionB || "";
        fillAnswers(data.ansB || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeB || 'none';
        setMediaUrlInput(data.mediaUrlB || '');
        const qSel = document.getElementById('select-question-index');
        if (qSel) qSel.value = `${idx}-B`;
    }

    updateTimerForCurrentQuestion();
    updateDynamicControllerButtonLabels();
}

function sendQuestion() { 
    playSfx('SFX/drop_Reveal the Question_2.mp3', false, false);
    const qText = document.getElementById('question-input').value;
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = getMediaUrl();

    if (window.GameMediaCache && mUrl) {
        window.GameMediaCache.set('active_main_media', mUrl);
    }

    sendCommand('update_content', { 
        type: 'question', 
        data: { question: qText, mediaType: mType, mediaUrl: mUrl, mediaKey: 'active_main_media' },
        mediaType: mType,
        mediaUrl: mUrl,
        mediaKey: 'active_main_media'
    }); 
    sendCommand('send_question_text_to_screens', { text: qText });
}

function sendSingleAnswer(id) { 
    const r = getCurrentRoundNumber();
    let minDoorId = 1;
    if (r >= 5) {
        minDoorId = 2;
    }

    if (id === minDoorId) {
        playSfx('SFX/drop_variant.wav', false, false);
    } else {
        playSfx('SFX/drop_variant_2_3_4.mp3', false, false);
    }
    sendCommand('update_single_answer', { 
        id, 
        text: document.getElementById(`ans-${id}`).value 
    }); 
}

function handleRoundChange() {
    const roundVal = document.getElementById("select-round").value;
    const selectedQIndexVal = document.getElementById('select-question-index').value;
    let exactRound = parseInt(roundVal);
    if (selectedQIndexVal) {
        const [idx] = selectedQIndexVal.split('-');
        if (excelDataStore[idx] && excelDataStore[idx].round) {
            exactRound = Number(excelDataStore[idx].round);
        }
    }
    sendCommand("change_round", { round: parseInt(roundVal), roundNum: exactRound });
    updateTimerForCurrentQuestion();
}

function getCurrentRoundNumber() {
    const roundNumSel = document.getElementById('select-round-num')?.value;
    if (roundNumSel) {
        return parseInt(roundNumSel) || 1;
    }
    const selectedQIndexVal = document.getElementById('select-question-index')?.value;
    if (selectedQIndexVal) {
        const [idx] = selectedQIndexVal.split('-');
        if (excelDataStore[idx] && excelDataStore[idx].round) {
            return Number(excelDataStore[idx].round);
        }
    }
    const roundVal = document.getElementById("select-round")?.value;
    return parseInt(roundVal) || 1;
}

function collectMoneyBack() {
    const r = getCurrentRoundNumber();
    if (r >= 1 && r <= 4) {
        playSfx('SFX/drop_moneyback2.mp3');
    } else {
        playSfx('SFX/drop_moneyback.mp3');
    }
    sendCommand('collect_winning');
    hideWinningMoneyOnProjector();
    addSystemLog('system', 'THU TIỀN THẮNG VỀ BÀN', `Đã thu tiền thắng ở các cửa an toàn về bàn chuẩn bị vòng tiếp theo.`);
}

function showWinningMoneyOnProjector() {
    const unit = gameSettings.currencyUnit || '$A';
    sendCommand('show_winning_money', {
        money: currentMoneyAmount,
        moneyText: `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit}`
    });
}

function hideWinningMoneyOnProjector() {
    sendCommand('hide_winning_money');
}

// --- CONTROLLER <-> HOST SCRIPT CHAT LOGIC ---
let unreadChatCount = 0;

function playChatChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        
        osc.start(now);
        osc.stop(now + 0.28);
    } catch(e) {}
}

function getScriptChatHistory() {
    try {
        return JSON.parse(localStorage.getItem('gameshow_script_chat')) || [];
    } catch(e) {
        return [];
    }
}

function saveScriptChatHistory(history) {
    try {
        if (history.length > 60) history = history.slice(-60);
        localStorage.setItem('gameshow_script_chat', JSON.stringify(history));
    } catch(e) {}
}

function escapeChatHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function handleIncomingHostMessage(data) {
    const text = (data && (data.text || data.msg)) || '';
    if (!text) return;

    playChatChime();

    const history = getScriptChatHistory();
    const alreadyExists = data.id && history.some(m => m.id === data.id);
    if (!alreadyExists) {
        const now = new Date();
        const timeStr = data.time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        history.push({
            id: data.id || Date.now(),
            sender: 'host',
            senderName: data.senderName || 'MC HOST',
            text: text,
            msg: text,
            time: timeStr
        });
        saveScriptChatHistory(history);
    }

    renderControllerChatHistory();

    const modal = document.getElementById('controller-chat-modal');
    const isModalOpen = modal && modal.style.display === 'flex';
    if (!isModalOpen) {
        unreadChatCount++;
        updateChatUnreadBadge();
    }

    showControllerChatToast(`💬 MC Host: ${text}`);

    if (typeof addSystemLog === 'function') {
        addSystemLog('system', 'TIN NHẮN TỪ MC HOST', `MC Host: "${text}"`);
    }
}

function renderControllerChatHistory() {
    const inlineBox = document.getElementById('controller-chat-history');
    const modalBox = document.getElementById('modal-chat-history');
    const history = getScriptChatHistory();

    const renderItems = (isModal) => {
        if (history.length === 0) {
            return `<div style="color: #64748b; text-align: center; font-style: italic; margin: auto; font-size: ${isModal ? '13px' : '11px'};">Chưa có tin nhắn nào giữa Host và Phòng Máy.</div>`;
        }

        return history.map(item => {
            const isHost = item.sender === 'host';
            const senderTitle = isHost ? 'MC HOST' : 'KỸ THUẬT';
            const badgeBg = isHost ? '#78350f' : '#1e3a8a';
            const badgeColor = isHost ? '#fef08a' : '#93c5fd';
            const bubbleBg = isHost ? '#1c1917' : '#111827';
            const bubbleBorder = isHost ? '#b45309' : '#1d4ed8';
            const textColor = isHost ? '#fef9c3' : '#f0f9ff';
            const align = isHost ? 'flex-start' : 'flex-end';
            const bubblePadding = isModal ? '6px 12px' : '3px 8px';
            const fontSize = isModal ? '13px' : '11px';

            return `
                <div style="display:flex; flex-direction:column; align-self:${align}; max-width:85%; gap:2px;">
                    <div style="display:flex; gap:4px; align-items:center; font-size:9px; justify-content:${isHost ? 'flex-start' : 'flex-end'}; color:#94a3b8;">
                        <span style="background:${badgeBg}; color:${badgeColor}; padding:1px 4px; border-radius:3px; font-weight:bold;">[${senderTitle}]</span>
                        <span>${item.time || ''}</span>
                    </div>
                    <div style="background:${bubbleBg}; border:1px solid ${bubbleBorder}; color:${textColor}; padding:${bubblePadding}; border-radius:6px; font-size:${fontSize}; word-break:break-word;">
                        ${escapeChatHtml(item.text || item.msg || '')}
                    </div>
                </div>
            `;
        }).join('');
    };

    if (inlineBox) {
        inlineBox.innerHTML = renderItems(false);
        inlineBox.scrollTop = inlineBox.scrollHeight;
    }
    if (modalBox) {
        modalBox.innerHTML = renderItems(true);
        modalBox.scrollTop = modalBox.scrollHeight;
    }
}

function sendMsgToHost(customText) {
    const input = document.getElementById('host-msg-input');
    const text = (typeof customText === 'string' ? customText : (input ? input.value : '')).trim();
    if (!text) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const msgObj = {
        id: Date.now(),
        sender: 'tech',
        senderName: 'KỸ THUẬT',
        text: text,
        msg: text,
        time: timeStr
    };

    const history = getScriptChatHistory();
    history.push(msgObj);
    saveScriptChatHistory(history);
    renderControllerChatHistory();

    sendCommand('tech_to_host_msg', msgObj);

    if (input) input.value = '';

    if (typeof addSystemLog === 'function') {
        addSystemLog('system', 'GỬI TIN ĐẾN HOST', `Kỹ thuật: "${text}"`);
    }
}

function sendQuickTechMsg(preset) {
    sendMsgToHost(preset);
}

function sendModalChatMessage() {
    const input = document.getElementById('modal-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    sendMsgToHost(text);
    input.value = '';
    input.focus();
}

function openControllerChatModal() {
    const modal = document.getElementById('controller-chat-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderControllerChatHistory();
        unreadChatCount = 0;
        updateChatUnreadBadge();
        const input = document.getElementById('modal-chat-input');
        if (input) input.focus();
    }
}

function closeControllerChatModal() {
    const modal = document.getElementById('controller-chat-modal');
    if (modal) {
        modal.style.display = 'none';
        unreadChatCount = 0;
        updateChatUnreadBadge();
    }
}

function updateChatUnreadBadge() {
    const inlineBadge = document.getElementById('controller-unread-badge');
    const tabBadge = document.getElementById('controller-chat-tab-badge');
    if (inlineBadge) {
        if (unreadChatCount > 0) {
            inlineBadge.style.display = 'inline-block';
            inlineBadge.innerText = unreadChatCount;
        } else {
            inlineBadge.style.display = 'none';
        }
    }
    if (tabBadge) {
        if (unreadChatCount > 0) {
            tabBadge.style.display = 'inline-block';
            tabBadge.innerText = unreadChatCount;
        } else {
            tabBadge.style.display = 'none';
        }
    }
}

function showControllerChatToast(text) {
    const container = document.getElementById('controller-chat-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'chat-toast-item';
    toast.innerText = text;
    toast.onclick = () => {
        openControllerChatModal();
        toast.remove();
    };
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

function clearScriptChatHistory() {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trao đổi kịch bản giữa Kỹ Thuật và Host không?")) {
        handleClearScriptChat(true);
    }
}

function handleClearScriptChat(broadcast) {
    localStorage.removeItem('gameshow_script_chat');
    unreadChatCount = 0;
    updateChatUnreadBadge();
    renderControllerChatHistory();
    if (broadcast) {
        sendCommand('clear_script_chat');
    }
}

function startTimer() {
    stopSfx();
    clearInterval(timerInterval);
    timeLeft = getQuestionTimeLimit();
    updateTimerDisplay();

    const r = getCurrentRoundNumber();

    sendCommand("timer_control", {
        status: "start",
        time: timeLeft,
        round: r
    });

    addSystemLog('system', 'BẮT ĐẦU ĐẾM NGƯỢC', `Khởi động đếm ngược ${timeLeft}s cho Vòng ${r}.`);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        sendCommand("timer_tick", {
            time: timeLeft
        });

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            sendCommand("timer_control", {
                status: "timeout",
                time: 0
            });
            addSystemLog('system', 'HẾT GIỜ ĐẶT CƯỢC', `Đồng hồ đếm ngược đã về 0s. Khóa thời gian đặt cược.`);
        }
    }, 1000);
}

function add30Seconds() {
    clearInterval(timerInterval);
    timeLeft += 30;
    updateTimerDisplay();
    playSfx('SFX/drop_30s.wav', false, false);
    sendCommand('timer_control', { status: 'add30', time: timeLeft });
    addSystemLog('system', 'CỘNG THÊM +30 GIÂY', `Cộng thêm +30s thời gian đặt cược (Thời gian mới: ${timeLeft}s).`);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        sendCommand('timer_tick', { time: timeLeft });
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            sendCommand('timer_control', { status: 'timeout' });
            addSystemLog('system', 'HẾT GIỜ ĐẶT CƯỢC', `Đồng hồ đếm ngược đã về 0s.`);
        }
    }, 1000);
}

function stopTimer() {     
    clearInterval(timerInterval);
    sendCommand("timer_control", {
        status: "stop",
        time: timeLeft
    });
    playSfx('SFX/drop_timer_stop.mp3');
    addSystemLog('system', 'DỪNG ĐẾM NGƯỢC', `Dừng thời gian đếm ngược ở mốc ${timeLeft}s.`);
}

function updateTimerDisplay() {
    let m = Math.floor(timeLeft / 60); 
    let s = timeLeft % 60;
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const timeDisplayEl = document.getElementById('time-display');
    if (timeDisplayEl) {
        timeDisplayEl.innerText = `THỜI GIAN ĐẶT CƯỢC: ${timeStr}`;
    }

    const startBtn = document.getElementById('btn-start-timer');
    if (startBtn && !timerInterval) {
        const limit = getQuestionTimeLimit();
        startBtn.innerText = `Bắt Đầu (${limit}s)`;
    }
}

function openDoor(id) { 
    playSfx('SFX/drop_trapdoor_1.mp3', false, false);
    sendCommand('open_door', { doorId: id }); 

    const unit = gameSettings.currencyUnit || '$A';
    const doorBet = lastMcBetsData[`b${id}`] || 0;
    const stackVal = gameSettings.stackValue || 25000;
    const stacksLost = Math.round(doorBet / stackVal);

    addSystemLog('lost', 'SẬP CỬA - MẤT TIỀN', `Mở sập cửa đáp án ${id}! Số tiền ${doorBet.toLocaleString('vi-VN')} ${unit} (${stacksLost} cọc) bị rơi xuống hố.`, {
        doorId: id, lostBet: doorBet, lostStacks: stacksLost
    });
}

function openSelectedDoors() {
    const selected = [];
    for (let i = 1; i <= 4; i++) {
        const chk = document.getElementById(`chk-door-${i}`);
        if (chk && chk.checked) {
            selected.push(i);
        }
    }
    if (selected.length === 0) {
        alert("Vui lòng tích chọn ít nhất 1 cửa đáp án sai để sập!");
        return;
    }
    playSfx('SFX/drop_trapdoor_1.mp3', false, false);
    selected.forEach(doorId => {
        sendCommand('open_door', { doorId: doorId });
    });
}

function selectAllDoors(checkAll) {
    for (let i = 1; i <= 4; i++) {
        const chk = document.getElementById(`chk-door-${i}`);
        if (chk) chk.checked = checkAll;
    }
}
function collectWinningMoney() { collectMoneyBack(); }
function penaltyFine() { 
    sendCommand('penalty_fine'); 
    const unit = gameSettings.currencyUnit || '$A';
    const stackVal = gameSettings.stackValue || 25000;
    addSystemLog('lost', 'PHẠT TRỪ CỌC TIỀN', `Bị phạt trừ 1 cọc tiền (${stackVal.toLocaleString('vi-VN')} ${unit}).`);
}
function addPlayerStacksMC(count) { sendCommand('add_player_stacks', { count: count }); }
function removePlayerStacksMC(count) { sendCommand('remove_player_stacks', { count: count }); }
function setPlayerStacksMC(count) { sendCommand('set_player_stacks', { count: count }); }
function setCustomStacksMC() {
    const input = document.getElementById('custom-stacks-input');
    if (input) {
        const val = parseInt(input.value);
        if (!isNaN(val) && val >= 0) {
            setPlayerStacksMC(val);
        }
    }
}
function showAllQuestionAndAnswers() {
    playSfx('SFX/drop_question_and_answer_reveal.mp3', false, false);
    const qText = document.getElementById('question-input').value;
    handleRoundChange();
    sendCommand('update_content', { 
        type: 'question', 
        data: { question: qText } 
    }); 
    sendCommand('send_question_text_to_screens', { text: qText });
    for (let i = 1; i <= 4; i++) {
        const val = document.getElementById(`ans-${i}`).value;
        sendCommand('update_single_answer', { id: i, text: val });
    }
    sendCommand('show_all_q_and_a'); 
}

// Soundboard functions
let lastPlaySfxCall = { file: '', time: 0 };
function playSfx(filePath, loop = false, stopPrevious = true) {
    const now = Date.now();
    if (lastPlaySfxCall.file === filePath && (now - lastPlaySfxCall.time < 150)) {
        return; // Ignore rapid duplicate clicks within 150ms
    }
    lastPlaySfxCall = { file: filePath, time: now };

    const statusEl = document.getElementById('sfx-status');
    if (statusEl) {
        statusEl.innerText = `🔊 Đã phát tới Projector: ${filePath}`;
        statusEl.style.color = '#2ecc71';
    }

    // Send broadcast command to Projector ONLY
    sendCommand('play_sfx', { file: filePath, loop: loop, stopPrevious: stopPrevious });
}

function stopSfx() {
    const statusEl = document.getElementById('sfx-status');
    if (statusEl) {
        statusEl.innerText = `🔇 Đã dừng âm thanh`;
        statusEl.style.color = '#f39c12';
    }
    sendCommand('stop_sfx');
}

function playCustomSfx() {
    const file = document.getElementById('custom-sfx-input').value.trim();
    if (file) {
        playSfx(file);
    }
}

function resetRound() {
    stopSfx();
    stopTimer();
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: --:--`;
    sendCommand('reset_round');
}

function reloadRole(targetRole) {
    if (targetRole === 'controller') {
        if (confirm("Bạn có chắc chắn muốn tải lại Bàn Điều Khiển hiện tại không?")) {
            window.location.reload();
        }
        return;
    }

    sendCommand('reload_role', { targetRole: targetRole });

    const roleNames = {
        'projector': 'Máy Chiếu (Projector)',
        'answer': 'MC / Sound (Answer)',
        'player': 'Người Chơi (Player)',
        'host': 'MC Host',
        'server': 'Màn Hình Server',
        'all': 'TẤT CẢ các màn hình (ALL ROLES)'
    };
    const name = roleNames[targetRole] || targetRole;

    addSystemLog('system', 'RELOAD MÀN HÌNH', `Đã gửi lệnh Reload đến màn hình: ${name}.`);

    const toast = document.getElementById('role-reload-status');
    if (toast) {
        toast.innerText = `Đã gửi tín hiệu TẢI LẠI đến: ${name}!`;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }
}

function openRoleTab(url) {
    window.open(url, '_blank');
}

// --- PROGRESS & SETTINGS TAB FUNCTIONS ---
function switchControllerTab(tabName) {
    const mainDash = document.getElementById('main-dashboard');
    const qDash = document.getElementById('questions-dashboard');
    const progDash = document.getElementById('progress-dashboard');
    const rolesDash = document.getElementById('roles-dashboard');
    const setDash = document.getElementById('settings-dashboard');
    const logDash = document.getElementById('logs-dashboard');

    const btnMain = document.getElementById('tab-btn-main');
    const btnQ = document.getElementById('tab-btn-questions');
    const btnProg = document.getElementById('tab-btn-progress');
    const btnRoles = document.getElementById('tab-btn-roles');
    const btnSet = document.getElementById('tab-btn-settings');
    const btnLog = document.getElementById('tab-btn-logs');

    if (mainDash) mainDash.style.display = (tabName === 'main') ? 'grid' : 'none';
    if (qDash) qDash.style.display = (tabName === 'questions') ? 'flex' : 'none';
    if (progDash) progDash.style.display = (tabName === 'progress') ? 'flex' : 'none';
    if (rolesDash) rolesDash.style.display = (tabName === 'roles') ? 'flex' : 'none';
    if (setDash) setDash.style.display = (tabName === 'settings') ? 'flex' : 'none';
    if (logDash) logDash.style.display = (tabName === 'logs') ? 'flex' : 'none';

    if (btnMain) btnMain.classList.toggle('active', tabName === 'main');
    if (btnQ) btnQ.classList.toggle('active', tabName === 'questions');
    if (btnProg) btnProg.classList.toggle('active', tabName === 'progress');
    if (btnRoles) btnRoles.classList.toggle('active', tabName === 'roles');
    if (btnSet) btnSet.classList.toggle('active', tabName === 'settings');
    if (btnLog) btnLog.classList.toggle('active', tabName === 'logs');

    if (tabName === 'questions') {
        renderQuestionsTabUI();
    } else if (tabName === 'progress') {
        updateProgressDataUI();
    } else if (tabName === 'settings') {
        populateSettingsFormUI();
    } else if (tabName === 'logs') {
        renderSystemLogsUI();
        updateLogStatsSummaryUI();
    }
}

function updateProgressDataUI() {
    let playedCount = 0;
    for (let i = 0; i < totalQuestionsCount; i++) {
        if (questionStates[i]) playedCount++;
    }
    const remainingCount = totalQuestionsCount - playedCount;
    const unit = gameSettings.currencyUnit || '$A';

    const playedTextEl = document.getElementById('ctrl-played-text');
    const remainingTextEl = document.getElementById('ctrl-remaining-text');
    const moneyTextEl = document.getElementById('ctrl-money-text');

    if (playedTextEl) playedTextEl.innerText = `${playedCount} / ${totalQuestionsCount}`;
    if (remainingTextEl) remainingTextEl.innerText = `${remainingCount} câu`;
    if (moneyTextEl) moneyTextEl.innerText = `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit}`;

    // Render questions status buttons
    const gridEl = document.getElementById('questions-status-grid');
    if (gridEl) {
        gridEl.innerHTML = '';
        for (let i = 0; i < totalQuestionsCount; i++) {
            const btn = document.createElement('button');
            const isPlayed = !!questionStates[i];
            btn.className = `q-status-btn ${isPlayed ? 'played' : 'unplay'}`;
            btn.innerHTML = `
                <span style="font-size:13px;">Câu ${i + 1}</span>
                <span style="font-size:11px;">${isPlayed ? 'Đã chơi' : 'Chưa chơi'}</span>
            `;
            btn.onclick = () => toggleQuestionStatus(i);
            gridEl.appendChild(btn);
        }
    }
}

function toggleQuestionStatus(index) {
    if (index >= 0 && index < totalQuestionsCount) {
        questionStates[index] = !questionStates[index];
        updateProgressDataUI();
        if (isProgressShowingOnProjector) {
            showProgressOnProjector();
        }
    }
}

function setPlayedCount(count) {
    for (let i = 0; i < totalQuestionsCount; i++) {
        questionStates[i] = (i < count);
    }
    updateProgressDataUI();
    if (isProgressShowingOnProjector) {
        showProgressOnProjector();
    }
}

function showProgressOnProjector() {
    isProgressShowingOnProjector = true;
    let playedCount = 0;
    for (let i = 0; i < totalQuestionsCount; i++) {
        if (questionStates[i]) playedCount++;
    }
    const remainingCount = totalQuestionsCount - playedCount;
    const unit = gameSettings.currencyUnit || '$A';

    sendCommand('show_progress', {
        playedCount: playedCount,
        remainingCount: remainingCount,
        totalQuestions: totalQuestionsCount,
        totalMoneyText: `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit}`,
        totalMoney: currentMoneyAmount,
        questionStates: questionStates
    });
}

function hideProgressOnProjector() {
    isProgressShowingOnProjector = false;
    sendCommand('hide_progress');
}

// --- SETTINGS TAB MANAGEMENT ---
function renderSettingsQuestionTimersGrid() {
    const grid = document.getElementById('cfg-question-timers-grid');
    if (!grid) return;

    const totalQ = Math.max(1, parseInt(document.getElementById('cfg-total-questions')?.value) || gameSettings.totalQuestions || 8);
    const defaultTimer = parseInt(document.getElementById('cfg-timer-seconds')?.value) || gameSettings.timerSeconds || 60;

    grid.innerHTML = '';
    const qTimers = gameSettings.questionTimers || [];

    for (let i = 0; i < totalQ; i++) {
        const currentVal = (qTimers[i] !== undefined && qTimers[i] !== null) ? qTimers[i] : defaultTimer;
        const box = document.createElement('div');
        box.style.cssText = "background: #111317; border: 1px solid #222632; padding: 4px 6px; border-radius: 4px; display: flex; flex-direction: column; gap: 2px;";
        box.innerHTML = `
            <label style="font-size: 9px; color: #38bdf8; margin: 0; font-weight: bold;">CÂU ${i + 1}:</label>
            <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" id="cfg-q-timer-${i}" min="5" max="300" value="${currentVal}" style="padding: 2px 4px; font-size: 11px; text-align: center; width: 100%; border-radius: 3px; background: #181b22; color: #fff; border: 1px solid #323848;" oninput="updateSettingsPreview()">
                <span style="font-size: 9px; color: #94a3b8;">s</span>
            </div>
        `;
        grid.appendChild(box);
    }
}

function populateSettingsFormUI() {
    const timeSecEl = document.getElementById('cfg-timer-seconds');
    const initStacksEl = document.getElementById('cfg-initial-stacks');
    const stackValEl = document.getElementById('cfg-stack-value');
    const unitEl = document.getElementById('cfg-currency-unit');
    const totalQEl = document.getElementById('cfg-total-questions');
    const betDelayEl = document.getElementById('cfg-bet-delay-seconds');
    const showFramesEl = document.getElementById('cfg-show-screen-frames');

    if (timeSecEl) timeSecEl.value = gameSettings.timerSeconds;
    if (initStacksEl) initStacksEl.value = gameSettings.initialStacks;
    if (stackValEl) stackValEl.value = gameSettings.stackValue;
    if (unitEl) unitEl.value = gameSettings.currencyUnit;
    if (totalQEl) totalQEl.value = gameSettings.totalQuestions;
    if (betDelayEl) betDelayEl.value = (gameSettings.betDelaySeconds !== undefined) ? gameSettings.betDelaySeconds : 0.125;
    if (showFramesEl) showFramesEl.value = (gameSettings.showScreenFrames !== false) ? "true" : "false";

    renderSettingsQuestionTimersGrid();
    updateSettingsPreview();
}

function updateSettingsPreview() {
    const timeSec = parseInt(document.getElementById('cfg-timer-seconds')?.value) || 60;
    const initStacks = parseInt(document.getElementById('cfg-initial-stacks')?.value) || 40;
    const stackVal = parseInt(document.getElementById('cfg-stack-value')?.value) || 25000;
    const unit = (document.getElementById('cfg-currency-unit')?.value || '$A').trim();
    const totalQ = parseInt(document.getElementById('cfg-total-questions')?.value) || 8;
    const rawDelay = parseFloat(document.getElementById('cfg-bet-delay-seconds')?.value);
    const betDelay = isNaN(rawDelay) ? 0.125 : rawDelay;

    const totalInitMoney = initStacks * stackVal;

    const prevTime = document.getElementById('preview-cfg-time');
    const prevMoney = document.getElementById('preview-cfg-money');
    const prevQ = document.getElementById('preview-cfg-questions');
    const prevDelay = document.getElementById('preview-cfg-delay');
    const prevFrames = document.getElementById('preview-cfg-frames');

    const showFramesVal = (document.getElementById('cfg-show-screen-frames')?.value !== "false");

    // Check if custom per-question timers are set
    let customTimeText = `${timeSec} giây`;
    const qTimers = [];
    for (let i = 0; i < totalQ; i++) {
        const val = parseInt(document.getElementById(`cfg-q-timer-${i}`)?.value);
        if (!isNaN(val) && val > 0) qTimers.push(val);
    }
    if (qTimers.length > 0) {
        const hasDiff = qTimers.some(t => t !== qTimers[0]);
        if (hasDiff) {
            customTimeText = `Tùy chỉnh (${qTimers.join('s, ')}s)`;
        } else {
            customTimeText = `${qTimers[0]} giây`;
        }
    }

    if (prevTime) prevTime.innerText = customTimeText;
    if (prevMoney) prevMoney.innerText = `${totalInitMoney.toLocaleString('vi-VN')} ${unit} (${initStacks} cọc)`;
    if (prevQ) prevQ.innerText = `${totalQ} câu`;
    if (prevDelay) prevDelay.innerText = `${betDelay}s (${Math.round(betDelay * 1000)}ms)`;
    if (prevFrames) prevFrames.innerText = showFramesVal ? "Hiển thị" : "Ẩn";
}

function saveGameSettings() {
    const timeSec = Math.max(5, parseInt(document.getElementById('cfg-timer-seconds')?.value) || 60);
    const initStacks = Math.max(1, parseInt(document.getElementById('cfg-initial-stacks')?.value) || 40);
    const stackVal = Math.max(0, parseInt(document.getElementById('cfg-stack-value')?.value) || 25000);
    const unit = (document.getElementById('cfg-currency-unit')?.value || '$A').trim();
    const totalQ = Math.max(1, parseInt(document.getElementById('cfg-total-questions')?.value) || 8);
    const rawDelay = parseFloat(document.getElementById('cfg-bet-delay-seconds')?.value);
    const betDelay = Math.max(0, isNaN(rawDelay) ? 0.125 : rawDelay);

    const qTimers = [];
    for (let i = 0; i < totalQ; i++) {
        const val = parseInt(document.getElementById(`cfg-q-timer-${i}`)?.value);
        qTimers.push((isNaN(val) || val <= 0) ? timeSec : val);
    }

    const showFramesVal = (document.getElementById('cfg-show-screen-frames')?.value !== "false");

    gameSettings = {
        timerSeconds: timeSec,
        initialStacks: initStacks,
        stackValue: stackVal,
        currencyUnit: unit,
        totalQuestions: totalQ,
        betDelaySeconds: betDelay,
        showScreenFrames: showFramesVal,
        questionTimers: qTimers
    };

    localStorage.setItem('game_settings', JSON.stringify(gameSettings));

    // Update internal state
    totalQuestionsCount = totalQ;
    if (questionStates.length < totalQuestionsCount) {
        while (questionStates.length < totalQuestionsCount) {
            questionStates.push(false);
        }
    } else if (questionStates.length > totalQuestionsCount) {
        questionStates = questionStates.slice(0, totalQuestionsCount);
    }

    updateTimerForCurrentQuestion();

    if (lastMcBetsData.totalMoney === null) {
        currentMoneyAmount = initStacks * stackVal;
    }

    updateControllerMoneyLabels();
    updateProgressDataUI();

    if (isProgressShowingOnProjector) {
        showProgressOnProjector();
    }

    sendCommand('update_settings', {
        settings: gameSettings
    });

    const statusEl = document.getElementById('cfg-save-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

function resetGameSettingsToDefault() {
    gameSettings = { ...DEFAULT_SETTINGS };
    localStorage.setItem('game_settings', JSON.stringify(gameSettings));
    populateSettingsFormUI();
    saveGameSettings();
}

function updateControllerMoneyLabels() {
    const unit = gameSettings.currencyUnit || '$A';
    const initStacks = gameSettings.initialStacks || 40;
    const stackVal = gameSettings.stackValue || 25000;
    const totalInitMoney = initStacks * stackVal;

    // 1. Update total money label on Main Dashboard
    const moneyEl = document.getElementById('mc-total-money');
    if (moneyEl) {
        const stacks = (lastMcBetsData.totalStacks !== null && lastMcBetsData.totalStacks !== undefined) 
            ? lastMcBetsData.totalStacks 
            : Math.round(currentMoneyAmount / (stackVal || 1));
        moneyEl.innerText = `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit} (${stacks} cọc)`;
    }

    // 2. Update bets on MC Main Dashboard
    const b1 = lastMcBetsData.b1 || 0;
    const b2 = lastMcBetsData.b2 || 0;
    const b3 = lastMcBetsData.b3 || 0;
    const b4 = lastMcBetsData.b4 || 0;
    const s1 = Math.round(b1 / (stackVal || 1));
    const s2 = Math.round(b2 / (stackVal || 1));
    const s3 = Math.round(b3 / (stackVal || 1));
    const s4 = Math.round(b4 / (stackVal || 1));

    const bet1El = document.getElementById('mc-bet-1');
    const bet2El = document.getElementById('mc-bet-2');
    const bet3El = document.getElementById('mc-bet-3');
    const bet4El = document.getElementById('mc-bet-4');

    if (bet1El) bet1El.innerText = `${b1.toLocaleString('vi-VN')} ${unit} (${s1} cọc)`;
    if (bet2El) bet2El.innerText = `${b2.toLocaleString('vi-VN')} ${unit} (${s2} cọc)`;
    if (bet3El) bet3El.innerText = `${b3.toLocaleString('vi-VN')} ${unit} (${s3} cọc)`;
    if (bet4El) bet4El.innerText = `${b4.toLocaleString('vi-VN')} ${unit} (${s4} cọc)`;

    // 3. Update restore stacks button
    const defaultBtn = document.querySelector('button[onclick*="setPlayerStacksMC"]');
    if (defaultBtn) {
        defaultBtn.innerText = `${initStacks} Cọc`;
        defaultBtn.setAttribute('onclick', `setPlayerStacksMC(${initStacks})`);
        defaultBtn.title = `Khôi phục ${initStacks} cọc (${totalInitMoney.toLocaleString('vi-VN')} ${unit})`;
    }

    // 4. Update money label on Progress Dashboard
    const progressMoneyEl = document.getElementById('ctrl-money-text');
    if (progressMoneyEl) {
        progressMoneyEl.innerText = `${currentMoneyAmount.toLocaleString('vi-VN')} ${unit}`;
    }
}

// --- QUESTION DATA TAB FUNCTIONS ---
function renderQuestionsTabUI() {
    const container = document.getElementById('questions-data-list');
    if (!container) return;
    container.innerHTML = '';

    if (!excelDataStore || excelDataStore.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">Chưa có câu hỏi nào. Hãy tải file Excel hoặc bấm "Thêm Vòng Mới"!</div>';
        return;
    }

    excelDataStore.forEach((q, idx) => {
        const roundCard = document.createElement('div');
        roundCard.style.cssText = "background: #181b22; border: 1px solid #262a36; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px;";

        const roundHeader = document.createElement('div');
        roundHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #262a36; padding-bottom: 4px;";
        const defaultQTimer = (gameSettings.questionTimers && gameSettings.questionTimers[idx] !== undefined) ? gameSettings.questionTimers[idx] : (gameSettings.timerSeconds || 60);
        roundHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: bold; color: #38bdf8;">VÒNG ${q.round || (idx + 1)}</span>
                <div style="display: flex; align-items: center; gap: 4px; background: #111317; padding: 2px 6px; border-radius: 4px; border: 1px solid #222632;">
                    <label style="font-size: 10px; color: #fbbf24; margin: 0;">Thời gian đếm ngược:</label>
                    <input type="number" id="qtab-timerSeconds-${idx}" value="${q.timerSeconds || ''}" placeholder="${defaultQTimer}" min="5" max="300" style="width: 55px; padding: 1px 4px; font-size: 11px; text-align: center; border-radius: 3px; background: #181b22; color: #fff; border: 1px solid #323848;">
                    <span style="font-size: 10px; color: #94a3b8;">giây</span>
                </div>
            </div>
            <button class="btn-red" style="width: auto; padding: 2px 8px; font-size: 10px;" onclick="deleteRoundFromStore(${idx})">Xóa Vòng</button>
        `;
        roundCard.appendChild(roundHeader);

        const abGrid = document.createElement('div');
        abGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 10px;";

        // Section A
        const secA = document.createElement('div');
        secA.style.cssText = "background: #111317; border: 1px solid #222632; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 6px;";
        secA.innerHTML = `
            <div style="font-size: 11px; font-weight: bold; color: #fbbf24;">CHỦ ĐỀ & CÂU HỎI A</div>
            <div>
                <label style="color: #94a3b8; font-size: 10px;">Chủ đề A:</label>
                <input type="text" id="qtab-topicA-${idx}" value="${q.topicA || ''}" placeholder="Tên chủ đề A">
            </div>
            <div>
                <label style="color: #94a3b8; font-size: 10px;">Câu hỏi A:</label>
                <textarea id="qtab-questionA-${idx}" rows="2" placeholder="Nội dung câu hỏi A...">${q.questionA || ''}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <input type="text" id="qtab-ansA1-${idx}" value="${(q.ansA && q.ansA[0]) || ''}" placeholder="Cửa 1">
                <input type="text" id="qtab-ansA2-${idx}" value="${(q.ansA && q.ansA[1]) || ''}" placeholder="Cửa 2">
                <input type="text" id="qtab-ansA3-${idx}" value="${(q.ansA && q.ansA[2]) || ''}" placeholder="Cửa 3">
                <input type="text" id="qtab-ansA4-${idx}" value="${(q.ansA && q.ansA[3]) || ''}" placeholder="Cửa 4">
            </div>
            <div style="background: #181b22; padding: 6px; border-radius: 4px; border: 1px solid #222632;">
                <label style="color: #c084fc; font-size: 10px; margin-bottom: 2px;">Media A (Hình / Video):</label>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select id="qtab-mediaTypeA-${idx}" style="width: 90px;">
                        <option value="none" ${(!q.mediaTypeA || q.mediaTypeA==='none') ? 'selected' : ''}>Không</option>
                        <option value="image" ${q.mediaTypeA==='image' ? 'selected' : ''}>Hình ảnh</option>
                        <option value="video" ${q.mediaTypeA==='video' ? 'selected' : ''}>Video</option>
                    </select>
                    <input type="text" id="qtab-mediaUrlA-${idx}" value="${q.mediaUrlA || ''}" placeholder="URL hoặc chọn file..." style="flex: 1;">
                    <input type="file" id="qtab-fileA-${idx}" accept="image/*,video/*" style="display:none;" onchange="handleQuestionTabFileUpload(event, ${idx}, 'A')">
                    <button class="btn-purple" style="width: auto; padding: 2px 6px; font-size: 10px;" onclick="document.getElementById('qtab-fileA-${idx}').click()">File</button>
                </div>
            </div>
        `;

        // Section B
        const secB = document.createElement('div');
        secB.style.cssText = "background: #111317; border: 1px solid #222632; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 6px;";
        secB.innerHTML = `
            <div style="font-size: 11px; font-weight: bold; color: #fbbf24;">CHỦ ĐỀ & CÂU HỎI B</div>
            <div>
                <label style="color: #94a3b8; font-size: 10px;">Chủ đề B:</label>
                <input type="text" id="qtab-topicB-${idx}" value="${q.topicB || ''}" placeholder="Tên chủ đề B">
            </div>
            <div>
                <label style="color: #94a3b8; font-size: 10px;">Câu hỏi B:</label>
                <textarea id="qtab-questionB-${idx}" rows="2" placeholder="Nội dung câu hỏi B...">${q.questionB || ''}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                <input type="text" id="qtab-ansB1-${idx}" value="${(q.ansB && q.ansB[0]) || ''}" placeholder="Cửa 1">
                <input type="text" id="qtab-ansB2-${idx}" value="${(q.ansB && q.ansB[1]) || ''}" placeholder="Cửa 2">
                <input type="text" id="qtab-ansB3-${idx}" value="${(q.ansB && q.ansB[2]) || ''}" placeholder="Cửa 3">
                <input type="text" id="qtab-ansB4-${idx}" value="${(q.ansB && q.ansB[3]) || ''}" placeholder="Cửa 4">
            </div>
            <div style="background: #181b22; padding: 6px; border-radius: 4px; border: 1px solid #222632;">
                <label style="color: #c084fc; font-size: 10px; margin-bottom: 2px;">Media B (Hình / Video):</label>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select id="qtab-mediaTypeB-${idx}" style="width: 90px;">
                        <option value="none" ${(!q.mediaTypeB || q.mediaTypeB==='none') ? 'selected' : ''}>Không</option>
                        <option value="image" ${q.mediaTypeB==='image' ? 'selected' : ''}>Hình ảnh</option>
                        <option value="video" ${q.mediaTypeB==='video' ? 'selected' : ''}>Video</option>
                    </select>
                    <input type="text" id="qtab-mediaUrlB-${idx}" value="${q.mediaUrlB || ''}" placeholder="URL hoặc chọn file..." style="flex: 1;">
                    <input type="file" id="qtab-fileB-${idx}" accept="image/*,video/*" style="display:none;" onchange="handleQuestionTabFileUpload(event, ${idx}, 'B')">
                    <button class="btn-purple" style="width: auto; padding: 2px 6px; font-size: 10px;" onclick="document.getElementById('qtab-fileB-${idx}').click()">File</button>
                </div>
            </div>
        `;

        abGrid.appendChild(secA);
        abGrid.appendChild(secB);
        roundCard.appendChild(abGrid);
        container.appendChild(roundCard);
    });
}

function saveQuestionsTabUI() {
    excelDataStore.forEach((q, idx) => {
        q.timerSeconds = document.getElementById(`qtab-timerSeconds-${idx}`)?.value || '';
        q.topicA = document.getElementById(`qtab-topicA-${idx}`)?.value || '';
        q.questionA = document.getElementById(`qtab-questionA-${idx}`)?.value || '';
        q.ansA = [
            document.getElementById(`qtab-ansA1-${idx}`)?.value || '',
            document.getElementById(`qtab-ansA2-${idx}`)?.value || '',
            document.getElementById(`qtab-ansA3-${idx}`)?.value || '',
            document.getElementById(`qtab-ansA4-${idx}`)?.value || ''
        ].filter(a => a !== '');
        q.mediaTypeA = document.getElementById(`qtab-mediaTypeA-${idx}`)?.value || 'none';
        q.mediaUrlA = document.getElementById(`qtab-mediaUrlA-${idx}`)?.value || '';

        q.topicB = document.getElementById(`qtab-topicB-${idx}`)?.value || '';
        q.questionB = document.getElementById(`qtab-questionB-${idx}`)?.value || '';
        q.ansB = [
            document.getElementById(`qtab-ansB1-${idx}`)?.value || '',
            document.getElementById(`qtab-ansB2-${idx}`)?.value || '',
            document.getElementById(`qtab-ansB3-${idx}`)?.value || '',
            document.getElementById(`qtab-ansB4-${idx}`)?.value || ''
        ].filter(a => a !== '');
        q.mediaTypeB = document.getElementById(`qtab-mediaTypeB-${idx}`)?.value || 'none';
        q.mediaUrlB = document.getElementById(`qtab-mediaUrlB-${idx}`)?.value || '';
    });

    saveExcelDataStore();
    updateQuestionSelector();

    const statusEl = document.getElementById('qtab-save-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
}

function addNewRoundToStore() {
    const nextRound = excelDataStore.length + 1;
    excelDataStore.push({
        round: nextRound,
        topicA: `Chủ đề A (Vòng ${nextRound})`,
        topicB: `Chủ đề B (Vòng ${nextRound})`,
        questionA: '',
        questionB: '',
        ansA: ['', '', '', ''],
        ansB: ['', '', '', ''],
        mediaTypeA: 'none',
        mediaUrlA: '',
        mediaTypeB: 'none',
        mediaUrlB: ''
    });
    saveExcelDataStore();
    renderQuestionsTabUI();
    updateQuestionSelector();
}

function deleteRoundFromStore(idx) {
    if (confirm(`Bạn có chắc chắn muốn xóa Vòng ${excelDataStore[idx]?.round || (idx + 1)}?`)) {
        excelDataStore.splice(idx, 1);
        saveExcelDataStore();
        renderQuestionsTabUI();
        updateQuestionSelector();
    }
}

function handleQuestionTabFileUpload(event, idx, option) {
    const file = event.target.files[0];
    if (!file) return;

    const typeSelect = document.getElementById(`qtab-mediaType${option}-${idx}`);
    const urlInput = document.getElementById(`qtab-mediaUrl${option}-${idx}`);

    const updateStoreWithUrl = (fileUrl, isVideo) => {
        if (isVideo) {
            if (typeSelect) typeSelect.value = 'video';
        } else {
            if (typeSelect) typeSelect.value = 'image';
        }

        if (urlInput) urlInput.value = fileUrl;
        if (excelDataStore[idx]) {
            if (option === 'A') {
                excelDataStore[idx].mediaTypeA = isVideo ? 'video' : 'image';
                excelDataStore[idx].mediaUrlA = fileUrl;
            } else {
                excelDataStore[idx].mediaTypeB = isVideo ? 'video' : 'image';
                excelDataStore[idx].mediaUrlB = fileUrl;
            }
            saveExcelDataStore();
        }
    };

    if (file.type.startsWith('video/')) {
        showVideoCompressingModal(file.name);
        compressVideoTo480p(file, (percent) => {
            updateVideoCompressingProgress(percent);
        }).then(compressedVideoDataUrl => {
            hideVideoCompressingModal();
            updateStoreWithUrl(compressedVideoDataUrl, true);
        }).catch(err => {
            console.error("Question tab video compression error:", err);
            hideVideoCompressingModal();
            const reader = new FileReader();
            reader.onload = function(e) {
                updateStoreWithUrl(e.target.result, true);
            };
            reader.readAsDataURL(file);
        });
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            updateStoreWithUrl(e.target.result, false);
        };
        reader.readAsDataURL(file);
    }
}
