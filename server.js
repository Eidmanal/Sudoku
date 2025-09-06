const { newPuzzle } = require('./game/puzzle');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

let players = {}; 
let currentPuzzle = null;
let currentSolution = null;
let gameState = {
  isGameActive: false,
  difficulty: 'medium',
  startTime: null,
};

const DISCONNECT_TIMEOUT = 30;

const clonePuzzle = (puzzle) => puzzle.map(row => row.slice());

function updateLobby() {
  const scoreData = Object.values(players).map(p => ({
    id: p.id,
    name: p.name,
    mistakes: p.mistakes,
    progress: p.progress,
    solved: p.solved,
    isEliminated: p.isEliminated,
    isConnected: p.isConnected,
    isDisqualified: p.isDisqualified,
    disconnectTimeLeft: p.disconnectTimeLeft,
  }));
  io.emit('scoreboard', scoreData);
}

function endGame(winnerSocketId, winType = 'solved') {
  if (!gameState.isGameActive) return;

  const winner = players[winnerSocketId];
  if (winner) {
    // MODIFICATION: Emit a single, more detailed gameOver event
    io.emit('gameOver', {
      winnerId: winner.id,
      playerName: winner.name,
      winType: winType
    });
  }

  gameState.isGameActive = false;
  gameState.startTime = null;
  currentPuzzle = null;
  currentSolution = null;

  Object.values(players).forEach(p => {
    p.mistakes = 0;
    p.progress = 0;
    p.solved = false;
    p.isEliminated = false;
    p.isDisqualified = false;
    p.playerBoard = [];
  });
  
  io.emit('gameState', { isGameActive: false, difficulty: gameState.difficulty });
  updateLobby(); 
}

function checkWinByElimination() {
  const activePlayers = Object.values(players).filter(p => p.isConnected && !p.isEliminated && !p.isDisqualified);
  if (gameState.isGameActive && activePlayers.length === 1) {
    const lastPlayer = activePlayers[0];
    endGame(lastPlayer.id, 'elimination');
    return true;
  }
  return false;
}

io.on('connection', socket => {
  
  socket.on('playerSession', (storedId) => {
    let playerId = storedId && players[storedId] ? storedId : socket.id;
    socket.persistentId = playerId; 
    let isNewPlayer = !players[playerId];

    if (isNewPlayer) {
      players[playerId] = {
        id: playerId, name: `Player-${playerId.slice(0, 4)}`, mistakes: 0, progress: 0,
        solved: false, isEliminated: false, isConnected: true, isDisqualified: false,
        disconnectTimeLeft: null, playerBoard: [],
      };
    } else {
      players[playerId].isConnected = true;
      players[playerId].disconnectTimeLeft = null;
    }
    
    socket.emit('sessionCreated', { id: playerId, isNew: isNewPlayer });
    socket.emit('gameState', { isGameActive: gameState.isGameActive, difficulty: gameState.difficulty });
    if (gameState.isGameActive) {
      socket.emit('puzzle', players[playerId].playerBoard);
    }
    updateLobby();
  });
  
  socket.on('setName', (name) => {
    const playerId = socket.persistentId;
    if (playerId && players[playerId]) {
      players[playerId].name = name || players[playerId].name;
      updateLobby();
    }
  });

  socket.on('startGame', ({ difficulty }) => {
    if (gameState.isGameActive) return;
    
    const { puzzle, solution } = newPuzzle(difficulty);
    currentPuzzle = clonePuzzle(puzzle);
    currentSolution = clonePuzzle(solution);
    gameState.difficulty = difficulty;
    gameState.isGameActive = true;
    gameState.startTime = Date.now();
    
    Object.values(players).forEach(p => {
      p.mistakes = 0;
      p.solved = false;
      p.isEliminated = false;
      p.isDisqualified = false;
      p.progress = puzzle.flat().filter(c => c !== null).length;
      p.playerBoard = clonePuzzle(puzzle);
    });
    
    io.emit('puzzle', currentPuzzle);
    io.emit('gameState', { isGameActive: true, difficulty: gameState.difficulty });
    updateLobby();
  });

  socket.on('move', ({ row, col, value }) => {
    const playerId = socket.persistentId;
    const player = players[playerId];
    if (!player || !gameState.isGameActive || player.isEliminated || player.isDisqualified) return;

    if (currentSolution[row][col] === value) {
      if (player.playerBoard[row][col] === null) {
        player.playerBoard[row][col] = value;
        player.progress++;
        socket.emit('moveSuccess', { row, col, value });
        if (player.progress === 81) {
          player.solved = true;
          endGame(playerId, 'solved');
        }
        updateLobby();
      }
    } else {
      player.mistakes++;
      socket.emit('moveFail', { row, col });
      socket.emit('mistake', { mistakes: player.mistakes });
      if (player.mistakes >= 3) {
        player.isEliminated = true;
        socket.emit('eliminated');
        if (checkWinByElimination()) return;
      }
      updateLobby();
    }
  });

  socket.on('disconnect', () => {
    const playerId = socket.persistentId;
    if (playerId && players[playerId]) {
      players[playerId].isConnected = false;
      if (gameState.isGameActive && !players[playerId].isEliminated && !players[playerId].isDisqualified) {
        players[playerId].disconnectTimeLeft = DISCONNECT_TIMEOUT;
      }
      updateLobby();
    }
  });
});

setInterval(() => {
  let lobbyNeedsUpdate = false;
  if (gameState.isGameActive) {
    const elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    io.emit('timerUpdate', elapsedTime);
  }

  for (const playerId in players) {
    const player = players[playerId];
    if (player.disconnectTimeLeft !== null && player.disconnectTimeLeft > 0) {
      player.disconnectTimeLeft--;
      lobbyNeedsUpdate = true;
      if (player.disconnectTimeLeft <= 0) {
        player.disconnectTimeLeft = null;
        player.isDisqualified = true;
        if (checkWinByElimination()) return;
      }
    }
  }

  if (lobbyNeedsUpdate) {
    updateLobby();
  }
}, 1000);

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

