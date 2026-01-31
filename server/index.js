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
import Room from "./Room.js";
import crypto from "crypto";

connectDB();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());
app.use("/api/auth", authRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../client/build")));

// Room management
const rooms = new Map();
const socketToRoom = new Map(); // Track which room each socket is in

/**
 * Generate a unique room ID
 */
function generateRoomId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * Get room list for lobby
 */
function getRoomList() {
  return Array.from(rooms.values())
    .filter(room => !room.isEmpty())
    .map(room => room.getInfo());
}

/**
 * Emit room state to all players in a room
 */
function emitRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const state = room.getState();
  io.to(roomId).emit("gameState", state.board, state.xIsNext);
  io.to(roomId).emit("playerNames", {
    xName: state.xName,
    oName: state.oName
  });
  io.to(roomId).emit("playerCountInfo", {
    playerCount: state.playerCount,
    spectatorCount: state.spectatorCount
  });
}

/**
 * Broadcast updated room list to lobby
 */
function broadcastRoomList() {
  io.to("lobby").emit("roomList", getRoomList());
}

// REST API for rooms
app.get("/api/rooms", (req, res) => {
  res.json(getRoomList());
});

// Serve React app for all other routes
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) return next(new Error("Authentication error"));

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error"));
    }
    socket.userId = decoded.userId;
    socket.username = socket.handshake.auth.username || "Anonymous";
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id} (userId=${socket.userId})`);

  // Join lobby by default for room list updates
  socket.join("lobby");
  socket.emit("roomList", getRoomList());

  /**
   * Create a new room
   */
  socket.on("createRoom", () => {
    // Leave current room if in one
    const currentRoomId = socketToRoom.get(socket.id);
    if (currentRoomId) {
      leaveRoom(socket, currentRoomId);
    }

    // Create new room
    const roomId = generateRoomId();
    const room = new Room(roomId, socket.id);
    rooms.set(roomId, room);

    // Join the room
    joinRoom(socket, roomId);

    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  /**
   * Join an existing room
   */
  socket.on("joinRoom", (roomId) => {
    // Leave current room if in one
    const currentRoomId = socketToRoom.get(socket.id);
    if (currentRoomId && currentRoomId !== roomId) {
      leaveRoom(socket, currentRoomId);
    }

    if (!rooms.has(roomId)) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    joinRoom(socket, roomId);
  });

  /**
   * Quick play - join first available room or create new one
   */
  socket.on("quickPlay", () => {
    // Leave current room if in one
    const currentRoomId = socketToRoom.get(socket.id);
    if (currentRoomId) {
      leaveRoom(socket, currentRoomId);
    }

    // Find a room with space
    let targetRoom = null;
    for (const room of rooms.values()) {
      if (room.getPlayerCount() < 2) {
        targetRoom = room;
        break;
      }
    }

    if (targetRoom) {
      joinRoom(socket, targetRoom.id);
    } else {
      // Create new room
      const roomId = generateRoomId();
      const room = new Room(roomId, socket.id);
      rooms.set(roomId, room);
      joinRoom(socket, roomId);
    }
  });

  /**
   * Leave current room
   */
  socket.on("leaveRoom", () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      leaveRoom(socket, roomId);
      socket.emit("leftRoom");
      socket.join("lobby");
      socket.emit("roomList", getRoomList());
    }
  });

  /**
   * Make a move in the current room
   */
  socket.on("makeMove", (index) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const moved = room.makeMove(socket.id, index);
    if (moved) {
      emitRoomState(roomId);
    }
  });

  /**
   * Reset game in current room
   */
  socket.on("reset", () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const reset = room.reset(socket.id);
    if (reset) {
      emitRoomState(roomId);
    }
  });

  /**
   * Get rooms list
   */
  socket.on("getRooms", () => {
    socket.emit("roomList", getRoomList());
  });

  /**
   * Disconnect handling
   */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      leaveRoom(socket, roomId);
    }
  });

  /**
   * Helper: Join a room
   */
  function joinRoom(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // Leave lobby
    socket.leave("lobby");

    // Join Socket.IO room
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    // Assign role
    const role = room.assignRole(socket.id, socket.userId, socket.username);

    // Notify client
    socket.emit("joinedRoom", { roomId, role });
    socket.emit("playerRole", role);

    // Emit state to all in room
    emitRoomState(roomId);
    broadcastRoomList();

    console.log(`${socket.id} joined room ${roomId} as ${role}`);
  }

  /**
   * Helper: Leave a room
   */
  function leaveRoom(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const { removedRole, promotedSocketId } = room.removePlayer(socket.id);

    // Leave Socket.IO room
    socket.leave(roomId);
    socketToRoom.delete(socket.id);

    // Notify promoted player
    if (promotedSocketId) {
      const newRole = room.roleOf(promotedSocketId);
      const promotedSocket = io.sockets.sockets.get(promotedSocketId);
      if (promotedSocket) {
        if (newRole === "X") {
          room.xUserId = promotedSocket.userId;
          room.xName = promotedSocket.username;
        }
        if (newRole === "O") {
          room.oUserId = promotedSocket.userId;
          room.oName = promotedSocket.username;
        }
      }
      io.to(promotedSocketId).emit("playerRole", newRole);
    }

    // Clean up empty rooms
    if (room.isEmpty()) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      emitRoomState(roomId);
    }

    broadcastRoomList();
    console.log(`${socket.id} left room ${roomId}`);
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
