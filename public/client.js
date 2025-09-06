document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Game Elements
  const table = document.getElementById('sudoku');
  const scoreboard = document.getElementById('scoreboard');
  const gameTimer = document.getElementById('game-timer'); 
  
  // Controls
  const startBtn = document.getElementById('startGame');
  const difficultySelect = document.getElementById('difficulty');
  const renameBtn = document.getElementById('renameBtn');

  // Collapsible Section Elements
  const collapseButton = document.getElementById('collapse-button');
  const collapseContent = document.getElementById('collapse-content');
  const collapseIcon = document.getElementById('collapse-icon');

  // Popup Modal Elements
  const popupModal = document.getElementById('popup-modal');
  const popupTitle = document.getElementById('popup-title');
  const popupMessage = document.getElementById('popup-message');
  const popupClose = document.getElementById('popup-close');

  let myId = ''; 
  let isGameCurrentlyActive = false;

  function showPopup(title, message, isLargeTitle = false) {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    
    if (isLargeTitle) {
      popupTitle.classList.remove('text-xl');
      popupTitle.classList.add('text-3xl');
    }

    popupModal.classList.remove('hidden');
  }

  function hidePopup() {
    popupModal.classList.add('hidden');
    popupTitle.classList.remove('text-3xl');
    popupTitle.classList.add('text-xl');
  }
  
  popupClose.addEventListener('click', hidePopup);
  popupModal.addEventListener('click', (e) => {
    if (e.target === popupModal) hidePopup();
  });

  collapseButton.addEventListener('click', () => {
    collapseContent.classList.toggle('collapsed');
    collapseIcon.classList.toggle('rotated');
  });

  socket.on('connect', () => {
    const storedPlayerId = sessionStorage.getItem('sudokuPlayerId');
    socket.emit('playerSession', storedPlayerId);
  });

  socket.on('sessionCreated', ({ id, isNew }) => {
    myId = id;
    sessionStorage.setItem('sudokuPlayerId', id);
    if (isNew) {
      const playerName = prompt("Enter your name:") || "Anonymous";
      socket.emit('setName', playerName);
    }
  });

  socket.on('gameState', ({ isGameActive, difficulty }) => {
    isGameCurrentlyActive = isGameActive;
    const hoverClasses = ['hover:bg-blue-600', 'hover:bg-green-600'];
    if (isGameActive) {
      startBtn.disabled = true;
      startBtn.textContent = 'Game in Progress...';
      startBtn.classList.add('bg-gray-500', 'cursor-not-allowed');
      startBtn.classList.remove('bg-blue-500', ...hoverClasses.filter(c => c.includes('blue')));
      renameBtn.disabled = true;
      renameBtn.classList.add('opacity-50', 'cursor-not-allowed');
      renameBtn.classList.remove(...hoverClasses.filter(c => c.includes('green')));
      difficultySelect.value = difficulty;
      difficultySelect.disabled = true;
    } else {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Game';
      startBtn.classList.remove('bg-gray-500', 'cursor-not-allowed');
      startBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
      renameBtn.disabled = false;
      renameBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      renameBtn.classList.add('hover:bg-green-600');
      difficultySelect.disabled = false;
      gameTimer.textContent = ''; 
    }
    // BUG FIX: Removed faulty/unnecessary refresh request. The server already sends scoreboard updates when the state changes.
  });
  
  socket.on('timerUpdate', (elapsedSeconds) => {
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    gameTimer.textContent = `${minutes}:${seconds}`;
  });

  renameBtn.addEventListener('click', () => {
    const newName = prompt("Enter your new name:");
    if (newName && newName.trim() !== '') socket.emit('setName', newName);
  });

  startBtn.addEventListener('click', () => {
    const diff = difficultySelect.value;
    socket.emit('startGame', { difficulty: diff });
  });

  socket.on('puzzle', puzzle => {
    table.innerHTML = '';
    puzzle.forEach((row, i) => {
      const tr = document.createElement('tr');
      row.forEach((cell, j) => {
        const td = document.createElement('td');
        if (cell !== null) {
          td.innerText = cell;
          td.classList.add('default');
          td.contentEditable = false;
        } else {
          td.innerText = '';
          td.contentEditable = true;
          td.classList.add('editable');
        }
        td.dataset.row = i;
        td.dataset.col = j;
        td.addEventListener('input', (e) => {
          const value = parseInt(e.target.innerText, 10);
          if (isNaN(value) || value < 1 || value > 9) {
            e.target.innerText = '';
            return;
          }
          e.target.innerText = value;
          socket.emit('move', { row: i, col: j, value });
        });
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
  });

  socket.on('moveSuccess', ({ row, col, value }) => {
    const td = table.rows[row].cells[col];
    td.innerText = value;
    td.classList.remove('editable');
    td.classList.add('correct');
    td.contentEditable = false;
  });

  socket.on('moveFail', ({ row, col }) => {
    const td = table.rows[row].cells[col];
    td.classList.add('shake');
    setTimeout(() => {
      td.innerText = '';
      td.classList.remove('shake');
    }, 500);
  });

  socket.on('mistake', ({ mistakes }) => {
    showPopup('Incorrect Move!', `That was the wrong number. You now have ${mistakes}/3 mistakes.`);
  });

  socket.on('eliminated', () => {
    showPopup('Eliminated!', 'You have made 3 mistakes and can no longer make moves.');
    const cells = table.querySelectorAll('td.editable');
    cells.forEach(cell => {
      cell.contentEditable = false;
      cell.classList.add('opacity-50', 'cursor-not-allowed');
    });
  });

  socket.on('gameOver', ({ winnerId, playerName, winType }) => {
    let title = '';
    let subtext = '';

    if (winnerId === myId) {
      title = 'You win! 🏆';
    } else {
      title = `${playerName} wins!`;
    }

    if (winType === 'solved') {
      subtext = 'by solving the puzzle first!';
    } else if (winType === 'elimination') {
      subtext = 'as the last one standing.';
    }
    
    showPopup(title, subtext, true);
    table.innerHTML = '';
  });

  socket.on('scoreboard', (scores) => {
    scoreboard.innerHTML = '';
    scores.sort((a, b) => {
      if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
      return b.progress - a.progress;
    });

    scores.forEach(s => {
      const li = document.createElement('li');
      li.className = 'flex items-center gap-2 p-2 rounded transition-colors duration-200';
      if (!s.isConnected && s.disconnectTimeLeft === null) li.classList.add('opacity-50');
      if (s.id === myId) li.classList.add('bg-blue-600', 'font-bold');
      
      const dot = document.createElement('span');
      let dotColorClass = s.isConnected ? (s.solved ? 'bg-yellow-400' : 'bg-green-500') : 'bg-gray-600';
      dot.className = `w-3 h-3 rounded-full flex-shrink-0 ${dotColorClass}`;
      li.appendChild(dot);
      
      let playerText = '';
      if (isGameCurrentlyActive) {
        playerText = `${s.name} - Progress: ${s.progress}/81 - Mistakes: ${s.mistakes}`;
        
        if (s.disconnectTimeLeft !== null) {
          playerText += ` (${s.disconnectTimeLeft}s)`;
        } else if (s.isDisqualified) {
          playerText = `${s.name} - Disqualified  booted`;
          li.classList.add('line-through', 'text-red-400');
        } else if (s.isEliminated) {
          playerText += ' ❌';
          li.classList.add('line-through', 'text-gray-400');
        }
      } else {
        playerText = s.name;
      }

      const text = document.createTextNode(playerText);
      li.appendChild(text);
      scoreboard.appendChild(li);
    });
  });
});

