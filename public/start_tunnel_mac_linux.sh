#!/bin/bash
echo "==================================="
echo "  Ngrok Public Tunnel            "
echo "==================================="
echo ""
echo "This will create a public link for your friends to join the game."
echo ""
echo "IMPORTANT: Make sure your game server is already running in another window before you run this."
echo ""
ngrok http 3000
