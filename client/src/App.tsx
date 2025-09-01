import React, { useState, useEffect } from "react";
import io, { Socket } from "socket.io-client";
import "./App.css";

const socket: Socket = io("http://localhost:4000");

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

const App: React.FC = () => {
  const [squares, setSquares] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [player, setPlayer] = useState<Player>(null);
  const [playerCount, setPlayerCount] = useState(0);

  const winner = calculateWinner(squares);
  const isBoardFull = !squares.includes(null);

  useEffect(() => {
    socket.on("playerCount", (count: number) => {
      setPlayerCount(count);
    });

    return () => {
      socket.off("playerCount");
    };
  }, []);

  useEffect(() => {
    socket.on("playerRole", (role: Player) => {
      setPlayer(role);
    });

    socket.on("gameState", (newSquares: Player[], nextTurn: boolean) => {
      setSquares(newSquares);
      setXIsNext(nextTurn);
    });

    return () => {
      socket.off("playerRole");
      socket.off("gameState");
    };
  }, []);


  const handleClick = (index: number) => {
    if (squares[index] || winner) return;
    if ((xIsNext && player !== "X") || (!xIsNext && player !== "O")) return;

    socket.emit("makeMove", index);
  };

  const handleReset = () => {
    socket.emit("reset");
  };

  let status: string;
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (isBoardFull) {
    status = "It's a tie!";
  } else {
    status = `Next player: ${xIsNext ? "X" : "O"}`;
  }

  return (
    <div className="game">
      <h1 className="title">Tic Tac Toe</h1>
      <div className="status">
        {status} | You are: {player ?? "Spectator"}
      </div>

      <div className="player-count">
        Players Online: {playerCount}
      </div>
      <div className="board">
        {squares.map((value, index) => (
          <Square key={index} value={value} onClick={() => handleClick(index)} />
        ))}
      </div>

      {(calculateWinner(squares) || !squares.includes(null)) && (
        <button className="reset-btn" onClick={handleReset}>
          Reset Game
        </button>
      )}
    </div>
  );
};

function calculateWinner(squares: Player[]): Player {
  const lines: number[][] = [
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

export default App;
