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

let excelDataStore = [
    { round: 1, topicA: "cd1", topicB: "cd2", questionA: "q1", questionB: "q2", ansA: ["a1", "b1", "c1", "d1"], ansB: ["a2", "b2", "c2", "d2"] },
    { round: 2, topicA: "cd3", topicB: "cd4", questionA: "q3", questionB: "q4", ansA: ["a3", "b3", "c3", "d3"], ansB: ["a4", "b4", "c4", "d4"] },
    { round: 3, topicA: "cd5", topicB: "cd6", questionA: "q1", questionB: "q2", ansA: ["a5", "b5", "c5", "d5"], ansB: ["a6", "b6", "c6", "d6"] },
    { round: 4, topicA: "cd7", topicB: "cd8", questionA: "q3", questionB: "q4", ansA: ["a7", "b7", "c7", "d7"], ansB: ["a8", "b8", "c8", "d8"] },
    { round: 5, topicA: "cd9", topicB: "cd10", questionA: "q1", questionB: "q2", ansA: ["a9", "b9", "c9"], ansB: ["a10", "b10", "c10"] },
    { round: 6, topicA: "cd11", topicB: "cd12", questionA: "q3", questionB: "q4", ansA: ["a11", "b11", "c11"], ansB: ["a12", "b12", "c12"] },
    { round: 7, topicA: "cd13", topicB: "cd14", questionA: "q1", questionB: "q2", ansA: ["a13", "b13", "c13"], ansB: ["a14", "b14", "c14"] },
    { round: 8, topicA: "cd15", topicB: "cd16", questionA: "q3", questionB: "q4", ansA: ["a15", "b15"], ansB: ["a16", "b16"] }
];
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
                ansB: getAnswers(row, 9, 12)
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
                ansB: getAnswers(rowB)
            });

            currentRound++;
        }
    }

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
    if (type === 'A') {
        questionText = data.questionA || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansA || []);
    } else {
        questionText = data.questionB || "";
        document.getElementById('question-input').value = questionText;
        fillAnswers(data.ansB || []);
    }
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
    sendCommand('update_content', { 
        type: 'question', 
        data: { question: qText } 
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

// --- PROGRESS & SETTINGS TAB FUNCTIONS ---
function switchControllerTab(tabName) {
    const mainDash = document.getElementById('main-dashboard');
    const progDash = document.getElementById('progress-dashboard');
    const setDash = document.getElementById('settings-dashboard');
    const btnMain = document.getElementById('tab-btn-main');
    const btnProg = document.getElementById('tab-btn-progress');
    const btnSet = document.getElementById('tab-btn-settings');

    if (mainDash) mainDash.style.display = (tabName === 'main') ? 'grid' : 'none';
    if (progDash) progDash.style.display = (tabName === 'progress') ? 'flex' : 'none';
    if (setDash) setDash.style.display = (tabName === 'settings') ? 'flex' : 'none';

    if (btnMain) btnMain.classList.toggle('active', tabName === 'main');
    if (btnProg) btnProg.classList.toggle('active', tabName === 'progress');
    if (btnSet) btnSet.classList.toggle('active', tabName === 'settings');

    if (tabName === 'progress') {
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
