const moneyBoard = document.getElementById('money-board');
const tableDesk = document.getElementById('table-desk');
const doors = document.querySelectorAll('.door');
const gameTimer = document.getElementById('game-timer');

const VALUE_PER_STACK = 25000; 
let selectedDoor = null; 
let isLock = true; 
let currentRound = 1;

let currentPin = localStorage.getItem('game_pin') || '1234';
const playerTabId = 'player_' + Math.random().toString(36).substring(2, 9);

const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');

// --- ANTI-SPAM BETTING/WITHDRAWAL DELAY (0.2s = 200ms) ---
let lastBetActionTime = 0;
const BET_COOLDOWN_MS = 200;

function isBetActionAllowed() {
    const now = Date.now();
    if (now - lastBetActionTime < BET_COOLDOWN_MS) {
        return false;
    }
    lastBetActionTime = now;
    return true;
}

// --- PIN SECURITY ---
function submitPin() {
    const pinInput = document.getElementById('pin-input');
    const val = pinInput ? pinInput.value.trim() : "";
    const errorEl = document.getElementById('pin-error');
    if (val === currentPin) {
        if (errorEl) errorEl.innerText = "";
        localStorage.setItem('player_authenticated', 'true');
        localStorage.setItem('player_auth_pin', currentPin);
        unlockPlayerScreen();
        channel.postMessage({
            action: 'player_authenticated',
            data: { pin: currentPin, senderId: playerTabId }
        });
        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
    } else {
        if (errorEl) errorEl.innerText = "❌ Mã PIN sai! Vui lòng thử lại.";
        if (pinInput) {
            pinInput.value = "";
            pinInput.focus();
        }
    }
}

function unlockPlayerScreen() {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'none';
}

function lockPlayerScreen(clearInput = true) {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'flex';
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        if (clearInput) {
            pinInput.value = "";
        }
        if (document.activeElement !== pinInput) {
            pinInput.focus();
        }
    }
}

function checkInitialAuth() {
    channel.postMessage({ action: 'request_pin' });
    const isAuth = localStorage.getItem('player_authenticated') === 'true';
    const savedAuth = localStorage.getItem('player_auth_pin');
    const storedPin = localStorage.getItem('game_pin') || '1234';
    if (isAuth && savedAuth && savedAuth === storedPin) {
        unlockPlayerScreen();
        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
    } else {
        localStorage.removeItem('player_authenticated');
        localStorage.removeItem('player_auth_pin');
        lockPlayerScreen(true);
    }
}


// --- MULTI-TAB PLAYER STATE SYNC & MONEY STACK MANAGEMENT ---
function createMoneyStackElement(stackId) {
    const moneyStack = document.createElement('div');
    moneyStack.className = 'money-stack';
    moneyStack.draggable = true;
    moneyStack.id = stackId;
    const img = document.createElement('img');
    img.src = '50$A.png'; 
    img.alt = '50 $A';
    moneyStack.appendChild(img);

    moneyStack.addEventListener('dragstart', (e) => {
        if (isLock) return e.preventDefault();
        if (selectedDoor) { selectedDoor.classList.remove('selected'); selectedDoor = null; }
        e.dataTransfer.setData('text/plain', e.currentTarget.id);
    });
    return moneyStack;
}

function getNextFreeStackId() {
    let maxId = 0;
    const allStacks = document.querySelectorAll('.money-stack');
    allStacks.forEach(s => {
        const num = parseInt(s.id.replace('money-', '')) || 0;
        if (num > maxId) maxId = num;
    });
    return `money-${maxId + 1}`;
}

function updateTotalMoneyBoardGuide() {
    const allStacks = document.querySelectorAll('.money-stack');
    const totalCount = allStacks.length;
    const totalMoney = totalCount * VALUE_PER_STACK;
    const guideEl = document.getElementById('table-guide');
    if (guideEl) {
        guideEl.innerText = `Bàn Tiền (${totalCount} cọc = ${totalMoney.toLocaleString('vi-VN')} $A)`;
    }
}

