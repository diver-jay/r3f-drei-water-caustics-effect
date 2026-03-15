import { useState } from "react";
import { NavLink, Link } from "react-router-dom";

const FONT = "'Bebas Neue', sans-serif";

type NavItemDef =
  | { type: "internal"; path: string; label: string; outlined: boolean; color: string }
  | { type: "external"; href: string; label: string; outlined: boolean; color: string };

const NAV_ITEMS: NavItemDef[] = [
  { type: "external", href: "https://www.linkedin.com/in/jun-hong-lee-b694232b4/?locale=ko", label: "LINKEDIN", outlined: false, color: "#ff6b6b" },
  { type: "internal", path: "/uses",     label: "USES",     outlined: false, color: "#ffd93d" },
  { type: "internal", path: "/about-me", label: "ABOUT ME", outlined: true,  color: "#6bcb77" },
];

const itemStyle = (active: boolean, outlined: boolean, hovered: boolean, color: string) => ({
  color: hovered || active ? color : "#fff",
  textDecoration: "none",
  fontFamily: FONT,
  fontSize: "1.5rem",
  letterSpacing: "0.08em",
  padding: "9px 20px",
  borderRadius: "50px",
  border: outlined || active || hovered
    ? `1px solid ${color}`
    : "1px solid transparent",
  transition: "color 0.2s ease, border-color 0.2s ease",
});

function NavItem({ item }: { item: NavItemDef }) {
  const [hovered, setHovered] = useState(false);
  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (item.type === "external") {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        {...handlers}
        style={{
          ...itemStyle(false, item.outlined, hovered, item.color),
          display: "flex",
          alignItems: "center",
          padding: "9px 14px",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="26"
          height="26"
        >
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>
    );
  }

  return (
    <NavLink
      to={item.path}
      {...handlers}
      style={({ isActive }) => itemStyle(isActive, item.outlined, hovered, item.color)}
    >
      {item.label}
    </NavLink>
  );
}

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
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 2.5rem",
        height: "90px",
      }}
    >
      <Link
        to="/"
        style={{
          color: "#fff",
          textDecoration: "none",
          fontFamily: FONT,
          fontSize: "3rem",
          lineHeight: 1.1,
          letterSpacing: "0.04em",
        }}
      >
        DIVER-J
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} item={item} />
        ))}
      </div>
    </nav>
  );
}
