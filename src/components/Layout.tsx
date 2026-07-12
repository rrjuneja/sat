import { NavLink, Outlet } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import SyncStatus from "./SyncStatus";

const links = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/practice", label: "Practice", icon: "✎" },
  { to: "/review", label: "Review", icon: "★" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">SAT</div>
          <div>
            Test Drive <small>· syncs across devices</small>
          </div>
        </div>
        <nav className="desktop-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <span className="spacer" style={{ flex: 1 }} />
        <SyncStatus />
        <ThemeToggle />
        <UserMenu />
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="ico">{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
