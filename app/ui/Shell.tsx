
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  ChartNoAxesCombined,
  GraduationCap,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];

export default function Shell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="shell-overlay"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`shell-sidebar ${menuOpen ? "menu-open" : ""}`}>
        <Link
          href="/"
          className="shell-brand"
          onClick={() => setMenuOpen(false)}
        >
          <div className="shell-brand-icon">
            <GraduationCap size={26} strokeWidth={1.8} />
          </div>

          <div className="shell-brand-copy">
            <div className="shell-brand-name">AttendEase</div>
            <div className="shell-brand-subtitle">
              Attendance Management
            </div>
          </div>
        </Link>

        <div className="shell-section-label">WORKSPACE</div>

        <nav className="shell-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`sidebar-link ${active ? "active" : ""}`}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {active && <span className="shell-active-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="shell-sidebar-spacer" />

        <div className="shell-admin-card">
          <div className="shell-admin-avatar">CA</div>
          <div className="shell-admin-copy">
            <div className="shell-admin-name">College Admin</div>
            <div className="shell-admin-role">
              Attendance Administrator
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="sidebar-link shell-logout"
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span>Logout</span>
        </button>

        <div className="shell-sidebar-footer">
          ATTENDEASE <span>•</span> COLLEGE PORTAL
        </div>
      </aside>

      <main className="shell-main">
        <header className="shell-header">
          <button
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="shell-menu-button"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <div className="shell-header-context">
            <span className="shell-header-overline">
              COLLEGE MANAGEMENT
            </span>
            <span className="shell-header-title">
              Attendance Portal
            </span>
          </div>

          <div className="shell-header-profile">
            <div className="shell-profile-avatar">A</div>
            <div className="shell-profile-copy">
              <div className="shell-profile-name">Administrator</div>
              <div className="shell-profile-role">
                College Portal
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
