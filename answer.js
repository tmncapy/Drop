const channel = (typeof GameSyncChannel !== 'undefined') ? new GameSyncChannel('gameshow_money_drop') : new BroadcastChannel('gameshow_money_drop');
let currentBets = { b1: 0, b2: 0, b3: 0, b4: 0 };
let activeRound = 1;

function setUnusedStatus(doorId, isUnused) {
    const overlay = document.getElementById(`unused-${doorId}`);
    if (overlay) {
        if (isUnused) overlay.classList.add('active');
        else overlay.classList.remove('active');
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
            
            for(let i = 1; i <= 4; i++) {
                const textEl = document.getElementById(`fall-txt-${i}`);
                if (textEl && textEl.classList.contains('active')) {
                    const betVal = currentBets[`b${i}`] || 0;
                    if (betVal > 0) {
                        textEl.innerHTML = `${betVal.toLocaleString('vi-VN')} $A <br> ĐÃ RƠI`;
                    } else {
                        textEl.innerHTML = `ĐÃ RƠI`;
                    }
                }
            }
            break;

        case 'update_single_answer':
            let targetDoorId = data.id; 

            if (activeRound === 8) {
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
            break;

        case 'timer_control':
            // No audio playback on answer.html as per constraints
            break;

        case 'change_round':
            activeRound = parseInt(data.round);
            
            for (let i = 1; i <= 4; i++) {
                setUnusedStatus(i, false);
            }

            if (activeRound >= 5 && activeRound <= 7) {
                setUnusedStatus(4, true); 
            } else if (activeRound === 8) {
                setUnusedStatus(1, true); 
                setUnusedStatus(4, true); 
            }
            break;

        case 'open_door':
            let doorId = data.doorId;
            if (activeRound === 8) {
                if (data.doorId === 1) doorId = 2;
                else if (data.doorId === 2) doorId = 3;
                else doorId = null;
            }
            if (!doorId) break;

            const surface = document.getElementById(`surface-${doorId}`);
            const fallTxt = document.getElementById(`fall-txt-${doorId}`);
            const bgLayer = document.getElementById(`bg-layer-${doorId}`);
            const insideText = document.getElementById(`inside-txt-${doorId}`);

            if (insideText) {
                insideText.classList.remove('show');
                insideText.classList.add('hide-on-drop');
            }

            if (surface) {
                surface.classList.add('closing');
                surface.classList.remove('wiped');

                setTimeout(() => {
                    surface.classList.remove('closing');
                    surface.classList.add('dropped'); 
                    if (bgLayer) bgLayer.classList.add('collapsed-bg'); 
                    
                    if (fallTxt) {
                        const betVal = currentBets[`b${data.doorId}`] || 0;
                        if (betVal > 0) {
                            fallTxt.innerHTML = `${betVal.toLocaleString('vi-VN')} $A <br> ĐÃ RƠI`;
                        } else {
                            fallTxt.innerHTML = `ĐÃ RƠI`;
                        }
                        fallTxt.classList.add('active');
                    }
                }, 1000);
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
                
                const bgLyr = document.getElementById(`bg-layer-${i}`);
                if (bgLyr) bgLyr.classList.remove('collapsed-bg');
                
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

                setUnusedStatus(i, false);
            }
            break;
    }
};
