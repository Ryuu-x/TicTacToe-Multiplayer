import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: ["http://localhost:3000"], methods: ["GET", "POST"] },
});

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React build (when deployed)
app.use(express.static(path.join(__dirname, "../client/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// ===== Game State =====
let board = Array(9).fill(null);
let xIsNext = true; // true => X's turn, false => O's turn
let startingPlayer = "X";
let xPlayerId = null;
let oPlayerId = null;

const spectators = new Set();

// ===== Helper Functions =====
function emitState() {
  io.emit("gameState", board, xIsNext);
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

// ===== Socket Logic =====
io.on("connection", (socket) => {
  assignRole(socket);

  // Broadcast player count
  io.emit("playerCount", io.engine.clientsCount);

  socket.on("makeMove", (index) => {
    const role = roleOf(socket.id);
    if (role === "spectator") return;
    if ((xIsNext && role !== "X") || (!xIsNext && role !== "O")) return;
    if (board[index] !== null) return;

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

    io.emit("playerCount", io.engine.clientsCount);
  });
});

// ===== Server Start =====
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
