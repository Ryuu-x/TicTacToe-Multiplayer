import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import { SocketProvider } from "./context/SocketContext";
import "./App.css";

const App: React.FC = () => {
  return (
    <Router>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:roomId" element={<Game />} />
          {/* Redirect old /game route to lobby */}
          <Route path="/game" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </SocketProvider>
    </Router>
  );
};

export default App;
