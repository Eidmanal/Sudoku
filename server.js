const { newPuzzle } = require('./game/puzzle');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let socketToPlayerId = {};
let isGameActive = false;
let currentSolution = null;
let gameStartTime = null;
let gameTickInterval = null;
let currentDifficulty = 'medium';
let maxPoints = 0; 

const DISCONNECT_TIMEOUT = 60;

function startGame(difficulty) {
    isGameActive = true;
    currentDifficulty = difficulty;
    const { puzzle, solution } = newPuzzle(difficulty);
    currentSolution = solution;
    gameStartTime = Date.now();
    const initialTileCount = puzzle.flat().filter(c => c !== null).length;
    maxPoints = 81 - initialTileCount;
    Object.values(players).forEach(p => {
        p.board = puzzle.map(row => row.slice());
        p.mistakes = 0;
        p.solved = false;
        p.isEliminated = false;
        p.isDisqualified = false;
        p.points = 0;
        p.disconnectTimeLeft = null;
        p.isReady = false; // Reset ready status on new game
    });
    io.emit('puzzle', puzzle);
    if (gameTickInterval) clearInterval(gameTickInterval);
    gameTickInterval = setInterval(gameTick, 1000);
    updateLobbyState();
}

function resetLobby() {
    isGameActive = false;
    currentSolution = null;
    gameStartTime = null;
    if (gameTickInterval) clearInterval(gameTickInterval);
    gameTickInterval = null;
    maxPoints = 0;
    Object.values(players).forEach(p => {
        p.mistakes = 0;
        p.solved = false;
        p.isEliminated = false;
        p.isDisqualified = false;
        p.points = 0;
        p.board = null;
        p.disconnectTimeLeft = null;
        p.isReady = false; // Reset ready status
    });
    updateLobbyState();
}

function checkEliminationWin() {
    if (!isGameActive) return;
    const activePlayers = Object.values(players).filter(p => (p.connectionCount > 0) && !p.isEliminated && !p.isDisqualified);
    if (activePlayers.length === 1 && Object.keys(players).length > 1) {
        const winner = activePlayers[0];
        winner.solved = true;
        io.emit('gameOver', {
            winnerId: winner.id,
            winnerName: winner.name,
            reason: 'as the last player standing!'
        });
        resetLobby();
    } else if (activePlayers.length === 0 && Object.keys(players).length > 0) {
        io.emit('gameOver', {
            winnerId: null,
            winnerName: 'Nobody',
            reason: 'All players were eliminated!'
        });
        resetLobby();
    }
}

function gameTick() {
    if (!isGameActive) {
        clearInterval(gameTickInterval);
        gameTickInterval = null;
        return;
    }
    const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
    io.emit('timerUpdate', elapsedSeconds);
    Object.values(players).forEach(player => {
        if (player.connectionCount === 0 && player.disconnectTimeLeft !== null) {
            player.disconnectTimeLeft--;
            if (player.disconnectTimeLeft <= 0) {
                player.isDisqualified = true;
                player.disconnectTimeLeft = null;
                checkEliminationWin();
            }
        }
    });
    updateLobbyState();
}

function updateLobbyState() {
    const scores = Object.values(players).map(p => ({
        id: p.id,
        name: p.name,
        points: p.points,
        mistakes: p.mistakes,
        solved: p.solved,
        isEliminated: p.isEliminated,
        isDisqualified: p.isDisqualified,
        isConnected: p.connectionCount > 0,
        disconnectTimeLeft: p.disconnectTimeLeft,
        isReady: p.isReady, // NEW: Send ready status to clients
    }));
    io.emit('scoreboard', scores);
    io.emit('gameState', { isGameActive, difficulty: currentDifficulty, maxPoints });
}

// --- Socket.IO ---
io.on('connection', socket => {
    socket.on('playerSession', (persistentId) => {
        let id = persistentId;
        let isNewPlayer = false;
        if (!id || !players[id]) {
            id = uuidv4();
            players[id] = {
                id,
                name: 'Anonymous',
                board: null,
                mistakes: 0,
                points: 0,
                solved: false,
                isEliminated: false,
                isDisqualified: false,
                connectionCount: 0,
                disconnectTimeLeft: null,
                isReady: false, // NEW: Default ready status
            };
            isNewPlayer = true;
        }
        
        players[id].connectionCount++;
        players[id].disconnectTimeLeft = null;
        socketToPlayerId[socket.id] = id;
        
        socket.emit('sessionCreated', { id, isNew: isNewPlayer });
        
        if (isGameActive && players[id].board) {
            socket.emit('puzzle', players[id].board);
        }
        updateLobbyState();
    });

    socket.on('setName', (name) => {
        const id = socketToPlayerId[socket.id];
        if (id && players[id]) {
            players[id].name = name || players[id].name;
            updateLobbyState();
        }
    });

    // NEW: Handle player ready status toggle
    socket.on('toggleReady', () => {
        const id = socketToPlayerId[socket.id];
        if (id && players[id] && !isGameActive) {
            players[id].isReady = !players[id].isReady;
            updateLobbyState();
        }
    });

    socket.on('startGame', ({ difficulty }) => {
        if (isGameActive) return;

        // NEW: Check if all connected players are ready
        const onlinePlayers = Object.values(players).filter(p => p.connectionCount > 0);
        const allReady = onlinePlayers.every(p => p.isReady);

        if (allReady && onlinePlayers.length > 0) {
            startGame(difficulty);
        } else {
            // Send a message back to the player who tried to start the game
            socket.emit('notAllPlayersReady');
        }
    });

    socket.on('move', ({ row, col, value }) => {
        const id = socketToPlayerId[socket.id];
        const player = players[id];
        if (!player || !isGameActive || player.isEliminated || player.isDisqualified) return;
        if (currentSolution[row][col] === value) {
            player.board[row][col] = value;
            player.points++;
            socket.emit('moveSuccess', { row, col, value });
            if (player.points >= maxPoints) {
                player.solved = true;
                io.emit('gameOver', {
                    winnerId: player.id,
                    winnerName: player.name,
                    reason: 'solved the puzzle first!'
                });
                resetLobby();
            } else {
                 updateLobbyState();
            }
        } else {
            player.mistakes++;
            socket.emit('moveFail', { row, col });
            socket.emit('mistake', { mistakes: player.mistakes });
            if (player.mistakes >= 3) {
                player.isEliminated = true;
                socket.emit('eliminated');
                checkEliminationWin();
            }
            updateLobbyState();
        }
    });

    socket.on('disconnect', () => {
        const id = socketToPlayerId[socket.id];
        if (id && players[id]) {
            players[id].connectionCount--;
            if (players[id].connectionCount <= 0) {
                players[id].connectionCount = 0;
                if (isGameActive) {
                    players[id].disconnectTimeLeft = DISCONNECT_TIMEOUT;
                } else {
                    // If a player disconnects from the lobby, they are no longer ready
                    players[id].isReady = false;
                }
            }
            updateLobbyState();
        }
        delete socketToPlayerId[socket.id];
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
});

