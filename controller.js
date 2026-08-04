const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
const DEFAULT_SETTINGS = {
    timerSeconds: 60,
    initialStacks: 40,
    stackValue: 25000,
    currencyUnit: '$A',
    totalQuestions: 8
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
    alert("Đã gửi lệnh khóa tất cả màn hình Player!");
}

let lastMcBetsData = { b1: 0, b2: 0, b3: 0, b4: 0, totalMoney: null, totalStacks: null };

// Listen to messages from other windows/tabs (e.g., live player bets)
channel.onmessage = function(event) {
    const { action, data } = event.data;
    if (action === 'mqtt_connected' || action === 'request_pin') {
        sendCommand('update_pin', { pin: currentPin });
        sendCommand('set_volume', { volume: currentGlobalVolume });
    }
    if (action === 'sync_bets_to_mc' && data) {
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

        updateControllerMoneyLabels();
        updateProgressDataUI();
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
}

function updateQuestionSelector() {
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

function loadSelectedQuestion() {
    const val = document.getElementById('select-question-index').value;
    if (!val) return;
    const [idx, type] = val.split('-');
    const data = excelDataStore[idx];
    if (!data) return;
    
    document.getElementById('topic-a').value = data.topicA || "";
    document.getElementById('topic-b').value = data.topicB || "";
    
    // Auto-update the round dropdown based on Excel question data BEFORE filling answers
    const roundSelect = document.getElementById("select-round");
    const roundNum = Number(data.round) || 1;
    let roundVal = "1";
    if (roundNum >= 5 && roundNum <= 7) {
        roundVal = "5";
    } else if (roundNum === 8) {
        roundVal = "8";
    }
    roundSelect.value = roundVal;
    handleRoundChange();

    let questionText = "";
    const mTypeEl = document.getElementById('main-media-type');
    const mUrlEl = document.getElementById('main-media-url');

    if (type === 'A') {
        questionText = data.questionA || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansA || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeA || 'none';
        if (mUrlEl) mUrlEl.value = data.mediaUrlA || '';
    } else {
        questionText = data.questionB || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansB || []);
        if (mTypeEl) mTypeEl.value = data.mediaTypeB || 'none';
        if (mUrlEl) mUrlEl.value = data.mediaUrlB || '';
    }
}

function syncMainMediaToStore() {
    const val = document.getElementById('select-question-index')?.value;
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = document.getElementById('main-media-url')?.value || '';

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

function handleMainMediaFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const typeSelect = document.getElementById('main-media-type');
    const urlInput = document.getElementById('main-media-url');

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
                if (urlInput) urlInput.value = compressedUrl;
                syncMainMediaToStore();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileUrl = e.target.result;
            if (typeSelect) typeSelect.value = 'video';
            if (urlInput) urlInput.value = fileUrl;
            syncMainMediaToStore();
        };
        reader.readAsDataURL(file);
    }
}

