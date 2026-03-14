import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import Experience from "../experience";
import Navbar from "../components/Navbar";
import type { RitualBridge } from "../ritual/ritualTypes";

export default function LandingPage() {
  const navigate = useNavigate();
  const bridgeRef = useRef<RitualBridge>({ trigger: null });
  const [whitefadeActive, setWhitefadeActive] = useState(false);

  const handleNavigate = useCallback(
    (path: string) => {
      setWhitefadeActive(true);
      setTimeout(() => navigate(path), 200);
    },
    [navigate],
  );

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        style={{ background: "#000" }}
        camera={{
          fov: 45,
          near: 0.1,
          far: 200,
          position: [8, 12, 12],
        }}
      >
        <Experience bridge={bridgeRef.current} onNavigate={handleNavigate} />
      </Canvas>

      <Navbar />

      {/* Whitefade overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "white",
          opacity: whitefadeActive ? 1 : 0,
          transition: "opacity 0.2s ease-in",
          pointerEvents: "none",
          zIndex: 100,
        }}
      />
    </div>
  );
}
