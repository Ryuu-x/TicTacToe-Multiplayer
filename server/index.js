import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import jwt from "jsonwebtoken";
import cors from "cors";

connectDB();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());
app.use("/api/auth", authRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../client/build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

let board = Array(9).fill(null);
let xIsNext = true;
let startingPlayer = "X";
let xPlayerId = null;
let oPlayerId = null;
const spectators = new Set();
const players = new Map();

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
    players.set(socket.userId, "X");
  } else if (!oPlayerId) {
    oPlayerId = socket.id;
    role = "O";
    players.set(socket.userId, "O");
  } else {
    spectators.add(socket.id);
  }

  socket.emit("playerRole", role);
  socket.emit("gameState", board, xIsNext);
  console.log(`Assigned ${role} to ${socket.id} (userId=${socket.userId})`);
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log("Token received in socket auth:", token);
  console.log("Verifying JWT with secret:", process.env.JWT_SECRET);

  if (!token) return next(new Error("Authentication error"));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("JWT verification failed:", err.message);
      return next(new Error("Authentication error"));
    }

    console.log("JWT verified:", decoded);
    socket.userId = decoded.userId;
    next();
  });
});


io.on("connection", (socket) => {
  assignRole(socket);
  const playerCount = [xPlayerId, oPlayerId].filter(Boolean).length;
  const spectatorCount = spectators.size;

  io.emit("playerCountInfo", { playerCount, spectatorCount });


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
    if (role === "spectator") return;

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

    io.emit("playerCount", io.engine.clientsCount - spectators.size);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
