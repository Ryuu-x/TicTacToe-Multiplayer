import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext"; // Import hook
import "../App.css";

interface RoomInfo {
    id: string;
    playerCount: number;
    spectatorCount: number;
    hasSpace: boolean;
}

const Lobby: React.FC = () => {
    const { socket, connected } = useSocket(); // Use shared socket
    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [joinRoomId, setJoinRoomId] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!socket) return;

        // Reset any previous listeners to avoid duplicates
        socket.off("roomList");
        socket.off("joinedRoom");
        socket.off("error");

        socket.on("roomList", (roomList: RoomInfo[]) => {
            console.log("Received room list:", roomList);
            setRooms(roomList);
        });

        socket.on("joinedRoom", ({ roomId }) => {
            console.log("Joined room:", roomId);
            navigate(`/game/${roomId}`);
        });

        socket.on("error", ({ message }) => {
            console.error("Server error:", message);
            setError(message);
            setTimeout(() => setError(""), 3000);
        });

        // Request room list immediately if connected
        if (connected) {
            socket.emit("getRooms");
        }

        return () => {
            socket.off("roomList");
            socket.off("joinedRoom");
            socket.off("error");
        };
    }, [socket, connected, navigate]);

    const handleCreateRoom = () => {
        if (socket) {
            socket.emit("createRoom");
        }
    };

    const handleJoinRoom = (roomId: string) => {
        if (socket && roomId) {
            socket.emit("joinRoom", roomId.toUpperCase());
        }
    };

    const handleQuickPlay = () => {
        if (socket) {
            socket.emit("quickPlay");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        navigate("/login");
    };

    if (!socket) {
        return <div className="game">Connecting to server...</div>;
    }

    const username = localStorage.getItem("username");

    return (
        <div className="game">
            <h1 className="title">Game Lobby</h1>
            {username && <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Welcome, {username}! 👋</div>}

            <div style={{
                color: connected ? '#00ffcc' : '#ff4d4f',
                marginBottom: '15px',
                fontSize: '14px'
            }}>
                Status: {connected ? 'Connected 🟢' : 'Disconnected 🔴'}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="lobby-actions">
                <button className="lobby-btn primary" onClick={handleQuickPlay}>
                    ⚡ Quick Play
                </button>
                <button className="lobby-btn" onClick={handleCreateRoom}>
                    ➕ Create Room
                </button>
            </div>

            <div className="join-room-section">
                <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="room-input"
                />
                <button
                    className="lobby-btn"
                    onClick={() => handleJoinRoom(joinRoomId)}
                    disabled={!joinRoomId}
                >
                    Join
                </button>
            </div>

            <div className="rooms-list">
                <h2>Available Rooms</h2>
                {rooms.length === 0 ? (
                    <p className="no-rooms">No active rooms. Create one to start playing!</p>
                ) : (
                    <div className="room-cards">
                        {rooms.map((room) => (
                            <div key={room.id} className="room-card">
                                <div className="room-id">Room: {room.id}</div>
                                <div className="room-info">
                                    <span>Players: {room.playerCount}/2</span>
                                    <span>Spectators: {room.spectatorCount}</span>
                                </div>
                                <button
                                    className={`lobby-btn ${room.hasSpace ? "primary" : ""}`}
                                    onClick={() => handleJoinRoom(room.id)}
                                >
                                    {room.hasSpace ? "Join" : "Spectate"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button className="logout-btn" onClick={handleLogout}>
                Logout
            </button>
        </div>
    );
};

export default Lobby;
