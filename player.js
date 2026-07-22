const moneyBoard = document.getElementById('money-board');
const tableDesk = document.getElementById('table-desk');
const doors = document.querySelectorAll('.door');
const gameTimer = document.getElementById('game-timer');

const VALUE_PER_STACK = 25000; 
let selectedDoor = null; 
let isLock = true; 
let currentRound = 1;

let enteredPinDigits = "";
let currentPin = localStorage.getItem('game_pin') || '1234';
const playerTabId = 'player_' + Math.random().toString(36).substring(2, 9);

const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');

// --- PIN SECURITY & KEYPAD ---
function keypadPress(val) {
    if (val === 'C') {
        enteredPinDigits = "";
    } else if (val === 'DEL') {
        enteredPinDigits = enteredPinDigits.slice(0, -1);
    } else {
        if (enteredPinDigits.length < 4) {
            enteredPinDigits += val;
        }
    }
    updatePinDisplay();
    if (enteredPinDigits.length === 4) {
        submitPin();
    }
}

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    if (display) {
        display.innerText = '•'.repeat(enteredPinDigits.length);
    }
}

function submitPin() {
    const errorEl = document.getElementById('pin-error');
    if (enteredPinDigits === currentPin) {
        if (errorEl) errorEl.innerText = "";
        unlockPlayerScreen();
        localStorage.setItem('player_auth_pin', currentPin);
        channel.postMessage({
            action: 'player_authenticated',
            data: { pin: currentPin, senderId: playerTabId }
        });
        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
    } else {
        if (errorEl) errorEl.innerText = "❌ Mã PIN sai! Vui lòng thử lại.";
        enteredPinDigits = "";
        updatePinDisplay();
    }
}

function unlockPlayerScreen() {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'none';
}

function lockPlayerScreen() {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'flex';
    enteredPinDigits = "";
    updatePinDisplay();
}

function checkInitialAuth() {
    channel.postMessage({ action: 'request_pin' });
    const savedAuth = localStorage.getItem('player_auth_pin');
    const storedPin = localStorage.getItem('game_pin') || '1234';
    if (savedAuth && savedAuth === storedPin) {
        unlockPlayerScreen();
        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
    } else {
        lockPlayerScreen();
    }
}

document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay && overlay.style.display !== 'none') {
        if (e.key >= '0' && e.key <= '9') {
            keypadPress(e.key);
        } else if (e.key === 'Backspace') {
            keypadPress('DEL');
        } else if (e.key === 'Enter') {
            submitPin();
        } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            keypadPress('C');
        }
    }
});

// --- MULTI-TAB PLAYER STATE SYNC ---
function broadcastPlayerStackState() {
    const stackLocationMap = {};
    for (let i = 1; i <= 40; i++) {
        const stack = document.getElementById(`money-${i}`);
        if (stack && stack.parentNode) {
            stackLocationMap[`money-${i}`] = stack.parentNode.id;
        }
    }
    const bets = {
        b1: parseInt(document.getElementById('door-1').getAttribute('data-bet')) || 0,
        b2: parseInt(document.getElementById('door-2').getAttribute('data-bet')) || 0,
        b3: parseInt(document.getElementById('door-3').getAttribute('data-bet')) || 0,
        b4: parseInt(document.getElementById('door-4').getAttribute('data-bet')) || 0
    };
    channel.postMessage({
        action: 'sync_player_state',
        data: {
            senderId: playerTabId,
            stackLocationMap: stackLocationMap,
            bets: bets
        }
    });
}

function addMoneyToDoor(doorId) {
    if (isLock) return;
    const door = document.getElementById(`door-${doorId}`);
    if (!door || door.classList.contains('dropped')) return;

    const availableMoney = moneyBoard.querySelector('.money-stack');
    if (availableMoney) {
        door.appendChild(availableMoney);
        availableMoney.draggable = false;
        let currentBet = (parseInt(door.getAttribute('data-bet')) || 0) + VALUE_PER_STACK;
        door.setAttribute('data-bet', currentBet);
        updateDoorBetDisplay(door);
        broadcastPlayerStackState();
    }
}

