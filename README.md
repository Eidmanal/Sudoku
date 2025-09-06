Multiplayer Sudoku

A real-time, competitive multiplayer Sudoku game where players race to solve the puzzle first. Features include a live scoreboard, an elimination system for mistakes, and an abandonment timer for disconnected players.

Desktop view:

<img width="1345" height="628" alt="image" src="https://github.com/user-attachments/assets/22dcb402-9dc8-45de-9555-8934bd8b029e" />

Mobile view:

![Screenshot_20250907_014905_Chrome](https://github.com/user-attachments/assets/bd794e71-3da6-417d-86f8-8b02d3690b9e)


Features:

Real-time Multiplayer: See player progress and connection status live.

Competitive Gameplay: Each player has their own board. The first to solve it wins!

Elimination System: Make 3 mistakes and you're out. The last player standing can win by elimination.

Abandonment Timer: Players who disconnect have a limited time to rejoin before being disqualified.

Match Timer: See how long the current match has been running.

Note Marking: To indicate possible values that may occupy a cell.

Responsive UI: Playable on both desktop and mobile devices.

How to Play (For Players)
To join a game that someone else is hosting, you just need a modern web browser.

Ask the host for the game link. It will look something like this: https://random-string.ngrok-free.app.

Click the link, enter your name when prompted, and you're in the lobby!

How to Host Your Own Game (For Hosts)
Want to host a game for your friends? Just follow these steps.

Prerequisites (One-Time Setup)
You only need to do this once on the computer you will use to host.

Install Node.js: The game server needs Node.js to run.

Go to the official Node.js website.

Download the LTS version and run the installer, accepting the defaults.

Set up ngrok: This tool creates the public link for your friends.

Go to the official ngrok website and create a free account.

Follow their "Getting Started" guide to download ngrok and add your authtoken.

Running the Game
Download the Code: On this GitHub page, click the green <> Code button, and select Download ZIP. Unzip the folder to a convenient location (like your Desktop).

Start the Server:

On Windows: Open the project folder and double-click the start_server_windows.bat file.

On macOS/Linux: You may need to give the script permission first. Right-click start_server_mac_linux.sh, go to Properties > Permissions, and check "Allow executing file as program". Then you can double-click it.

A terminal window will open, install the game's dependencies, and then start the server. Keep this window open.

Start the Tunnel to Share:

With the server window still running, go back to the folder.

On Windows: Double-click start_tunnel_windows.bat.

On macOS/Linux: Double-click start_tunnel_mac_linux.sh.

A second terminal window will open and show a public link that starts with https://....

Share the Link!

Copy that https:// link and send it to your friends. Anyone with the link can join your game. Enjoy!

Tech Stack
Backend: Node.js, Express, Socket.IO

Frontend: HTML5, Tailwind CSS, Vanilla JavaScript
