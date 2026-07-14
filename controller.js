const channel = new BroadcastChannel('gameshow_money_drop');
let excelDataStore = [];
let timeLeft = 60;
let timerInterval = null;

function sendCommand(action, data = {}) {
    channel.postMessage({ action, data });
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
    excelDataStore = [];
    let currentRoundId = null;
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        if (row[0] !== undefined && row[0] !== "") currentRoundId = parseInt(row[0]);
        if (!currentRoundId || isNaN(currentRoundId)) continue;

        excelDataStore.push({
            round: currentRoundId,
            topicA: row[1] ? row[1].toString().trim() : "",
            topicB: row[2] ? row[2].toString().trim() : "", 
            questionText: row[3] ? row[3].toString().trim() : "",
            answers: [
                row[4] ? row[4].toString().trim() : "",
                row[5] ? row[5].toString().trim() : "",
                row[6] ? row[6].toString().trim() : "",
                row[7] ? row[7].toString().trim() : ""
            ]
        });
    }
    alert("Tải câu hỏi từ tệp Excel thành công!");
    handleRoundChange();
}

function handleRoundChange() {
    const round = parseInt(document.getElementById('select-round').value);
    sendCommand('change_round', { round: round });

    const qSelect = document.getElementById('select-question-index');
    qSelect.innerHTML = "";
    
    const filteredQuestions = excelDataStore.filter(item => item.round === round);
    if(filteredQuestions.length === 0) {
        qSelect.innerHTML = '<option value="">-- Không có câu hỏi nào thuộc vòng này --</option>';
        return;
    }

    filteredQuestions.forEach((q, idx) => {
        const opt = document.createElement('option');
        opt.value = excelDataStore.indexOf(q);
        opt.innerText = `Câu ${idx + 1}: ${q.questionText.substring(0, 30)}...`;
        qSelect.appendChild(opt);
    });

    loadSelectedQuestion();
}

function loadSelectedQuestion() {
    const qIdx = document.getElementById('select-question-index').value;
    if(qIdx === "") return;
    
    const currentData = excelDataStore[qIdx];
    if (currentData) {
        document.getElementById('topic-a').value = currentData.topicA;
        document.getElementById('topic-b').value = currentData.topicB;
        document.getElementById('question-input').value = currentData.questionText || "";
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`ans-${i}`).value = currentData.answers[i-1] || "";
        }
    }
}

function sendTopics() {
    const ta = document.getElementById('topic-a').value;
    const tb = document.getElementById('topic-b').value;
    sendCommand('show_topics', { ta, tb });
}

function lockTopic(type) {
    const topicName = type === 'A' ? document.getElementById('topic-a').value : document.getElementById('topic-b').value;
    sendCommand('lock_topic', { type, topicName });
}

function sendQuestion() {
    const qText = document.getElementById('question-input').value;
    sendCommand('update_content', { type: 'question', data: { question: qText } });
}

function sendSingleAnswer(id) {
    const text = document.getElementById(`ans-${id}`).value;
    sendCommand('update_single_answer', { id, text });
}

channel.onmessage = function(event) {
    if (event.data.action === 'sync_bets_to_mc') {
        const data = event.data.data;
        for (let i = 1; i <= 4; i++) {
            if (document.getElementById(`mc-bet-${i}`)) {
                document.getElementById(`mc-bet-${i}`).innerText = (data[`b${i}`] || 0).toLocaleString('vi-VN') + " $A";
            }
        }
    }
};

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    updateTimerDisplay();
    sendCommand('timer_control', { status: 'start', time: timeLeft });
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
    sendCommand('timer_control', { status: 'stop' }); 
}

function updateTimerDisplay() {
    let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function openDoor(doorId) { sendCommand('open_door', { doorId }); }
function collectWinningMoney() { sendCommand('collect_winning'); }
function penaltyFine() { sendCommand('penalty_fine'); }

function resetRound() {
    stopTimer();
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: --:--`;
    for (let i = 1; i <= 4; i++) {
        if(document.getElementById(`mc-bet-${i}`)) document.getElementById(`mc-bet-${i}`).innerText = "0 $A";
    }
    sendCommand('reset_round');
}