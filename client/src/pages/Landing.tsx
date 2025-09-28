import React from "react";
import { useNavigate } from "react-router-dom";
import "../Auth.css";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <div className="card">
        <h1>Tic Tac Toe Multiplayer</h1>
        <button onClick={() => navigate("/signup")}>Signup</button>
        <button style={{ marginTop: "10px" }} onClick={() => navigate("/login")}>Login</button>
      </div>
    </div>
  );
};

export default Landing;
