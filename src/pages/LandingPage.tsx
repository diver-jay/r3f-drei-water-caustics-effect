import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import Experience from "../experience";
import Navbar from "../components/Navbar";
import type { RitualBridge } from "../ritual/ritualTypes";

export default function LandingPage() {
  const navigate = useNavigate();

  const bridgeRef = useRef<RitualBridge>({ trigger: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [whitefadeActive, setWhitefadeActive] = useState(false);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("[WakeLock] Acquired");
      } catch (err) {
        console.warn("[WakeLock] Failed:", err);
      }
    };

    requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      if (path.startsWith("http")) {
        window.open(path, "_blank", "noopener,noreferrer");
        return;
      }
      setWhitefadeActive(true);
      timerRef.current = setTimeout(() => navigate(path), 200);
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
          position: [0, 4, 7],
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
