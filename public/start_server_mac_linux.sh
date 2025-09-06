#!/bin/bash
echo "==================================="
echo " Multiplayer Sudoku Server Setup "
echo "==================================="
echo ""
echo "Step 1 of 2: Installing dependencies (Express and Socket.IO)..."
echo "This might take a moment..."
echo ""
npm install
echo ""
echo "Dependencies installed successfully!"
echo ""
echo "Step 2 of 2: Starting the game server..."
echo "Server is now running. You can connect by going to http://localhost:3000 in your browser."
echo ""
echo "IMPORTANT: Keep this window open to keep the game live for everyone."
echo ""
node server.js
