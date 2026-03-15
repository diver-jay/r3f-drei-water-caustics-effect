import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function BackButton() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => navigate("/")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: hovered ? "#fff" : "#6bcb77",
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: "1.4rem",
        letterSpacing: "0.08em",
        transition: "color 0.2s ease",
        padding: 0,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      BACK
    </button>
  );
}

export default function AboutMePage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#06060f",
        color: "white",
        overflowY: "auto",
      }}
    >
      <Navbar />
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "140px 2rem 6rem",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "3.5rem",
              letterSpacing: "0.06em",
              color: "#6bcb77",
            }}
          >
            ABOUT ME
          </h1>
          <BackButton />
        </div>
      </div>
    </div>
  );
}
