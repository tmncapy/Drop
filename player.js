const moneyBoard = document.getElementById('money-board');
const tableDesk = document.getElementById('table-desk');
const doors = document.querySelectorAll('.door');
const gameTimer = document.getElementById('game-timer');

const VALUE_PER_STACK = 25000; 
let selectedDoor = null; 
let isLock = true; 

const channel = new BroadcastChannel('gameshow_money_drop');

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
    }
});

document.body.addEventListener('click', () => { if (selectedDoor) { selectedDoor.classList.remove('selected'); selectedDoor = null; } });

channel.onmessage = function(event) {
    const { action, data } = event.data;

    switch(action) {
        case 'show_topics':
            document.getElementById('question-text').innerHTML = `LỰA CHỌN CHỦ ĐỀ:<br><br> ${data.ta} <br>HOẶC<br> ${data.tb}`;
            break;
        
        case 'lock_topic':
            document.getElementById('question-text').innerText = `CHỦ ĐỀ ĐƯỢC CHỌN: ${data.topicName.toUpperCase()}`;
            break;

        case 'update_single_answer':
            if (document.getElementById(`ans-txt-${data.id}`)) {
                document.getElementById(`ans-txt-${data.id}`).innerText = data.text;
            }
            break;

        case 'update_content':
            if(data.type === 'question') {
                document.getElementById('question-text').innerText = data.data.question;
            }
            break;

        case 'change_round':
            document.getElementById('wrap-4').style.display = (data.round == '1') ? 'flex' : 'none';
            document.getElementById('wrap-3').style.display = (data.round == '1' || data.round == '5') ? 'flex' : 'none';
            break;

        case 'timer_control':
            if(data.status === 'start' || data.status === 'add30') {
                isLock = false;
                if(data.status === 'add30') gameTimer.classList.add('warning');
                document.getElementById('table-guide').innerText = "THỜI GIAN ĐANG CHẠY! HÃY ĐẶT TIỀN NHANH CHÓNG";
            } else {
                isLock = true;
                document.getElementById('table-guide').innerText = "HẾT GIỜ / ĐÃ CHỐT CƯỢC!";
            }
            formatTimer(data.time || 0);
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
                door.classList.add('dropped');
                dWrap.classList.add('failed'); 
                ansBox.innerText = "ĐÃ RƠI HẾT TIỀN";
                betBox.style.visibility = 'hidden';
                door.innerHTML = '';
                door.setAttribute('data-bet', '0');
                syncBetsToController(); 
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
            break;

        case 'penalty_fine':
            const moneyInGrid = moneyBoard.querySelector('.money-stack');
            if (moneyInGrid) moneyInGrid.remove();
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
                document.getElementById(`ans-txt-${dId}`).innerText = "---";
                document.getElementById(`wrap-${dId}`).classList.remove('failed');
            });
            syncBetsToController();
            break;
    }
};

function formatTimer(timeLeft) {
    if(!timeLeft && timeLeft !== 0) return;
    let m = Math.floor(timeLeft / 60); let s = timeLeft % 60;
    gameTimer.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}