function addPlayerStacks(count = 1) {
    count = Math.max(1, parseInt(count) || 1);
    for (let i = 0; i < count; i++) {
        const newId = getNextFreeStackId();
        const stackEl = createMoneyStackElement(newId);
        moneyBoard.appendChild(stackEl);
    }
    updateTotalMoneyBoardGuide();
    syncBetsToController();
    broadcastPlayerStackState();
}

function removePlayerStacks(count = 1) {
    count = Math.max(1, parseInt(count) || 1);
    let removed = 0;
    // 1. First remove from moneyBoard
    while (removed < count) {
        const availableMoney = moneyBoard.querySelector('.money-stack');
        if (availableMoney) {
            availableMoney.remove();
            removed++;
        } else {
            break;
        }
    }
    // 2. If moneyBoard empty, remove from doors
    if (removed < count) {
        for (let i = 4; i >= 1; i--) {
            const door = document.getElementById(`door-${i}`);
            if (!door) continue;
            while (removed < count) {
                const stackInDoor = door.querySelector('.money-stack');
                if (stackInDoor) {
                    stackInDoor.remove();
                    removed++;
                    let currentBet = (parseInt(door.getAttribute('data-bet')) || 0) - VALUE_PER_STACK;
                    if (currentBet < 0) currentBet = 0;
                    door.setAttribute('data-bet', currentBet);
                    updateDoorBetDisplay(door);
                } else {
                    break;
                }
            }
            if (removed >= count) break;
        }
    }
    updateTotalMoneyBoardGuide();
    syncBetsToController();
    broadcastPlayerStackState();
}

function setPlayerStacks(targetCount) {
    targetCount = Math.max(0, parseInt(targetCount) || 0);
    const currentStacks = document.querySelectorAll('.money-stack').length;
    if (targetCount > currentStacks) {
        addPlayerStacks(targetCount - currentStacks);
    } else if (targetCount < currentStacks) {
        removePlayerStacks(currentStacks - targetCount);
    } else {
        updateTotalMoneyBoardGuide();
        syncBetsToController();
        broadcastPlayerStackState();
    }
}

function broadcastPlayerStackState() {
    const stackLocationMap = {};
    const allStacks = document.querySelectorAll('.money-stack');
    allStacks.forEach(stack => {
        if (stack && stack.parentNode) {
            stackLocationMap[stack.id] = stack.parentNode.id;
        }
    });
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
            bets: bets,
            totalStacks: allStacks.length
        }
    });
}

function addMoneyToDoor(doorId) {
    if (isLock) return;
    if (!isBetActionAllowed()) return;
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
    if (!isBetActionAllowed()) return;
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
    const allStacks = document.querySelectorAll('.money-stack');
    const betData = {
        b1: parseInt(document.getElementById('door-1').getAttribute('data-bet')) || 0,
        b2: parseInt(document.getElementById('door-2').getAttribute('data-bet')) || 0,
        b3: parseInt(document.getElementById('door-3').getAttribute('data-bet')) || 0,
        b4: parseInt(document.getElementById('door-4').getAttribute('data-bet')) || 0,
        totalStacks: allStacks.length,
        totalMoney: allStacks.length * VALUE_PER_STACK
    };
    channel.postMessage({ action: 'sync_bets_to_mc', data: betData });
}

// Khởi tạo 40 cọc tiền ban đầu
for (let i = 1; i <= 40; i++) {
    const moneyStack = createMoneyStackElement(`money-${i}`);
    moneyBoard.appendChild(moneyStack);
}
updateTotalMoneyBoardGuide();

function updateDoorBetDisplay(door) {
    const currentBet = parseInt(door.getAttribute('data-bet')) || 0;
    const doorId = door.id.split('-')[1];
    document.getElementById(`bet-${doorId}`).innerText = currentBet.toLocaleString('vi-VN') + ' $A';
    syncBetsToController(); 
}

