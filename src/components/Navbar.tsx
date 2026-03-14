import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/now", label: "Now", color: "#ff6b6b" },
  { path: "/uses", label: "Uses", color: "#ffd93d" },
  { path: "/playground", label: "Playground", color: "#6bcb77" },
];

export default function Navbar() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "2rem",
        padding: "0.875rem 2rem",
        background: "rgba(10, 10, 30, 0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
      }}
    >
      {NAV_ITEMS.map(({ path, label, color }) => (
        <NavLink
          key={path}
          to={path}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            color: isActive ? "#ffffff" : "rgba(255,255,255,0.60)",
            textDecoration: "none",
            fontSize: "0.88rem",
            letterSpacing: "0.06em",
            fontWeight: isActive ? 500 : 400,
            transition: "color 0.2s",
          })}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 7px ${color}`,
              flexShrink: 0,
            }}
          />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
