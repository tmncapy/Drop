const DOOR_ID = typeof window.DOOR_ID !== 'undefined' ? window.DOOR_ID : 1;
const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
let currentBets = { b1: 0, b2: 0, b3: 0, b4: 0 };
let activeRound = null;

let gameSettings = loadAnswerSettings();
function loadAnswerSettings() {
    try {
        const saved = localStorage.getItem('game_settings');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { currencyUnit: '$A' };
}
let CURRENCY_UNIT = gameSettings.currencyUnit || '$A';

function setUnusedStatus(isUnused) {
    const overlay = document.getElementById(`unused-${DOOR_ID}`);
    if (overlay) {
        if (isUnused) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
    const betBox = document.getElementById(`bet-box-${DOOR_ID}`);
    if (betBox && isUnused) {
        betBox.classList.remove('show');
    }
}

function checkIsUnused() {
    if (!activeRound) return true;
    if (activeRound >= 5 && activeRound <= 7 && DOOR_ID === 1) return true;
    if (activeRound === 8 && (DOOR_ID === 1 || DOOR_ID === 4)) return true;
    return false;
}

function updateBetDisplay() {
    const isUnused = checkIsUnused();
    const betVal = isUnused ? 0 : (currentBets[`b${DOOR_ID}`] || 0);

    const valEl = document.getElementById(`bet-val-${DOOR_ID}`);
    if (valEl) {
        valEl.innerText = `${betVal.toLocaleString('vi-VN')} ${CURRENCY_UNIT}`;
    }
}

// Initial state
setUnusedStatus(true);
updateBetDisplay();

channel.onmessage = function(event) {
    const { action, data } = event.data;

    switch(action) {
        case 'update_settings':
            if (data && data.settings) {
                gameSettings = { ...gameSettings, ...data.settings };
                CURRENCY_UNIT = gameSettings.currencyUnit || '$A';
                localStorage.setItem('game_settings', JSON.stringify(gameSettings));
                updateBetDisplay();
            }
            break;

        case 'sync_bets_to_mc':
            currentBets.b1 = data.b1 || 0;
            currentBets.b2 = data.b2 || 0;
            currentBets.b3 = data.b3 || 0;
            currentBets.b4 = data.b4 || 0;
            
            updateBetDisplay();
            break;

        case 'update_content':
            if (data && data.type === 'question') {
                const isUnused = checkIsUnused();
                if (!isUnused) {
                    const wingL = document.getElementById(`wing-l-${DOOR_ID}`);
                    if (wingL) wingL.classList.add('bg-moneydoor');
                    const wingR = document.getElementById(`wing-r-${DOOR_ID}`);
                    if (wingR) wingR.classList.add('bg-moneydoor');
                    const bgLyr = document.getElementById(`bg-layer-${DOOR_ID}`);
                    if (bgLyr) bgLyr.classList.add('bg-moneydoor');
                }
            }
            break;

        case 'update_single_answer':
            let targetDoorId = parseInt(data.id); 

            if (targetDoorId === DOOR_ID) {
                const insideTxt = document.getElementById(`inside-txt-${DOOR_ID}`);
                if (insideTxt) {
                    insideTxt.innerText = data.text;
                    insideTxt.classList.remove('hide-on-drop'); 
                    insideTxt.classList.add('show');
                }

                const surfaceEl = document.getElementById(`surface-${DOOR_ID}`);
                if (surfaceEl) {
                    surfaceEl.classList.add('wiped');
                }
            }
            updateBetDisplay();
            break;

        case 'show_all_q_and_a':
            const isUnusedAll = checkIsUnused();
            if (!isUnusedAll) {
                const bBox = document.getElementById(`bet-box-${DOOR_ID}`);
                if (bBox) bBox.classList.add('show');
                const wingL = document.getElementById(`wing-l-${DOOR_ID}`);
                if (wingL) wingL.classList.add('bg-moneydoor');
                const wingR = document.getElementById(`wing-r-${DOOR_ID}`);
                if (wingR) wingR.classList.add('bg-moneydoor');
                const bgLyr = document.getElementById(`bg-layer-${DOOR_ID}`);
                if (bgLyr) bgLyr.classList.add('bg-moneydoor');
            }
            updateBetDisplay();
            break;

        case 'timer_control':
            break;

        case 'change_round':
            activeRound = parseInt(data.roundNum || data.round);
            
            const bBox = document.getElementById(`bet-box-${DOOR_ID}`);
            if (bBox) bBox.classList.remove('show');
            const wingL = document.getElementById(`wing-l-${DOOR_ID}`);
            if (wingL) wingL.classList.remove('bg-moneydoor');
            const wingR = document.getElementById(`wing-r-${DOOR_ID}`);
            if (wingR) wingR.classList.remove('bg-moneydoor');
            const bgLyr = document.getElementById(`bg-layer-${DOOR_ID}`);
            if (bgLyr) bgLyr.classList.remove('bg-moneydoor');
            
            const isUnusedR = checkIsUnused();
            setUnusedStatus(isUnusedR);
            updateBetDisplay();
            break;

        case 'open_door':
            let openTargetId = parseInt(data.doorId);
            if (openTargetId !== DOOR_ID) break;

            let droppedBetVal = currentBets[`b${DOOR_ID}`] || 0;

            const wL = document.getElementById(`wing-l-${DOOR_ID}`);
            if (wL) wL.classList.remove('bg-moneydoor');
            const wR = document.getElementById(`wing-r-${DOOR_ID}`);
            if (wR) wR.classList.remove('bg-moneydoor');

            const betB = document.getElementById(`bet-box-${DOOR_ID}`);
            if (betB) betB.classList.remove('show');

            const surface = document.getElementById(`surface-${DOOR_ID}`);
            const fallTxt = document.getElementById(`fall-txt-${DOOR_ID}`);
            const bgLayer = document.getElementById(`bg-layer-${DOOR_ID}`);
            if (bgLayer) bgLayer.classList.remove('bg-moneydoor');
            const insideText = document.getElementById(`inside-txt-${DOOR_ID}`);

            const vSplit = document.getElementById(`v-split-${DOOR_ID}`);

            if (insideText) {
                insideText.classList.remove('show');
                insideText.classList.add('hide-on-drop');
            }

            if (surface) {
                surface.classList.remove('wiped', 'closing');
                surface.classList.add('dropped');
            }

            if (vSplit) {
                vSplit.classList.remove('split-out');
                vSplit.classList.add('active');
                void vSplit.offsetWidth;
                vSplit.classList.add('split-in');

                setTimeout(() => {
                    if (bgLayer) bgLayer.classList.add('collapsed-bg'); 
                    if (fallTxt) {
                        fallTxt.innerHTML = `${droppedBetVal.toLocaleString('vi-VN')} ${CURRENCY_UNIT} <br> ĐÃ RƠI`;
                        fallTxt.classList.add('active');
                    }

                    vSplit.classList.remove('split-in');
                    vSplit.classList.add('split-out');

                    setTimeout(() => {
                        vSplit.classList.remove('active', 'split-out');
                    }, 750);
                }, 750);
            } else {
                if (bgLayer) bgLayer.classList.add('collapsed-bg'); 
                if (fallTxt) {
                    fallTxt.innerHTML = `${droppedBetVal.toLocaleString('vi-VN')} ${CURRENCY_UNIT} <br> ĐÃ RƠI`;
                    fallTxt.classList.add('active');
                }
            }
            break;

        case 'reset_round':
            currentBets = { b1: 0, b2: 0, b3: 0, b4: 0 };
            
            const wingLReset = document.getElementById(`wing-l-${DOOR_ID}`);
            if (wingLReset) wingLReset.classList.remove('bg-moneydoor');
            const wingRReset = document.getElementById(`wing-r-${DOOR_ID}`);
            if (wingRReset) wingRReset.classList.remove('bg-moneydoor');
            
            const surfaceReset = document.getElementById(`surface-${DOOR_ID}`);
            if (surfaceReset) surfaceReset.className = "door-surface"; 
            
            const vSplitReset = document.getElementById(`v-split-${DOOR_ID}`);
            if (vSplitReset) vSplitReset.className = "v-split-container";

            const bgLyrReset = document.getElementById(`bg-layer-${DOOR_ID}`);
            if (bgLyrReset) {
                bgLyrReset.classList.remove('collapsed-bg');
                bgLyrReset.classList.remove('bg-moneydoor');
            }
            
            const insideReset = document.getElementById(`inside-txt-${DOOR_ID}`);
            if (insideReset) {
                insideReset.className = "answer-text-inside"; 
                insideReset.innerText = "";
            }

            const fallT = document.getElementById(`fall-txt-${DOOR_ID}`);
            if (fallT) {
                fallT.classList.remove('active');
                fallT.innerHTML = "";
            }

            const betBoxReset = document.getElementById(`bet-box-${DOOR_ID}`);
            if (betBoxReset) betBoxReset.classList.remove('show');

            const isUnusedReset = checkIsUnused();
            setUnusedStatus(isUnusedReset);
            updateBetDisplay();
            break;
    }
};