doors.forEach(door => {
    door.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLock || door.classList.contains('dropped')) return;
        if (!isBetActionAllowed()) return;

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
        if (isLock || door.classList.contains('dropped')) return;
        if (!isBetActionAllowed()) return;
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
        if (!isBetActionAllowed()) return;
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
        case 'mqtt_connected':
            channel.postMessage({ action: 'request_pin' });
            channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
            break;

        case 'update_pin':
            if (data && data.pin) {
                const oldPin = currentPin;
                currentPin = data.pin;
                localStorage.setItem('game_pin', currentPin);
                
                const pinNotice = document.getElementById('pin-status-notice');
                if (pinNotice) {
                    pinNotice.innerText = `🟢 Đã đồng bộ mã PIN từ MC`;
                    pinNotice.style.color = '#00e676';
                    pinNotice.style.borderColor = 'rgba(0,230,118,0.3)';
                }

                const savedAuth = localStorage.getItem('player_auth_pin');

                // Lock screen ONLY if controller changed the PIN or explicitly requested forceLock:
                if (data.forceLock || (oldPin && oldPin !== currentPin)) {
                    localStorage.removeItem('player_authenticated');
                    localStorage.removeItem('player_auth_pin');
                    lockPlayerScreen(true);
                } else if (localStorage.getItem('player_authenticated') === 'true' && savedAuth === currentPin) {
                    unlockPlayerScreen();
                }
            }
            break;

        case 'player_authenticated':
            if (data.pin === currentPin) {
                localStorage.setItem('player_authenticated', 'true');
                localStorage.setItem('player_auth_pin', data.pin);
                unlockPlayerScreen();
            }
            break;

        case 'request_player_state':
            if (data.senderId !== playerTabId) {
                broadcastPlayerStackState();
            }
            break;

        case 'add_player_stacks':
            addPlayerStacks(data ? (parseInt(data.count) || 1) : 1);
            break;

        case 'remove_player_stacks':
            removePlayerStacks(data ? (parseInt(data.count) || 1) : 1);
            break;

        case 'set_player_stacks':
            setPlayerStacks(data ? (parseInt(data.count) || 0) : 0);
            break;

        case 'penalty_fine':
            removePlayerStacks(1);
            break;

        case 'sync_player_state':
            if (data.senderId === playerTabId) break;
            
            if (data.stackLocationMap) {
                const targetLocationMap = data.stackLocationMap;
                
                // 1. Remove local stacks not present in incoming state
                const currentLocalStacks = document.querySelectorAll('.money-stack');
                currentLocalStacks.forEach(stack => {
                    if (!targetLocationMap[stack.id]) {
                        stack.remove();
                    }
                });

                // 2. Add or reposition stacks according to targetLocationMap
                Object.keys(targetLocationMap).forEach(stackId => {
                    const targetId = targetLocationMap[stackId];
                    const targetElem = document.getElementById(targetId);
                    if (targetElem) {
                        let stack = document.getElementById(stackId);
                        if (!stack) {
                            stack = createMoneyStackElement(stackId);
                        }
                        if (stack.parentNode !== targetElem) {
                            targetElem.appendChild(stack);
                            stack.draggable = (targetId === 'money-board');
                        }
                    }
                });
                updateTotalMoneyBoardGuide();
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
            removePlayerStacks(1);
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

    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.addEventListener('input', () => {
            if (pinInput.value.trim().length === 4) {
                submitPin();
            }
        });
        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitPin();
            }
        });
    }

    // Periodically request PIN from MC if screen is locked
    setInterval(() => {
        const overlay = document.getElementById('pin-lock-overlay');
        if (overlay && overlay.style.display !== 'none') {
            channel.postMessage({ action: 'request_pin' });
        }
    }, 2000);
});