function sendMedia() {
    playSfx('SFX/drop_Reveal the Question_2.mp3', false, false);
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = document.getElementById('main-media-url')?.value || '';

    if (mType === 'none' || !mUrl) {
        alert("Vui lòng chọn loại Media (Hình ảnh / Video) và chọn file/nhập URL trước!");
        return;
    }

    sendCommand('show_media', {
        mediaType: mType,
        mediaUrl: mUrl
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
    sendCommand("lock_topic", {
        type: type,
        topicName: type === "A"
            ? document.getElementById("topic-a").value
            : document.getElementById("topic-b").value
    });
}

function sendQuestion() { 
    playSfx('SFX/drop_Reveal the Question_2.mp3', false, false);
    const qText = document.getElementById('question-input').value;
    const mType = document.getElementById('main-media-type')?.value || 'none';
    const mUrl = document.getElementById('main-media-url')?.value || '';

    sendCommand('update_content', { 
        type: 'question', 
        data: { question: qText, mediaType: mType, mediaUrl: mUrl },
        mediaType: mType,
        mediaUrl: mUrl
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
}

function getCurrentRoundNumber() {
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

function sendMsgToHost() {
    const input = document.getElementById('host-msg-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    sendCommand('tech_to_host_msg', { msg: msg });
    input.value = '';
}

function startTimer() {
    stopSfx();
    clearInterval(timerInterval);
    timeLeft = gameSettings.timerSeconds || 60;
    updateTimerDisplay();

    const r = getCurrentRoundNumber();

    sendCommand("timer_control", {
        status: "start",
        time: timeLeft,
        round: r
    });

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
        }
    }, 1000);
}

function add30Seconds() {
    clearInterval(timerInterval);
    timeLeft += 30;
    updateTimerDisplay();
    playSfx('SFX/drop_30s.wav', false, false);
    sendCommand('timer_control', { status: 'add30', time: timeLeft });
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        sendCommand('timer_tick', { time: timeLeft });
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            sendCommand('timer_control', { status: 'timeout' });
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
}

function updateTimerDisplay() {
    let m = Math.floor(timeLeft / 60); 
    let s = timeLeft % 60;
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function openDoor(id) { 
    playSfx('SFX/drop_trapdoor_1.mp3', false, false);
    sendCommand('open_door', { doorId: id }); 
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
function penaltyFine() { sendCommand('penalty_fine'); }
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

    const toast = document.getElementById('role-reload-status');
    if (toast) {
        toast.innerText = `⚡ Đã gửi tín hiệu TẢI LẠI đến: ${name}!`;
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

    const btnMain = document.getElementById('tab-btn-main');
    const btnQ = document.getElementById('tab-btn-questions');
    const btnProg = document.getElementById('tab-btn-progress');
    const btnRoles = document.getElementById('tab-btn-roles');
    const btnSet = document.getElementById('tab-btn-settings');

    if (mainDash) mainDash.style.display = (tabName === 'main') ? 'grid' : 'none';
    if (qDash) qDash.style.display = (tabName === 'questions') ? 'flex' : 'none';
    if (progDash) progDash.style.display = (tabName === 'progress') ? 'flex' : 'none';
    if (rolesDash) rolesDash.style.display = (tabName === 'roles') ? 'flex' : 'none';
    if (setDash) setDash.style.display = (tabName === 'settings') ? 'flex' : 'none';

    if (btnMain) btnMain.classList.toggle('active', tabName === 'main');
    if (btnQ) btnQ.classList.toggle('active', tabName === 'questions');
    if (btnProg) btnProg.classList.toggle('active', tabName === 'progress');
    if (btnRoles) btnRoles.classList.toggle('active', tabName === 'roles');
    if (btnSet) btnSet.classList.toggle('active', tabName === 'settings');

    if (tabName === 'questions') {
        renderQuestionsTabUI();
    } else if (tabName === 'progress') {
        updateProgressDataUI();
    } else if (tabName === 'settings') {
        populateSettingsFormUI();
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
                <span style="font-size:11px;">${isPlayed ? '✅ Đã chơi' : '🔴 Chưa chơi'}</span>
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
function populateSettingsFormUI() {
    const timeSecEl = document.getElementById('cfg-timer-seconds');
    const initStacksEl = document.getElementById('cfg-initial-stacks');
    const stackValEl = document.getElementById('cfg-stack-value');
    const unitEl = document.getElementById('cfg-currency-unit');
    const totalQEl = document.getElementById('cfg-total-questions');

    if (timeSecEl) timeSecEl.value = gameSettings.timerSeconds;
    if (initStacksEl) initStacksEl.value = gameSettings.initialStacks;
    if (stackValEl) stackValEl.value = gameSettings.stackValue;
    if (unitEl) unitEl.value = gameSettings.currencyUnit;
    if (totalQEl) totalQEl.value = gameSettings.totalQuestions;

    updateSettingsPreview();
}

function updateSettingsPreview() {
    const timeSec = parseInt(document.getElementById('cfg-timer-seconds')?.value) || 60;
    const initStacks = parseInt(document.getElementById('cfg-initial-stacks')?.value) || 40;
    const stackVal = parseInt(document.getElementById('cfg-stack-value')?.value) || 25000;
    const unit = (document.getElementById('cfg-currency-unit')?.value || '$A').trim();
    const totalQ = parseInt(document.getElementById('cfg-total-questions')?.value) || 8;

    const totalInitMoney = initStacks * stackVal;

    const prevTime = document.getElementById('preview-cfg-time');
    const prevMoney = document.getElementById('preview-cfg-money');
    const prevQ = document.getElementById('preview-cfg-questions');

    if (prevTime) prevTime.innerText = `${timeSec} giây`;
    if (prevMoney) prevMoney.innerText = `${totalInitMoney.toLocaleString('vi-VN')} ${unit} (${initStacks} cọc)`;
    if (prevQ) prevQ.innerText = `${totalQ} câu`;
}

function saveGameSettings() {
    const timeSec = Math.max(5, parseInt(document.getElementById('cfg-timer-seconds')?.value) || 60);
    const initStacks = Math.max(1, parseInt(document.getElementById('cfg-initial-stacks')?.value) || 40);
    const stackVal = Math.max(0, parseInt(document.getElementById('cfg-stack-value')?.value) || 25000);
    const unit = (document.getElementById('cfg-currency-unit')?.value || '$A').trim();
    const totalQ = Math.max(1, parseInt(document.getElementById('cfg-total-questions')?.value) || 8);

    gameSettings = {
        timerSeconds: timeSec,
        initialStacks: initStacks,
        stackValue: stackVal,
        currencyUnit: unit,
        totalQuestions: totalQ
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

    if (!timerInterval) {
        timeLeft = gameSettings.timerSeconds;
        updateTimerDisplay();
    }

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
        roundHeader.innerHTML = `
            <span style="font-size: 12px; font-weight: bold; color: #38bdf8;">🎯 VÒNG ${q.round || (idx + 1)}</span>
            <button class="btn-red" style="width: auto; padding: 2px 8px; font-size: 10px;" onclick="deleteRoundFromStore(${idx})">🗑️ Xóa Vòng</button>
        `;
        roundCard.appendChild(roundHeader);

        const abGrid = document.createElement('div');
        abGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 10px;";

        // Section A
        const secA = document.createElement('div');
        secA.style.cssText = "background: #111317; border: 1px solid #222632; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 6px;";
        secA.innerHTML = `
            <div style="font-size: 11px; font-weight: bold; color: #fbbf24;">📌 CHỦ ĐỀ & CÂU HỎI A</div>
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
                <label style="color: #c084fc; font-size: 10px; margin-bottom: 2px;">🎥 Media A (Hình / Video):</label>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select id="qtab-mediaTypeA-${idx}" style="width: 90px;">
                        <option value="none" ${(!q.mediaTypeA || q.mediaTypeA==='none') ? 'selected' : ''}>Không</option>
                        <option value="image" ${q.mediaTypeA==='image' ? 'selected' : ''}>Hình ảnh</option>
                        <option value="video" ${q.mediaTypeA==='video' ? 'selected' : ''}>Video</option>
                    </select>
                    <input type="text" id="qtab-mediaUrlA-${idx}" value="${q.mediaUrlA || ''}" placeholder="URL hoặc chọn file..." style="flex: 1;">
                    <input type="file" id="qtab-fileA-${idx}" accept="image/*,video/*" style="display:none;" onchange="handleQuestionTabFileUpload(event, ${idx}, 'A')">
                    <button class="btn-purple" style="width: auto; padding: 2px 6px; font-size: 10px;" onclick="document.getElementById('qtab-fileA-${idx}').click()">📁 File</button>
                </div>
            </div>
        `;

        // Section B
        const secB = document.createElement('div');
        secB.style.cssText = "background: #111317; border: 1px solid #222632; border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 6px;";
        secB.innerHTML = `
            <div style="font-size: 11px; font-weight: bold; color: #fbbf24;">📌 CHỦ ĐỀ & CÂU HỎI B</div>
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
                <label style="color: #c084fc; font-size: 10px; margin-bottom: 2px;">🎥 Media B (Hình / Video):</label>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select id="qtab-mediaTypeB-${idx}" style="width: 90px;">
                        <option value="none" ${(!q.mediaTypeB || q.mediaTypeB==='none') ? 'selected' : ''}>Không</option>
                        <option value="image" ${q.mediaTypeB==='image' ? 'selected' : ''}>Hình ảnh</option>
                        <option value="video" ${q.mediaTypeB==='video' ? 'selected' : ''}>Video</option>
                    </select>
                    <input type="text" id="qtab-mediaUrlB-${idx}" value="${q.mediaUrlB || ''}" placeholder="URL hoặc chọn file..." style="flex: 1;">
                    <input type="file" id="qtab-fileB-${idx}" accept="image/*,video/*" style="display:none;" onchange="handleQuestionTabFileUpload(event, ${idx}, 'B')">
                    <button class="btn-purple" style="width: auto; padding: 2px 6px; font-size: 10px;" onclick="document.getElementById('qtab-fileB-${idx}').click()">📁 File</button>
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

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileUrl = e.target.result;
        const typeSelect = document.getElementById(`qtab-mediaType${option}-${idx}`);
        const urlInput = document.getElementById(`qtab-mediaUrl${option}-${idx}`);

        if (file.type.startsWith('video/')) {
            if (typeSelect) typeSelect.value = 'video';
        } else if (file.type.startsWith('image/')) {
            if (typeSelect) typeSelect.value = 'image';
        }

        if (urlInput) urlInput.value = fileUrl;
        if (excelDataStore[idx]) {
            if (option === 'A') {
                excelDataStore[idx].mediaTypeA = typeSelect ? typeSelect.value : 'image';
                excelDataStore[idx].mediaUrlA = fileUrl;
            } else {
                excelDataStore[idx].mediaTypeB = typeSelect ? typeSelect.value : 'image';
                excelDataStore[idx].mediaUrlB = fileUrl;
            }
            saveExcelDataStore();
        }
    };
    reader.readAsDataURL(file);
}
