const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ["http://localhost:3000"], methods: ["GET", "POST"] },
});

let board = Array(9).fill(null);
let xIsNext = true; // true => X's turn, false => O's turn
let startingPlayer = "X";
let xPlayerId = null;
let oPlayerId = null;

let players = [];
const spectators = new Set();

io.on("connection", (socket) => {
  
  // Emit player count to all clients
  io.emit("playerCount", io.engine.clientsCount);

  socket.on("disconnect", () => {
    // remove from players/spectators logic
    io.emit("playerCount", io.engine.clientsCount);
  });
});


function emitState() {
  io.emit("gameState", board, xIsNext); // <-- matches the client listener
}

function roleOf(socketId) {
  if (socketId === xPlayerId) return "X";
  if (socketId === oPlayerId) return "O";
  return "spectator";
}

function assignRole(socket) {
  let role = "spectator";
  if (!xPlayerId) {
    xPlayerId = socket.id;
    role = "X";
  } else if (!oPlayerId) {
    oPlayerId = socket.id;
    role = "O";
  } else {
    spectators.add(socket.id);
  }
  socket.emit("playerRole", role); 
  socket.emit("gameState", board, xIsNext);
  console.log(`Assigned ${role} to ${socket.id}`);
}

io.on("connection", (socket) => {
  assignRole(socket);

  socket.on("makeMove", (index) => {
    const role = roleOf(socket.id);
    if (role === "spectator") return;     // spectators can't move
    if ((xIsNext && role !== "X") || (!xIsNext && role !== "O")) return; // turn check
    if (board[index] !== null) return;          // occupied cell

    board[index] = role;
    xIsNext = !xIsNext;
    emitState();
  });

   socket.on("reset", () => {
    const role = roleOf(socket.id);
    if (role === "spectator") {
      console.log(`Spectator ${socket.id} tried to reset — ignored`);
      return;
    }

    // Reset game
    board = Array(9).fill(null);
    startingPlayer = startingPlayer === "X" ? "O" : "X";
    xIsNext = startingPlayer === "X";

    emitState();
  });

  socket.on("disconnect", () => {
    const role = roleOf(socket.id);
    if (role === "X") {
      xPlayerId = null;
      // promote first spectator to X if any
      const iter = spectators.values();
      const next = iter.next();
      if (!next.done) {
        const nextId = next.value;
        spectators.delete(nextId);
        xPlayerId = nextId;
        io.to(nextId).emit("playerRole", "X");
      }
    } else if (role === "O") {
      oPlayerId = null;
      // promote first spectator to O if any
      const iter = spectators.values();
      const next = iter.next();
      if (!next.done) {
        const nextId = next.value;
        spectators.delete(nextId);
        oPlayerId = nextId;
        io.to(nextId).emit("playerRole", "O");
      }
    } else {
      spectators.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
