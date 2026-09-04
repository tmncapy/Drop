const moneyBoard = document.getElementById('money-board');
const tableDesk = document.getElementById('table-desk');
const doors = document.querySelectorAll('.door');
const gameTimer = document.getElementById('game-timer');

let gameSettings = loadPlayerSettings();

function loadPlayerSettings() {
    try {
        const saved = localStorage.getItem('game_settings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch(e) {}
    return { timerSeconds: 60, initialStacks: 40, stackValue: 25000, currencyUnit: '$A', totalQuestions: 8, betDelaySeconds: 0.125 };
}

let VALUE_PER_STACK = gameSettings.stackValue || 25000;
let CURRENCY_UNIT = gameSettings.currencyUnit || '$A';
let selectedDoor = null; 
let isLock = true; 
let currentRound = 1;

let currentPin = localStorage.getItem('game_pin') || '1234';
const playerTabId = 'player_' + Math.random().toString(36).substring(2, 9);

// --- URL PARAMETERS FOR DIRECT PLAYER LINK ACCESS ---
const urlParams = new URLSearchParams(window.location.search);
const urlRoomId = urlParams.get('roomid');
const urlAuth = urlParams.get('auth');
const isUrlLinkMode = Boolean(urlRoomId && urlAuth);
let isCurrentLinkInvalidated = false;

const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');

// --- ANTI-SPAM BETTING/WITHDRAWAL DELAY (Default 0.125s = 125ms) ---
let lastBetActionTime = 0;
let BET_COOLDOWN_MS = (gameSettings.betDelaySeconds !== undefined ? parseFloat(gameSettings.betDelaySeconds) : 0.125) * 1000;

function isBetActionAllowed() {
    if (isCurrentLinkInvalidated) return false;
    const now = Date.now();
    if (now - lastBetActionTime < BET_COOLDOWN_MS) {
        return false;
    }
    lastBetActionTime = now;
    return true;
}

// --- PIN & DIRECT LINK SECURITY ---
function submitPin() {
    const pinInput = document.getElementById('pin-input');
    const val = pinInput ? pinInput.value.trim() : "";
    const errorEl = document.getElementById('pin-error');
    const validPin = currentPin || localStorage.getItem('game_pin') || '1234';

    if (val === validPin) {
        if (errorEl) errorEl.innerText = "";
        localStorage.setItem('player_authenticated', 'true');
        localStorage.setItem('player_auth_pin', validPin);
        sessionStorage.setItem('auth_pin_player', validPin);
        unlockPlayerScreen();
        channel.postMessage({
            action: 'player_authenticated',
            data: { pin: validPin, senderId: playerTabId }
        });
        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
    } else {
        if (errorEl) errorEl.innerText = "❌ Mã PIN không đúng! Vui lòng thử lại.";
        if (pinInput) {
            pinInput.focus();
        }
    }
}

function unlockPlayerScreen() {
    if (isCurrentLinkInvalidated) return;
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'none';
}

function lockPlayerScreen(clearInput = false) {
    if (isCurrentLinkInvalidated) return;
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

function showLinkInvalidatedScreen(room, reason) {
    isCurrentLinkInvalidated = true;
    isLock = true;
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.style.display = 'flex';

    const card = document.querySelector('.pin-card');
    if (card) {
        card.innerHTML = `
            <div class="pin-icon" style="font-size: 46px; margin-bottom: 8px;">🚫</div>
            <h2 style="color: #ef4444; font-size: 19px; font-weight: bold; margin-bottom: 6px;">LIÊN KẾT ĐÃ BỊ VÔ HIỆU HÓA</h2>
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; border-radius: 8px; padding: 12px; color: #fca5a5; font-size: 13px; line-height: 1.5; text-align: center; margin: 10px 0;">
                ${reason || 'Đường link này đã bị Controller vô hiệu hóa do đã tạo đường link mới.'}
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin: 6px 0 12px 0;">
                Mã phòng: <strong style="color: #f59e0b;">${room || urlRoomId || 'Không xác định'}</strong>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 14px;">
                💡 Vui lòng liên hệ Kỹ thuật / MC để nhận đường link tham gia mới nhất.
            </div>
            <button class="pin-submit-btn" style="background: #334155; border: 1px solid #475569; width: 100%;" onclick="window.location.reload()">
                🔄 TẢI LẠI TRANG
            </button>
        `;
    }
}

function checkInitialAuth() {
    channel.postMessage({ action: 'request_pin' });
    channel.postMessage({ 
        action: 'request_active_room_auth',
        data: { urlRoomId, urlAuth, senderId: playerTabId }
    });

    if (isUrlLinkMode) {
        const pinNotice = document.getElementById('pin-status-notice');
        if (pinNotice) {
            pinNotice.innerText = `🔍 Đang xác thực đường link (Phòng: ${urlRoomId})...`;
            pinNotice.style.color = '#38bdf8';
            pinNotice.style.borderColor = 'rgba(56,189,248,0.4)';
        }

        const activeRoom = localStorage.getItem('active_player_room_id');
        const activeAuth = localStorage.getItem('active_player_auth_token');

        if (activeRoom && activeAuth) {
            if (urlRoomId === activeRoom && urlAuth === activeAuth) {
                // Valid link cached!
                localStorage.setItem('player_authenticated', 'true');
                localStorage.setItem('player_auth_pin', urlRoomId);
                unlockPlayerScreen();
                channel.postMessage({
                    action: 'player_authenticated',
                    data: { roomid: urlRoomId, auth: urlAuth, senderId: playerTabId, viaLink: true }
                });
                channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
                return;
            } else {
                // Mismatch with stored active link
                showLinkInvalidatedScreen(urlRoomId, "Link này đã bị vô hiệu hóa vì Controller đã tạo một đường link mới!");
                return;
            }
        }
    } else {
        const isAuth = localStorage.getItem('player_authenticated') === 'true';
        const savedAuth = localStorage.getItem('player_auth_pin') || sessionStorage.getItem('auth_pin_player');
        const storedPin = localStorage.getItem('game_pin') || '1234';
        if (isAuth && savedAuth && savedAuth === storedPin) {
            unlockPlayerScreen();
            channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
        } else {
            lockPlayerScreen(false);
        }
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
        guideEl.innerText = `Bàn Tiền (${totalCount} cọc = ${totalMoney.toLocaleString('vi-VN')} ${CURRENCY_UNIT})`;
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

let broadcastScheduled = false;
function broadcastPlayerStackState() {
    if (broadcastScheduled) return;
    broadcastScheduled = true;
    requestAnimationFrame(() => {
        broadcastScheduled = false;
        const stackLocationMap = {};
        const allStacks = document.querySelectorAll('.money-stack');
        for (let i = 0; i < allStacks.length; i++) {
            const stack = allStacks[i];
            if (stack && stack.parentNode) {
                stackLocationMap[stack.id] = stack.parentNode.id;
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
                bets: bets,
                totalStacks: allStacks.length
            }
        });
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

let syncBetsScheduled = false;
function syncBetsToController() {
    if (syncBetsScheduled) return;
    syncBetsScheduled = true;
    requestAnimationFrame(() => {
        syncBetsScheduled = false;
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
    });
}

// Khởi tạo cọc tiền ban đầu từ cài đặt
const initStackCount = gameSettings.initialStacks || 40;
for (let i = 1; i <= initStackCount; i++) {
    const moneyStack = createMoneyStackElement(`money-${i}`);
    moneyBoard.appendChild(moneyStack);
}
updateTotalMoneyBoardGuide();

function updateDoorBetDisplay(door) {
    const currentBet = parseInt(door.getAttribute('data-bet')) || 0;
    const doorId = door.id.split('-')[1];
    document.getElementById(`bet-${doorId}`).innerText = currentBet.toLocaleString('vi-VN') + ' ' + CURRENCY_UNIT;
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
            channel.postMessage({ 
                action: 'request_active_room_auth',
                data: { urlRoomId, urlAuth, senderId: playerTabId }
            });
            channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
            break;

        case 'update_player_room_auth':
            if (data && data.roomid && data.auth) {
                localStorage.setItem('active_player_room_id', data.roomid);
                localStorage.setItem('active_player_auth_token', data.auth);
                localStorage.setItem('game_pin', data.roomid);
                currentPin = data.roomid;

                const pinNotice = document.getElementById('pin-status-notice');
                if (pinNotice) {
                    pinNotice.innerText = `🟢 Đã đồng bộ Phòng: ${data.roomid}`;
                    pinNotice.style.color = '#00e676';
                    pinNotice.style.borderColor = 'rgba(0,230,118,0.3)';
                }

                if (isUrlLinkMode) {
                    if (urlRoomId === data.roomid && urlAuth === data.auth) {
                        // Link is currently valid!
                        isCurrentLinkInvalidated = false;
                        localStorage.setItem('player_authenticated', 'true');
                        localStorage.setItem('player_auth_pin', data.roomid);
                        unlockPlayerScreen();
                        channel.postMessage({
                            action: 'player_authenticated',
                            data: { roomid: data.roomid, auth: data.auth, senderId: playerTabId, viaLink: true }
                        });
                        channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
                    } else {
                        // Controller generated a new link! Old link MUST be invalidated immediately!
                        showLinkInvalidatedScreen(urlRoomId, "Đường link bạn đang sử dụng đã bị vô hiệu hóa vì Controller vừa tạo một đường link mới!");
                    }
                } else {
                    if (data.forceInvalidate) {
                        localStorage.removeItem('player_authenticated');
                        localStorage.removeItem('player_auth_pin');
                        sessionStorage.removeItem('auth_pin_player');
                        lockPlayerScreen(true);
                    }
                }
            }
            break;

        case 'player_auth_success':
            if (!data || !data.targetSenderId || data.targetSenderId === playerTabId) {
                isCurrentLinkInvalidated = false;
                localStorage.setItem('player_authenticated', 'true');
                localStorage.setItem('player_auth_pin', data.roomid || urlRoomId);
                unlockPlayerScreen();
                channel.postMessage({ action: 'request_player_state', senderId: playerTabId });
            }
            break;

        case 'player_auth_failed':
            if (!data || !data.targetSenderId || data.targetSenderId === playerTabId) {
                showLinkInvalidatedScreen(urlRoomId, data.reason || "Đường link này không hợp lệ hoặc đã bị vô hiệu hóa!");
            }
            break;

        case 'update_pin':
            if (data && data.pin) {
                currentPin = data.pin;
                localStorage.setItem('game_pin', currentPin);
                
                const pinNotice = document.getElementById('pin-status-notice');
                if (pinNotice) {
                    pinNotice.innerText = `🟢 Đã kết nối với MC`;
                    pinNotice.style.color = '#00e676';
                    pinNotice.style.borderColor = 'rgba(0,230,118,0.3)';
                }

                if (data.forceLock) {
                    localStorage.removeItem('player_authenticated');
                    localStorage.removeItem('player_auth_pin');
                    sessionStorage.removeItem('auth_pin_player');
                    lockPlayerScreen(false);
                } else {
                    const isAuth = localStorage.getItem('player_authenticated') === 'true';
                    const savedAuth = localStorage.getItem('player_auth_pin') || sessionStorage.getItem('auth_pin_player');
                    if (isAuth && savedAuth === currentPin) {
                        unlockPlayerScreen();
                    }
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

        case 'update_settings':
            if (data && data.settings) {
                gameSettings = { ...gameSettings, ...data.settings };
                VALUE_PER_STACK = gameSettings.stackValue || 25000;
                CURRENCY_UNIT = gameSettings.currencyUnit || '$A';
                localStorage.setItem('game_settings', JSON.stringify(gameSettings));
                updateTotalMoneyBoardGuide();
                doors.forEach(d => updateDoorBetDisplay(d));
                syncBetsToController();
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
                        if (betEl) betEl.innerText = betVal.toLocaleString('vi-VN') + ' ' + CURRENCY_UNIT;
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
            let pTargetId = data.id;
            if (pTargetId && document.getElementById(`ans-txt-${pTargetId}`)) {
                const aEl = document.getElementById(`ans-txt-${pTargetId}`);
                aEl.innerText = data.text;
                aEl.classList.remove('dropped-money-font');
            }
            break;

        case 'update_content':
            if(data.type === 'question') {
                document.getElementById('question-text').innerText = data.data.question;
            }
            break;

        case 'update_settings':
            if (data && data.settings) {
                gameSettings = { ...gameSettings, ...data.settings };
                try {
                    localStorage.setItem('game_settings', JSON.stringify(gameSettings));
                } catch(e) {}
                VALUE_PER_STACK = gameSettings.stackValue || 25000;
                CURRENCY_UNIT = gameSettings.currencyUnit || '$A';
                if (gameSettings.betDelaySeconds !== undefined) {
                    BET_COOLDOWN_MS = Math.max(0, parseFloat(gameSettings.betDelaySeconds) || 0) * 1000;
                }
                updateTotalMoneyBoardGuide();
            }
            break;

        case 'change_round':
            if (data.roundNum) {
                currentRound = parseInt(data.roundNum);
            } else {
                currentRound = parseInt(data.round) || 1;
            }
            const r = currentRound;
            const w1 = document.getElementById('wrap-1');
            const w2 = document.getElementById('wrap-2');
            const w3 = document.getElementById('wrap-3');
            const w4 = document.getElementById('wrap-4');
            if (r >= 1 && r <= 4) {
                if (w1) w1.style.display = 'flex';
                if (w2) w2.style.display = 'flex';
                if (w3) w3.style.display = 'flex';
                if (w4) w4.style.display = 'flex';
            } else if (r >= 5 && r <= 7) {
                if (w1) w1.style.display = 'none'; // Door 1 is unused in rounds 5-7
                if (w2) w2.style.display = 'flex';
                if (w3) w3.style.display = 'flex';
                if (w4) w4.style.display = 'flex';
            } else if (r === 8) {
                if (w1) w1.style.display = 'none'; // Doors 1 & 4 unused in round 8
                if (w2) w2.style.display = 'flex';
                if (w3) w3.style.display = 'flex';
                if (w4) w4.style.display = 'none';
            }
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
            let pDoorId = data.doorId;
            if (!pDoorId) break;

            const dWrap = document.getElementById(`wrap-${pDoorId}`);
            const door = document.getElementById(`door-${pDoorId}`);
            const betBox = document.getElementById(`bet-${pDoorId}`);
            const ansBox = document.getElementById(`ans-txt-${pDoorId}`);
            
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
                if (betBox) betBox.style.visibility = 'hidden';
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
                } else {
                    d.querySelectorAll('.money-stack').forEach(s => s.remove());
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
                document.getElementById(`bet-${dId}`).innerText = "0 " + CURRENCY_UNIT;
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
});