function removeMoneyFromDoor(doorId) {
    if (isLock) return;
    const door = document.getElementById(`door-${doorId}`);
    if (!door || door.classList.contains('dropped')) return;

    const moneyInDoor = door.querySelector('.money-stack');
    if (moneyInDoor) {
        moneyBoard.appendChild(moneyInDoor);
        moneyInDoor.draggable = true;
        let currentBet = (parseInt(door.getAttribute('data-bet')) || 0) - VALUE_PER_STACK;
        door.setAttribute('data-bet', currentBet);
        updateDoorBetDisplay(door);
        broadcastPlayerStackState();
    }
}

function syncBetsToController() {
    const betData = {
        b1: parseInt(document.getElementById('door-1').getAttribute('data-bet')) || 0,
        b2: parseInt(document.getElementById('door-2').getAttribute('data-bet')) || 0,
        b3: parseInt(document.getElementById('door-3').getAttribute('data-bet')) || 0,
        b4: parseInt(document.getElementById('door-4').getAttribute('data-bet')) || 0
    };
    channel.postMessage({ action: 'sync_bets_to_mc', data: betData });
}

// Khởi tạo 40 cọc tiền
for (let i = 1; i <= 40; i++) {
    const moneyStack = document.createElement('div');
    moneyStack.className = 'money-stack';
    moneyStack.draggable = true;
    moneyStack.id = `money-${i}`;
    const img = document.createElement('img');
    img.src = '50$A.png'; img.alt = '50 $A';
    moneyStack.appendChild(img);
    moneyBoard.appendChild(moneyStack);

    moneyStack.addEventListener('dragstart', (e) => {
        if(isLock) return e.preventDefault();
        if (selectedDoor) { selectedDoor.classList.remove('selected'); selectedDoor = null; }
        e.dataTransfer.setData('text/plain', e.currentTarget.id);
    });
}

function updateDoorBetDisplay(door) {
    const currentBet = parseInt(door.getAttribute('data-bet')) || 0;
    const doorId = door.id.split('-')[1];
    document.getElementById(`bet-${doorId}`).innerText = currentBet.toLocaleString('vi-VN') + ' $A';
    syncBetsToController(); 
}

doors.forEach(door => {
    door.addEventListener('click', (e) => {
        e.stopPropagation();
        if(isLock || door.classList.contains('dropped')) return;

        if (selectedDoor && selectedDoor !== door) {
            const moneyInSelectedDoor = selectedDoor.querySelector('.money-stack');
            if (moneyInSelectedDoor) {
                door.appendChild(moneyInSelectedDoor);
                let oldBet = (parseInt(selectedDoor.getAttribute('data-bet')) || 0) - VALUE_PER_STACK;
                selectedDoor.setAttribute('data-bet', oldBet); updateDoorBetDisplay(selectedDoor);
                let newBet = (parseInt(door.getAttribute('data-bet')) || 0) + VALUE_PER_STACK;
                door.setAttribute('data-bet', newBet); updateDoorBetDisplay(door);
            }
            if (parseInt(selectedDoor.getAttribute('data-bet')) === 0) { selectedDoor.classList.remove('selected'); selectedDoor = null; }
        } else if (!selectedDoor && (parseInt(door.getAttribute('data-bet')) || 0) > 0) {
            selectedDoor = door; door.classList.add('selected');
        } else {
            if (selectedDoor === door) { door.classList.remove('selected'); selectedDoor = null; }
            const availableMoney = moneyBoard.querySelector('.money-stack');
            if (availableMoney) {
                door.appendChild(availableMoney); availableMoney.draggable = false;
                let currentBet = (parseInt(door.getAttribute('data-bet')) || 0) + VALUE_PER_STACK;
                door.setAttribute('data-bet', currentBet); updateDoorBetDisplay(door);
            }
        }
        broadcastPlayerStackState();
    });

    door.addEventListener('dragover', (e) => { if(!isLock && !door.classList.contains('dropped')) e.preventDefault(); door.classList.add('drag-over'); });
    door.addEventListener('dragleave', () => { door.classList.remove('drag-over'); });
    door.addEventListener('drop', (e) => {
        e.preventDefault(); door.classList.remove('drag-over');
        if(isLock || door.classList.contains('dropped')) return;
        const id = e.dataTransfer.getData('text/plain');
        const draggedElement = document.getElementById(id);
        if (draggedElement && draggedElement.parentNode === moneyBoard) {
            door.appendChild(draggedElement); draggedElement.draggable = false; 
            let currentBet = (parseInt(door.getAttribute('data-bet')) || 0) + VALUE_PER_STACK;
            door.setAttribute('data-bet', currentBet); updateDoorBetDisplay(door);
            broadcastPlayerStackState();
        }
    });
});

