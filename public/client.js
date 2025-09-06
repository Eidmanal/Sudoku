document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Controls
  const startBtn = document.getElementById('startGame');
  const difficultySelect = document.getElementById('difficulty');
  const difficultyControl = document.getElementById('difficulty-control');
  const livesSelect = document.getElementById('lives-select');
  const livesControl = document.getElementById('lives-control');
  const renameBtn = document.getElementById('renameBtn');
  const readyBtn = document.getElementById('readyBtn');
  const abortBtn = document.getElementById('abortBtn');
  const notesToggleBtn = document.getElementById('notes-toggle');
  const mobileNotesBtn = document.getElementById('mobile-notes-btn');
  const mobileClearBtn = document.getElementById('mobile-clear-btn');
  
  // Game Elements
  const table = document.getElementById('sudoku');
  const scoreboard = document.getElementById('scoreboard');
  const gameTimer = document.getElementById('game-timer'); 

  // Collapsible Section Elements
  const collapseButton = document.getElementById('collapse-button');
  const collapseContent = document.getElementById('collapse-content');
  const collapseIcon = document.getElementById('collapse-icon');
  const controlsCollapseButton = document.getElementById('controls-collapse-button');
  const controlsCollapseContent = document.getElementById('controls-collapse-content');
  const controlsCollapseIcon = document.getElementById('controls-collapse-icon');

  // Popup Modal Elements
  const popupModal = document.getElementById('popup-modal');
  const popupTitle = document.getElementById('popup-title');
  const popupMessage = document.getElementById('popup-message');
  const popupClose = document.getElementById('popup-close');

  // Mobile Menu Elements
  const menuBtn = document.getElementById('menu-btn');
  const menuCloseBtn = document.getElementById('menu-close-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const overlay = document.getElementById('overlay');
  const menuNotificationDot = document.getElementById('menu-notification-dot');

  let myId = ''; 
  let isNotesMode = false;
  let myNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  let selectedCell = null;
  let isGameCurrentlyActive = false;
  let currentMaxPoints = 0;
  let seenVoteCount = 0;
  let lastScores = []; // To hold the latest scoreboard data for various functions

  // --- Mobile Menu Logic ---
  function openMenu() {
    settingsPanel.classList.add('open');
    overlay.classList.remove('hidden');
    // FIX: Correctly update seen vote count using the last known scores
    seenVoteCount = lastScores.filter(s => s.votedToAbort && s.isConnected).length;
    menuNotificationDot.classList.add('hidden');
  }
  function closeMenu() {
    settingsPanel.classList.remove('open');
    overlay.classList.add('hidden');
  }
  menuBtn.addEventListener('click', openMenu);
  menuCloseBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  // --- Popup Logic ---
  function showPopup(title, message) {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupModal.classList.remove('hidden');
  }
  function hidePopup() { popupModal.classList.add('hidden'); }
  popupClose.addEventListener('click', hidePopup);
  popupModal.addEventListener('click', (e) => { if (e.target === popupModal) hidePopup(); });

  // --- Collapsible Section Logic ---
  collapseButton.addEventListener('click', () => {
    collapseContent.classList.toggle('collapsed');
    collapseIcon.classList.toggle('rotated');
  });
  
  controlsCollapseButton.addEventListener('click', () => {
    controlsCollapseContent.classList.toggle('collapsed');
    controlsCollapseIcon.classList.toggle('rotated');
  });

  // --- Notes Mode Logic ---
  function toggleNotesMode() {
    isNotesMode = !isNotesMode;
    notesToggleBtn.classList.toggle('active', isNotesMode);
    mobileNotesBtn.classList.toggle('active', isNotesMode);
  }
  notesToggleBtn.addEventListener('click', toggleNotesMode);
  mobileNotesBtn.addEventListener('click', toggleNotesMode);
  
  function renderNotes(td, row, col) {
      const existingGrid = td.querySelector('.notes-grid');
      if (existingGrid) existingGrid.remove();
      const notes = myNotes[row][col];
      if (!notes || notes.size === 0) return;
      const grid = document.createElement('div');
      grid.className = 'notes-grid';
      for (let i = 1; i <= 9; i++) {
          const noteCell = document.createElement('div');
          noteCell.className = 'note-number';
          if (notes.has(i)) noteCell.textContent = i;
          grid.appendChild(noteCell);
      }
      td.appendChild(grid);
  }

  // --- Centralized Input Handler ---
  function handleCellInput(cell, value) {
    if (!cell || !cell.classList.contains('editable')) return; 
    const i = parseInt(cell.dataset.row, 10);
    const j = parseInt(cell.dataset.col, 10);
    if (isNotesMode) {
        const notes = myNotes[i][j];
        if (notes.has(value)) { notes.delete(value); } 
        else { notes.add(value); }
        renderNotes(cell, i, j);
    } else {
        myNotes[i][j].clear();
        renderNotes(cell, i, j);
        cell.innerText = value;
        socket.emit('move', { row: i, col: j, value });
    }
  }
  
  mobileClearBtn.addEventListener('click', () => {
    if (!selectedCell || !selectedCell.classList.contains('editable')) return;
    const row = parseInt(selectedCell.dataset.row, 10);
    const col = parseInt(selectedCell.dataset.col, 10);
    myNotes[row][col].clear();
    renderNotes(selectedCell, row, col);
    selectedCell.innerText = '';
  });

  // --- Socket Logic ---
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

  socket.on('gameState', ({ isGameActive, difficulty, lives, maxPoints }) => {
    isGameCurrentlyActive = isGameActive;
    currentMaxPoints = maxPoints;
    const lobbyControls = [renameBtn, readyBtn, startBtn, difficultyControl, livesControl];
    const gameControls = [abortBtn];
    if (isGameActive) {
      lobbyControls.forEach(el => el.classList.add('hidden'));
      gameControls.forEach(el => el.classList.remove('hidden'));
      // FIX: Only update settings when game is active
      difficultySelect.value = difficulty;
      livesSelect.value = lives;
    } else {
      lobbyControls.forEach(el => el.classList.remove('hidden'));
      gameControls.forEach(el => el.classList.add('hidden'));
      gameTimer.textContent = '';
      menuNotificationDot.classList.add('hidden');
      seenVoteCount = 0;
    }
  });
  
  socket.on('timerUpdate', (elapsedSeconds) => {
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    gameTimer.textContent = `${minutes}:${seconds}`;
  });

  socket.on('notAllPlayersReady', () => {
    showPopup('Game Not Started', 'Cannot start the game because some players are not ready.');
  });
  
  socket.on('gameAbortedByVote', () => {
    showPopup('Game Aborted', 'The game was ended by a unanimous vote.');
    table.innerHTML = '';
  });

  renameBtn.addEventListener('click', () => {
    const newName = prompt("Enter your name:");
    if (newName && newName.trim() !== '') socket.emit('setName', newName);
  });

  startBtn.addEventListener('click', () => {
    const diff = difficultySelect.value;
    const lives = parseInt(livesSelect.value, 10);
    socket.emit('startGame', { difficulty: diff, lives: lives });
  });

  readyBtn.addEventListener('click', () => {
    socket.emit('toggleReady');
  });

  abortBtn.addEventListener('click', () => {
    socket.emit('voteToAbort');
  });

  socket.on('puzzle', puzzle => {
    myNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    table.innerHTML = '';
    if (selectedCell) {
        selectedCell.classList.remove('selected');
        selectedCell = null;
    }
    puzzle.forEach((row, i) => {
      const tr = document.createElement('tr');
      row.forEach((cell, j) => {
        const td = document.createElement('td');
        if (cell !== null) {
          td.innerText = cell;
          td.classList.add('default');
        } else {
          td.innerText = '';
          td.classList.add('editable');
        }
        td.dataset.row = i;
        td.dataset.col = j;
        td.addEventListener('click', () => {
            if (td.classList.contains('editable')) {
                if (selectedCell) selectedCell.classList.remove('selected');
                selectedCell = td;
                selectedCell.classList.add('selected');
            }
        });
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
  });

  document.addEventListener('keydown', (e) => {
    const value = parseInt(e.key, 10);
    if (isNaN(value) || value < 1 || value > 9) { return; }
    e.preventDefault();
    handleCellInput(selectedCell, value);
  });

  socket.on('moveSuccess', ({ row, col, value }) => {
    const td = table.rows[row].cells[col];
    myNotes[row][col].clear();
    renderNotes(td, row, col);
    td.innerText = value;
    td.classList.remove('editable', 'selected');
    td.classList.add('correct');
    if (selectedCell === td) { selectedCell = null; }
  });

  socket.on('moveFail', ({ row, col }) => {
    const td = table.rows[row].cells[col];
    td.classList.add('shake');
    setTimeout(() => {
      td.innerText = '';
      td.classList.remove('shake');
    }, 500);
  });

  socket.on('mistake', ({ mistakes, maxMistakes }) => {
    showPopup('Incorrect Move!', `That was the wrong number. You now have ${mistakes}/${maxMistakes} mistakes.`);
  });

  socket.on('eliminated', () => {
    showPopup('Eliminated!', 'You have been eliminated and can no longer make moves.');
    const cells = table.querySelectorAll('td.editable');
    cells.forEach(cell => {
      cell.classList.remove('editable', 'selected');
      cell.classList.add('opacity-50', 'cursor-not-allowed');
    });
    selectedCell = null;
  });

  socket.on('gameOver', ({ winnerId, winnerName, reason }) => {
    let title = '';
    let message = reason;
    if (winnerId === myId) { title = 'You win! 🏆'; } 
    else { title = `${winnerName} wins!`; }
    showPopup(title, message);
    table.innerHTML = '';
  });

  socket.on('scoreboard', (scores) => {
    lastScores = scores; // Update the global scores variable
    scoreboard.innerHTML = '';
    scores.sort((a, b) => b.points - a.points);
    const currentVoteCount = scores.filter(s => s.votedToAbort && s.isConnected).length;
    scores.forEach(s => {
      const li = document.createElement('li');
      li.className = 'p-2 rounded transition-colors duration-200';
      if (s.id === myId) li.classList.add('bg-blue-600');
      if (!s.isConnected && s.disconnectTimeLeft === null) li.classList.add('opacity-50');
      const playerInfoContainer = document.createElement('div');
      playerInfoContainer.className = 'flex items-center gap-2';
      const dot = document.createElement('span');
      let dotColorClass = s.isConnected ? 'bg-green-500' : 'bg-gray-600';
      if (s.solved) dotColorClass = 'bg-yellow-400';
      dot.className = `w-3 h-3 rounded-full flex-shrink-0 ${dotColorClass}`;
      playerInfoContainer.appendChild(dot);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'font-bold';
      nameSpan.textContent = s.name;
      playerInfoContainer.appendChild(nameSpan);
      if (s.id === myId) {
          readyBtn.textContent = s.isReady ? 'Ready' : 'Not Ready';
          readyBtn.classList.toggle('ready-active', s.isReady);
          abortBtn.textContent = s.votedToAbort ? 'Voted ✓' : 'Vote to Abort';
          abortBtn.disabled = s.votedToAbort;
      }
      if (isGameCurrentlyActive) {
          if (s.votedToAbort) {
              const voteIcon = document.createElement('span');
              voteIcon.textContent = '[Abort ✔]';
              playerInfoContainer.appendChild(voteIcon);
          }
          if (s.disconnectTimeLeft !== null) {
              const timerSpan = document.createElement('span');
              timerSpan.className = 'text-xs text-gray-400 font-mono';
              timerSpan.textContent = `(${s.disconnectTimeLeft}s)`;
              playerInfoContainer.appendChild(timerSpan);
          }
      } else {
          if (s.isReady && s.isConnected) {
              const readyCheck = document.createElement('span');
              readyCheck.textContent = '✓';
              playerInfoContainer.appendChild(readyCheck);
          }
      }
      li.appendChild(playerInfoContainer);
      if (isGameCurrentlyActive) {
        if (s.isDisqualified) {
          playerInfoContainer.classList.add('line-through', 'text-red-400');
          const dqText = document.createElement('span');
          dqText.className = 'ml-auto text-sm';
          dqText.textContent = 'Disqualified';
          playerInfoContainer.appendChild(dqText);
        } else if (s.isEliminated) {
          playerInfoContainer.classList.add('line-through', 'text-gray-400');
           const elimText = document.createElement('span');
          elimText.className = 'ml-auto text-sm';
          elimText.textContent = 'Eliminated ❌';
          playerInfoContainer.appendChild(elimText);
        } else {
          const statsContainer = document.createElement('div');
          statsContainer.className = 'flex justify-between items-center mt-1 text-sm';
          const pointsSpan = document.createElement('span');
          pointsSpan.className = 'text-gray-300 font-mono';
          pointsSpan.textContent = `Points: ${s.points}/${currentMaxPoints}`;
          statsContainer.appendChild(pointsSpan);
          const mistakesContainer = document.createElement('div');
          mistakesContainer.className = 'flex items-center gap-1 text-red-500';
           for (let i = 0; i < s.maxMistakes; i++) {
              const heart = document.createElement('span');
              heart.innerHTML = i < (s.maxMistakes - s.mistakes) ? '❤️' : '';
              mistakesContainer.appendChild(heart);
           }
          statsContainer.appendChild(mistakesContainer);
          li.appendChild(statsContainer);
        }
      }
      scoreboard.appendChild(li);
    });
    
    const isMenuOpen = settingsPanel.classList.contains('open');
    if (currentVoteCount > seenVoteCount && !isMenuOpen) {
        menuNotificationDot.classList.remove('hidden');
    }
  });

  const numberButtons = document.querySelectorAll('.number-btn');
  numberButtons.forEach(button => {
    button.addEventListener('click', () => {
        const value = parseInt(button.textContent, 10);
        handleCellInput(selectedCell, value);
    });
  });
});

