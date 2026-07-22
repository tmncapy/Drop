const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
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
let timeLeft = 60;
let timerInterval = null;

let currentPin = localStorage.getItem('game_pin') || '1234';

// Populate dropdown and PIN on load
window.addEventListener('DOMContentLoaded', () => {
    updateQuestionSelector();
    initPinCode();
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

// Listen to messages from other windows/tabs (e.g., live player bets)
channel.onmessage = function(event) {
    const { action, data } = event.data;
    if (action === 'request_pin') {
        sendCommand('update_pin', { pin: currentPin });
    }
    if (action === 'sync_bets_to_mc') {
        const b1 = data.b1 || 0;
        const b2 = data.b2 || 0;
        const b3 = data.b3 || 0;
        const b4 = data.b4 || 0;
        document.getElementById('mc-bet-1').innerText = b1.toLocaleString('vi-VN') + " $A";
        document.getElementById('mc-bet-2').innerText = b2.toLocaleString('vi-VN') + " $A";
        document.getElementById('mc-bet-3').innerText = b3.toLocaleString('vi-VN') + " $A";
        document.getElementById('mc-bet-4').innerText = b4.toLocaleString('vi-VN') + " $A";
    }
};

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
    
    if (type === 'A') {
        document.getElementById('question-input').value = data.questionA || "";
        fillAnswers(data.ansA || []);
    } else {
        document.getElementById('question-input').value = data.questionB || "";
        fillAnswers(data.ansB || []);
    }

    // Auto-update the round dropdown based on Excel question data
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
}

function fillAnswers(ansList) {
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById("ans-" + i);
        if (!input) continue;
        const parentRow = input.closest('.ans-row');
        
        if (ansList && ansList[i - 1] !== undefined && ansList[i - 1] !== null && String(ansList[i - 1]).trim() !== "") {
            input.value = ansList[i - 1];
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
    sendCommand('update_content', { 
        type: 'question', 
        data: { question: document.getElementById('question-input').value } 
    }); 
}

function sendSingleAnswer(id) { 
    if (id === 1) {
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

function startTimer() {
    stopSfx();
    clearInterval(timerInterval);
    timeLeft = 60;
    updateTimerDisplay();

    sendCommand("timer_control", {
        status: "start",
        time: timeLeft
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
function collectWinningMoney() { sendCommand('collect_winning'); }
function penaltyFine() { sendCommand('penalty_fine'); }
function showAllQuestionAndAnswers() {
    playSfx('SFX/drop_question_and_answer_reveal.mp3', false, false);
    for (let i = 1; i <= 4; i++) {
        const val = document.getElementById(`ans-${i}`).value;
        sendCommand('update_single_answer', { id: i, text: val });
    }
    sendCommand('show_all_q_and_a'); 
}

// Soundboard functions
let localSfxAudio = null;

function playSfx(filePath, loop = false, stopPrevious = true) {
    if (stopPrevious && localSfxAudio) {
        localSfxAudio.pause();
        localSfxAudio.currentTime = 0;
    }
    
    // Play locally on controller (user clicked, so user gesture is present)
    const audio = new Audio(filePath);
    audio.loop = loop;
    if (stopPrevious) {
        localSfxAudio = audio;
    }
    
    const statusEl = document.getElementById('sfx-status');
    
    audio.play().then(() => {
        if (statusEl) {
            statusEl.innerText = `🔊 Đang phát: ${filePath}`;
            statusEl.style.color = '#2ecc71';
        }
    }).catch(err => {
        console.warn("Lỗi phát SFX tại Controller:", err);
        if (statusEl) {
            statusEl.innerText = `⚠️ Lỗi/Không thấy file audio: ${filePath} (Vui lòng kiểm tra tên file trong thư mục SFX)`;
            statusEl.style.color = '#e74c3c';
        }
    });

    // Also send broadcast command to Projector
    sendCommand('play_sfx', { file: filePath, loop: loop, stopPrevious: stopPrevious });
}

function stopSfx() {
    if (localSfxAudio) {
        localSfxAudio.pause();
        localSfxAudio.currentTime = 0;
        localSfxAudio = null;
    }
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
    stopTimer();
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: --:--`;
    sendCommand('reset_round');
}
