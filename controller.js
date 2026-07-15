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
    // Mỗi 2 hàng là 1 cặp câu hỏi (Ví dụ: Câu 1 có hàng 1 và 2)
    // Cấu trúc cột Excel: STT(0), Chủ đề(1), CÂU HỎI(2), ĐÁP ÁN 1(3), 2(4), 3(5), 4(6)
    // Lưu ý: Dựa trên file Excel bạn cung cấp, cấu trúc là:
    // Cột A: STT, Cột B: Chủ đề, Cột C: CÂU HỎI, Cột D-G: ĐÁP ÁN
    for (let i = 1; i < rows.length; i += 2) {
        const rowA = rows[i];
        const rowB = rows[i + 1];
        if (!rowA) continue;

        excelDataStore.push({
            round: parseInt(rowA[0]), // STT
            topicA: rowA[1] || "",
            topicB: rowB ? (rowB[1] || "") : "",
            questionA: rowA[2] || "",
            questionB: rowB ? (rowB[2] || "") : "",
            ansA: [rowA[3], rowA[4], rowA[5], rowA[6]].filter(a => a !== null && a !== undefined && a !== ""),
            ansB: rowB ? [rowB[3], rowB[4], rowB[5], rowB[6]].filter(a => a !== null && a !== undefined && a !== "") : []
        });
    }
    alert("Đã tải dữ liệu cho 8 câu hỏi!");
    updateQuestionSelector();
}

function updateQuestionSelector() {
    const qSelect = document.getElementById('select-question-index');
    qSelect.innerHTML = "";
    
    excelDataStore.forEach((q, idx) => {
        const optA = document.createElement('option');
        optA.value = `${idx}-A`;
        optA.innerText = `Câu ${q.round}: Chủ đề ${q.topicA}`;
        qSelect.appendChild(optA);

        const optB = document.createElement('option');
        optB.value = `${idx}-B`;
        optB.innerText = `Câu ${q.round}: Chủ đề ${q.topicB}`;
        qSelect.appendChild(optB);
    });
}

function loadSelectedQuestion() {
    const val = document.getElementById('select-question-index').value;
    if (!val) return;
    const [idx, type] = val.split('-');
    const data = excelDataStore[idx];
    
    document.getElementById('topic-a').value = data.topicA;
    document.getElementById('topic-b').value = data.topicB;
    
    if (type === 'A') {
        document.getElementById('question-input').value = data.questionA;
        fillAnswers(data.ansA);
    } else {
        document.getElementById('question-input').value = data.questionB;
        fillAnswers(data.ansB);
    }
}

function fillAnswers(ansList) {
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`ans-${i}`);
        const btn = input.nextElementSibling;
        
        if (i <= ansList.length) {
            input.value = ansList[i-1] || "";
            input.style.display = 'block';
            btn.style.display = 'block';
        } else {
            input.value = "";
            input.style.display = 'none';
            btn.style.display = 'none';
        }
    }
}

function sendTopics() { sendCommand('show_topics', { ta: document.getElementById('topic-a').value, tb: document.getElementById('topic-b').value }); }
function lockTopic(type) { sendCommand('lock_topic', { type, topicName: type === 'A' ? document.getElementById('topic-a').value : document.getElementById('topic-b').value }); }
function sendQuestion() { sendCommand('update_content', { type: 'question', data: { question: document.getElementById('question-input').value } }); }
function sendSingleAnswer(id) { sendCommand('update_single_answer', { id, text: document.getElementById(`ans-${id}`).value }); }

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

function stopTimer() { clearInterval(timerInterval); sendCommand('timer_control', { status: 'stop' }); }

function updateTimerDisplay() {
    let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function openDoor(id) { sendCommand('open_door', { doorId: id }); }
function collectWinningMoney() { sendCommand('collect_winning'); }
function penaltyFine() { sendCommand('penalty_fine'); }
function resetRound() {
    stopTimer();
    document.getElementById('time-display').innerText = `THỜI GIAN ĐẶT CƯỢC: --:--`;
    sendCommand('reset_round');
}
