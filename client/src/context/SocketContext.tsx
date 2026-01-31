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
    refreshSocket: () => void;
    clearSocket: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    connected: false,
    refreshSocket: () => { },
    clearSocket: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [auth, setAuth] = useState({
        token: localStorage.getItem("token"),
        username: localStorage.getItem("username")
    });

    const refreshSocket = () => {
        setAuth({
            token: localStorage.getItem("token"),
            username: localStorage.getItem("username")
        });
    };

    const clearSocket = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setAuth({ token: null, username: null });
        if (socket) {
            socket.disconnect();
            setSocket(null);
            setConnected(false);
        }
    };

    useEffect(() => {
        const { token, username } = auth;
        if (!token) {
            setSocket(null);
            setConnected(false);
            return;
        }

        console.log("Initializing socket with URL:", URL || "/", "Token presence:", !!token);
        const newSocket = io(URL || "/", {
            transports: ["websocket", "polling"],
            auth: { token, username },
        });

        setSocket(newSocket);
        setConnected(newSocket.connected);

        newSocket.on("connect", () => {
            console.log("Socket connected successfully:", newSocket.id);
            setConnected(true);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("Socket disconnected. Reason:", reason);
            setConnected(false);
        });

        newSocket.on("connect_error", (err) => {
            console.error("Socket connection error detail:", err);
            if (err.message === "Authentication error") {
                console.log("Authentication failed. Clearing socket and redirecting...");
                clearSocket();
                window.location.href = "/login";
            } else {
                setConnected(false);
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, [auth.token, auth.username]);

    return (
        <SocketContext.Provider value={{ socket, connected, refreshSocket, clearSocket }}>
            {children}
        </SocketContext.Provider>
    );
};
