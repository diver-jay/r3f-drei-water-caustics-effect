import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import Experience from "../experience";
import type { RitualBridge } from "../ritual/ritualTypes";

export default function LandingPage() {
  const bridgeRef = useRef<RitualBridge>({ trigger: null });
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
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
        <Experience bridge={bridgeRef.current} />
      </Canvas>
    </div>
  );
}
