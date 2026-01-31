import React, { createContext, useContext, useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";

const URL =
    process.env.NODE_ENV === "production"
        ? undefined
        : "http://localhost:4000";

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    connected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        if (!token) {
            return;
        }

        const newSocket = io(URL || "/", {
            transports: ["websocket", "polling"],
            auth: { token, username }, // Include username
        });

        setSocket(newSocket);

        // Initialize connected state
        setConnected(newSocket.connected);

        newSocket.on("connect", () => {
            console.log("Socket connected:", newSocket.id);
            setConnected(true);
        });

        newSocket.on("disconnect", () => {
            console.log("Socket disconnected");
            setConnected(false);
        });

        newSocket.on("connect_error", (err) => {
            console.error("Connection error:", err.message);
            if (err.message === "Authentication error") {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                window.location.href = "/login"; // Use window.location for fatal redirect to stay stable
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []); // Empty dependency array to persist across navigations

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};