tableDesk.addEventListener('click', () => {
    if (selectedDoor) {
        const moneyInDoor = selectedDoor.querySelector('.money-stack');
        if (moneyInDoor) {
            moneyBoard.appendChild(moneyInDoor); moneyInDoor.draggable = true; 
            let currentBet = (parseInt(selectedDoor.getAttribute('data-bet')) || 0) - VALUE_PER_STACK;
            selectedDoor.setAttribute('data-bet', currentBet); updateDoorBetDisplay(selectedDoor);
        }
        if (parseInt(selectedDoor.getAttribute('data-bet')) === 0) { selectedDoor.classList.remove('selected'); selectedDoor = null; }
        broadcastPlayerStackState();
    }
});

document.body.addEventListener('click', () => { if (selectedDoor) { selectedDoor.classList.remove('selected'); selectedDoor = null; } });

channel.onmessage = function(event) {
    const { action, data } = event.data;

    switch(action) {
        case 'update_pin':
            currentPin = data.pin;
            localStorage.setItem('game_pin', currentPin);
            if (data.forceLock || localStorage.getItem('player_auth_pin') !== currentPin) {
                localStorage.removeItem('player_auth_pin');
                lockPlayerScreen();
            }
            break;

        case 'player_authenticated':
            if (data.pin === currentPin) {
                localStorage.setItem('player_auth_pin', data.pin);
                unlockPlayerScreen();
            }
            break;

        case 'request_player_state':
            if (data.senderId !== playerTabId) {
                broadcastPlayerStackState();
            }
            break;

        case 'sync_player_state':
            if (data.senderId === playerTabId) break;
            
            if (data.stackLocationMap) {
                Object.keys(data.stackLocationMap).forEach(stackId => {
                    const stack = document.getElementById(stackId);
                    const targetId = data.stackLocationMap[stackId];
                    if (stack && targetId) {
                        const targetElem = document.getElementById(targetId);
                        if (targetElem && stack.parentNode !== targetElem) {
                            targetElem.appendChild(stack);
                            if (targetId === 'money-board') {
                                stack.draggable = true;
                            } else {
                                stack.draggable = false;
                            }
                        }
                    }
                });
            }

            if (data.bets) {
                for (let i = 1; i <= 4; i++) {
                    const d = document.getElementById(`door-${i}`);
                    if (d) {
                        const betVal = data.bets[`b${i}`] || 0;
                        d.setAttribute('data-bet', betVal);
                        const betEl = document.getElementById(`bet-${i}`);
                        if (betEl) betEl.innerText = betVal.toLocaleString('vi-VN') + ' $A';
                    }
                }
                syncBetsToController();
            }
            break;

        case 'show_topics':
            document.getElementById('question-text').innerHTML = `LỰA CHỌN CHỦ ĐỀ:<br><br> ${data.topicA} <br>HOẶC<br> ${data.topicB}`;
            break;
        
        case 'lock_topic':
            document.getElementById('question-text').innerText = `CHỦ ĐỀ ĐƯỢC CHỌN: ${data.topicName.toUpperCase()}`;
            break;

        case 'update_single_answer':
            if (document.getElementById(`ans-txt-${data.id}`)) {
                const aEl = document.getElementById(`ans-txt-${data.id}`);
                aEl.innerText = data.text;
                aEl.classList.remove('dropped-money-font');
            }
            break;

        case 'update_content':
            if(data.type === 'question') {
                document.getElementById('question-text').innerText = data.data.question;
            }
            break;

        case 'change_round':
            if (data.roundNum) {
                currentRound = parseInt(data.roundNum);
            } else {
                currentRound = parseInt(data.round) || 1;
            }
            document.getElementById('wrap-4').style.display = (data.round == '1') ? 'flex' : 'none';
            document.getElementById('wrap-3').style.display = (data.round == '1' || data.round == '5') ? 'flex' : 'none';
            break;

        case 'timer_control':
            if(data.status==="start"){
                isLock=false;
                document.getElementById("table-guide").innerText="THỜI GIAN ĐANG CHẠY!";
            }

            if(data.status==="add30"){
                isLock=false;
                document.getElementById("table-guide").innerText="ĐƯỢC CỘNG THÊM 30 GIÂY";
            }

            if(data.status==="stop"){
                isLock=true;
            }

            if(data.status==="timeout"){
                isLock=true;
            }

            formatTimer(data.time);
            break;

        case 'timer_tick':
            formatTimer(data.time);
            break;

        case 'open_door':
            const dWrap = document.getElementById(`wrap-${data.doorId}`);
            const door = document.getElementById(`door-${data.doorId}`);
            const betBox = document.getElementById(`bet-${data.doorId}`);
            const ansBox = document.getElementById(`ans-txt-${data.doorId}`);
            
            if(door && dWrap) {
                const currentBet = parseInt(door.getAttribute('data-bet')) || 0;
                door.classList.add('dropped');
                dWrap.classList.add('failed'); 
                if (currentBet > 0) {
                    ansBox.innerText = `${currentBet.toLocaleString('vi-VN')} $A ĐÃ RƠI`;
                    ansBox.classList.add('dropped-money-font');
                } else {
                    ansBox.innerText = "ĐÃ RƠI HẾT TIỀN";
                    ansBox.classList.remove('dropped-money-font');
                }
                betBox.style.visibility = 'hidden';
                door.innerHTML = '';
                door.setAttribute('data-bet', '0');
                syncBetsToController(); 
                broadcastPlayerStackState();
            }
            break;

        case 'collect_winning':
            doors.forEach(d => {
                if (!d.classList.contains('dropped')) {
                    const remainingStacks = d.querySelectorAll('.money-stack');
                    remainingStacks.forEach(stack => {
                        moneyBoard.appendChild(stack); 
                        stack.draggable = true;       
                    });
                    d.setAttribute('data-bet', '0');
                    updateDoorBetDisplay(d);
                }
            });
            document.getElementById('table-guide').innerText = "ĐÃ HOÀN TIỀN THẮNG VỀ BÀN TIỀN CHUẨN BỊ CHO VÒNG TIẾP THEO!";
            syncBetsToController();
            broadcastPlayerStackState();
            break;

        case 'penalty_fine':
            const moneyInGrid = moneyBoard.querySelector('.money-stack');
            if (moneyInGrid) moneyInGrid.remove();
            broadcastPlayerStackState();
            break;

        case 'reset_round':
            isLock = true;
            gameTimer.innerText = "01:00";
            gameTimer.classList.remove('warning');
            document.getElementById('table-guide').innerText = "Vui lòng đợi lệnh của MC";
            document.getElementById('question-text').innerText = "CHỜ MC NẠP CHỦ ĐỀ...";
            
            const allStacks = document.querySelectorAll('.money-stack');
            allStacks.forEach(stack => {
                moneyBoard.appendChild(stack);
                stack.draggable = true;
            });

            doors.forEach(d => {
                d.classList.remove('dropped');
                d.setAttribute('data-bet', '0');
                const dId = d.id.split('-')[1];
                document.getElementById(`bet-${dId}`).style.visibility = 'visible';
                document.getElementById(`bet-${dId}`).innerText = "0 $A";
                const aBox = document.getElementById(`ans-txt-${dId}`);
                aBox.innerText = "---";
                aBox.classList.remove('dropped-money-font');
                document.getElementById(`wrap-${dId}`).classList.remove('failed');
            });
            syncBetsToController();
            broadcastPlayerStackState();
            break;
    }
};

function formatTimer(timeLeft) {
    if(!timeLeft && timeLeft !== 0) return;
    let m = Math.floor(timeLeft / 60); 
    let s = timeLeft % 60;
    gameTimer.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', () => {
    checkInitialAuth();
});

