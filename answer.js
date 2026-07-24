const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
let currentBets = { b1: 0, b2: 0, b3: 0, b4: 0 };
let activeRound = 1;

function setUnusedStatus(doorId, isUnused) {
    const overlay = document.getElementById(`unused-${doorId}`);
    if (overlay) {
        if (isUnused) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
    const betBox = document.getElementById(`bet-box-${doorId}`);
    if (betBox && isUnused) {
        betBox.classList.remove('show');
    }
}

function updateBetDisplays() {
    for (let i = 1; i <= 4; i++) {
        let betVal = 0;
        if (activeRound >= 5 && activeRound <= 7) {
            if (i === 2) betVal = currentBets.b1 || 0;
            else if (i === 3) betVal = currentBets.b2 || 0;
            else if (i === 4) betVal = currentBets.b3 || 0;
            else betVal = 0;
        } else if (activeRound === 8) {
            if (i === 2) betVal = currentBets.b1 || 0;
            else if (i === 3) betVal = currentBets.b2 || 0;
            else betVal = 0;
        } else {
            betVal = currentBets[`b${i}`] || 0;
        }
        const valEl = document.getElementById(`bet-val-${i}`);
        if (valEl) {
            valEl.innerText = `${betVal.toLocaleString('vi-VN')} $A`;
        }
    }
}

channel.onmessage = function(event) {
    const { action, data } = event.data;

    switch(action) {
        case 'sync_bets_to_mc':
            currentBets.b1 = data.b1 || 0;
            currentBets.b2 = data.b2 || 0;
            currentBets.b3 = data.b3 || 0;
            currentBets.b4 = data.b4 || 0;
            
            updateBetDisplays();
            break;

        case 'update_content':
            if (data && data.type === 'question') {
                for (let i = 1; i <= 4; i++) {
                    let isUnused = false;
                    if (activeRound >= 5 && activeRound <= 7 && i === 1) isUnused = true;
                    if (activeRound === 8 && (i === 1 || i === 4)) isUnused = true;

                    if (!isUnused) {
                        const wingL = document.getElementById(`wing-l-${i}`);
                        if (wingL) wingL.classList.add('bg-moneydoor');
                        const wingR = document.getElementById(`wing-r-${i}`);
                        if (wingR) wingR.classList.add('bg-moneydoor');
                        const bgLyr = document.getElementById(`bg-layer-${i}`);
                        if (bgLyr) bgLyr.classList.add('bg-moneydoor');
                    }
                }
            }
            break;

        case 'update_single_answer':
            let targetDoorId = data.id; 

            if (activeRound >= 5 && activeRound <= 7) {
                if (data.id === 1) targetDoorId = 2;
                else if (data.id === 2) targetDoorId = 3;
                else if (data.id === 3) targetDoorId = 4;
                else targetDoorId = null;
            } else if (activeRound === 8) {
                if (data.id === 1) targetDoorId = 2;
                else if (data.id === 2) targetDoorId = 3;
                else targetDoorId = null;
            }

            if (targetDoorId) {
                const insideTxt = document.getElementById(`inside-txt-${targetDoorId}`);
                if (insideTxt) {
                    insideTxt.innerText = data.text;
                    insideTxt.classList.remove('hide-on-drop'); 
                    insideTxt.classList.add('show');
                }

                const surfaceEl = document.getElementById(`surface-${targetDoorId}`);
                if (surfaceEl) {
                    surfaceEl.classList.add('wiped');
                }
            }
            updateBetDisplays();
            break;

        case 'show_all_q_and_a':
            for (let i = 1; i <= 4; i++) {
                let isUnused = false;
                if (activeRound >= 5 && activeRound <= 7 && i === 1) isUnused = true;
                if (activeRound === 8 && (i === 1 || i === 4)) isUnused = true;

                if (!isUnused) {
                    const bBox = document.getElementById(`bet-box-${i}`);
                    if (bBox) bBox.classList.add('show');
                    const wingL = document.getElementById(`wing-l-${i}`);
                    if (wingL) wingL.classList.add('bg-moneydoor');
                    const wingR = document.getElementById(`wing-r-${i}`);
                    if (wingR) wingR.classList.add('bg-moneydoor');
                    const bgLyr = document.getElementById(`bg-layer-${i}`);
                    if (bgLyr) bgLyr.classList.add('bg-moneydoor');
                }
            }
            updateBetDisplays();
            break;

        case 'timer_control':
            // No audio playback on answer.html as per constraints
            break;

        case 'change_round':
            activeRound = parseInt(data.round);
            
            for (let i = 1; i <= 4; i++) {
                const bBox = document.getElementById(`bet-box-${i}`);
                if (bBox) bBox.classList.remove('show');
                const wingL = document.getElementById(`wing-l-${i}`);
                if (wingL) wingL.classList.remove('bg-moneydoor');
                const wingR = document.getElementById(`wing-r-${i}`);
                if (wingR) wingR.classList.remove('bg-moneydoor');
                const bgLyr = document.getElementById(`bg-layer-${i}`);
                if (bgLyr) bgLyr.classList.remove('bg-moneydoor');
                setUnusedStatus(i, false);
            }

            if (activeRound >= 5 && activeRound <= 7) {
                setUnusedStatus(1, true); 
            } else if (activeRound === 8) {
                setUnusedStatus(1, true); 
                setUnusedStatus(4, true); 
            }
            updateBetDisplays();
            break;

        case 'open_door':
            let doorId = data.doorId;
            if (activeRound >= 5 && activeRound <= 7) {
                if (data.doorId === 1) doorId = 2;
                else if (data.doorId === 2) doorId = 3;
                else if (data.doorId === 3) doorId = 4;
                else doorId = null;
            } else if (activeRound === 8) {
                if (data.doorId === 1) doorId = 2;
                else if (data.doorId === 2) doorId = 3;
                else doorId = null;
            }
            if (!doorId) break;

            const droppedBetVal = (activeRound >= 5 && activeRound <= 7)
                ? (currentBets[`b${data.doorId}`] || 0)
                : (activeRound === 8 ? (currentBets[`b${data.doorId}`] || 0) : (currentBets[`b${doorId}`] || 0));

            const wingL = document.getElementById(`wing-l-${doorId}`);
            if (wingL) wingL.classList.remove('bg-moneydoor');
            const wingR = document.getElementById(`wing-r-${doorId}`);
            if (wingR) wingR.classList.remove('bg-moneydoor');

            const betBox = document.getElementById(`bet-box-${doorId}`);
            if (betBox) betBox.classList.remove('show');

            const surface = document.getElementById(`surface-${doorId}`);
            const fallTxt = document.getElementById(`fall-txt-${doorId}`);
            const bgLayer = document.getElementById(`bg-layer-${doorId}`);
            if (bgLayer) bgLayer.classList.remove('bg-moneydoor');
            const insideText = document.getElementById(`inside-txt-${doorId}`);

            const vSplit = document.getElementById(`v-split-${doorId}`);

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
                // Trigger reflow for smooth animation start
                void vSplit.offsetWidth;
                // Phase 1: Entrance Split Vertical In (Cửa sập gập khép từ trên & dưới vào giữa)
                vSplit.classList.add('split-in');

                // Phase 2: Exit Split Vertical Out (Sau đó mở ra thông báo số tiền đã rơi)
                setTimeout(() => {
                    if (bgLayer) bgLayer.classList.add('collapsed-bg'); 
                    if (fallTxt) {
                        fallTxt.innerHTML = `${droppedBetVal.toLocaleString('vi-VN')} $A <br> ĐÃ RƠI`;
                        fallTxt.classList.add('active');
                    }

                    vSplit.classList.remove('split-in');
                    vSplit.classList.add('split-out');

                    setTimeout(() => {
                        vSplit.classList.remove('active', 'split-out');
                    }, 900);
                }, 900);
            } else {
                if (bgLayer) bgLayer.classList.add('collapsed-bg'); 
                if (fallTxt) {
                    fallTxt.innerHTML = `${droppedBetVal.toLocaleString('vi-VN')} $A <br> ĐÃ RƠI`;
                    fallTxt.classList.add('active');
                }
            }
            break;

        case 'reset_round':
            currentBets = { b1: 0, b2: 0, b3: 0, b4: 0 };
            for (let i = 1; i <= 4; i++) {
                const wingL = document.getElementById(`wing-l-${i}`);
                if (wingL) wingL.classList.remove('bg-moneydoor');
                const wingR = document.getElementById(`wing-r-${i}`);
                if (wingR) wingR.classList.remove('bg-moneydoor');
                
                const surfaceReset = document.getElementById(`surface-${i}`);
                if (surfaceReset) surfaceReset.className = "door-surface"; 
                
                const vSplitReset = document.getElementById(`v-split-${i}`);
                if (vSplitReset) vSplitReset.className = "v-split-container";

                const bgLyr = document.getElementById(`bg-layer-${i}`);
                if (bgLyr) {
                    bgLyr.classList.remove('collapsed-bg');
                    bgLyr.classList.remove('bg-moneydoor');
                }
                
                const insideReset = document.getElementById(`inside-txt-${i}`);
                if (insideReset) {
                    insideReset.className = "answer-text-inside"; 
                    insideReset.innerText = "";
                }

                const fallT = document.getElementById(`fall-txt-${i}`);
                if (fallT) {
                    fallT.classList.remove('active');
                    fallT.innerHTML = "";
                }

                const betBoxReset = document.getElementById(`bet-box-${i}`);
                if (betBoxReset) betBoxReset.classList.remove('show');

                setUnusedStatus(i, false);
            }
            updateBetDisplays();
            break;
    }
};
