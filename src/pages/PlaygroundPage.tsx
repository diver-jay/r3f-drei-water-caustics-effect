import Navbar from "../components/Navbar";

export default function PlaygroundPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#06060f",
        color: "white",
      }}
    >
      <Navbar />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "0.75rem",
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#6bcb77",
            boxShadow: "0 0 14px #6bcb77",
          }}
        />
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 300,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Playground
        </h1>
      </div>
    </div>
  );
}
