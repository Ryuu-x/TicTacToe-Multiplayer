import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import "../App.css";

type Player = "X" | "O" | null;

interface SquareProps {
  value: Player;
  onClick: () => void;
}

const Square: React.FC<SquareProps> = ({ value, onClick }) => {
  return (
    <button className="square" onClick={onClick}>
      {value}
    </button>
  );
};

const Game: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const [squares, setSquares] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null); // Add winner state if not present before
  const [player, setPlayer] = useState<Player | "spectator">(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [xName, setXName] = useState<string | null>(null);
  const [oName, setOName] = useState<string | null>(null);

  // Derived state
  const isBoardFull = !squares.includes(null);

  useEffect(() => {
    if (!socket || !roomId) {
      if (!roomId) navigate("/lobby");
      return;
    }

    if (!connected) {
      console.log("Socket not connected yet");
      return;
    }

    // Join room
    socket.emit("joinRoom", roomId);

    // Setup listeners
    socket.on("playerCountInfo", ({ playerCount, spectatorCount }) => {
      setPlayerCount(playerCount);
      setSpectatorCount(spectatorCount);
    });

    socket.on("playerNames", ({ xName, oName }) => {
      setXName(xName);
      setOName(oName);
    });

    socket.on("playerRole", (role: Player | "spectator") => {
      console.log("Role assigned:", role);
      setPlayer(role);
    });

    socket.on("gameState", (newSquares: Player[], nextTurn: boolean) => {
      setSquares(newSquares);
      setXIsNext(nextTurn);
      // Determine winner from board state if server doesn't send it explicitly
      // Although strict server implementation might handle this, we can recalc for UI
      setWinner(calculateWinner(newSquares));
    });

    socket.on("joinedRoom", ({ role }) => {
      // Confirmation of join
    });

    socket.on("leftRoom", () => {
      navigate("/lobby");
    });

    socket.on("error", ({ message }) => {
      console.error("Game error:", message);
      if (message === "Room not found") {
        navigate("/lobby");
      }
    });

    return () => {
      socket.off("playerCountInfo");
      socket.off("playerRole");
      socket.off("playerNames");
      socket.off("gameState");
      socket.off("joinedRoom");
      socket.off("leftRoom");
      socket.off("error");

      // When unmounting Game component, we leave the room
      // This is important so the user doesn't stay in the room as a ghost
      socket.emit("leaveRoom");
    };
  }, [socket, connected, roomId, navigate]);

  const handleClick = (index: number) => {
    if (!socket) return;
    const currentWinner = calculateWinner(squares);
    if (squares[index] || currentWinner) return;
    if (player === "spectator") return;

    // Only allow move if it's the player's turn
    if ((xIsNext && player !== "X") || (!xIsNext && player !== "O")) return;

    socket.emit("makeMove", index);
  };

  const handleReset = () => {
    if (!socket) return;
    socket.emit("reset");
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit("leaveRoom");
    }
    navigate("/lobby");
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
    }
  };

  if (!socket) {
    return <div className="game">Connecting to server...</div>;
  }

  let status: string;
  const currentWinner = calculateWinner(squares);

  if (currentWinner) {
    status = `Winner: ${currentWinner}`;
  } else if (isBoardFull) {
    status = "It's a tie!";
  } else {
    const nextPlayerName = xIsNext ? (xName || "X") : (oName || "O");
    status = `Next player: ${nextPlayerName}`;
  }

  return (
    <div className="game">
      <h1 className="title">Tic Tac Toe</h1>

      <div className="room-header">
        <span className="room-badge" onClick={copyRoomId} title="Click to copy">
          Room: {roomId} 📋
        </span>
      </div>

      <div className="status">
        {status} | You are: {player ?? "Connecting..."}
      </div>

      <div className="player-count">
        Players: {playerCount}/2 | Spectators: {spectatorCount}
      </div>

      <div className="player-info-container">
        <div className={`player-box ${xIsNext ? 'active' : ''}`}>
          <div className="player-symbol">X</div>
          <div className="player-name">{xName || (player === 'X' ? 'You' : 'Waiting...')}</div>
        </div>
        <div className="vs-divider">VS</div>
        <div className={`player-box ${!xIsNext ? 'active' : ''}`}>
          <div className="player-symbol">O</div>
          <div className="player-name">{oName || (player === 'O' ? 'You' : 'Waiting...')}</div>
        </div>
      </div>

      <div className="board">
        {squares.map((value, index) => (
          <Square key={index} value={value} onClick={() => handleClick(index)} />
        ))}
      </div>

      <div className="game-actions">
        {(currentWinner || isBoardFull) && player !== "spectator" && (
          <button className="reset-btn" onClick={handleReset}>
            Reset Game
          </button>
        )}
        <button className="leave-btn" onClick={handleLeaveRoom}>
          Leave Room
        </button>
      </div>
    </div>
  );
};

function calculateWinner(squares: Player[]): Player {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  return null;
}

export default Game;
