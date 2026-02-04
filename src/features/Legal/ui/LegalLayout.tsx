import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

const LegalLayout: React.FC = () => (
  <div className="min-h-screen bg-[var(--mc-bg)] text-[var(--mc-text)] px-4 py-10">
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] text-[var(--mc-text-muted)]">
            Music Quiz
          </div>
          <h1 className="text-2xl font-semibold">Legal</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/60 px-2 py-1 text-xs uppercase tracking-[0.2em] text-[var(--mc-text-muted)]">
          <NavLink
            to="/privacy"
            className={({ isActive }) =>
              `rounded-full px-3 py-1 font-semibold transition ${
                isActive
                  ? "bg-[var(--mc-accent)]/20 text-[var(--mc-text)]"
                  : "hover:text-[var(--mc-text)]"
              }`
            }
          >
            隱私權政策
          </NavLink>
          <NavLink
            to="/terms"
            className={({ isActive }) =>
              `rounded-full px-3 py-1 font-semibold transition ${
                isActive
                  ? "bg-[var(--mc-accent)]/20 text-[var(--mc-text)]"
                  : "hover:text-[var(--mc-text)]"
              }`
            }
          >
            服務條款
          </NavLink>
        </div>
        <Link
          to="/rooms"
          className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-text)] transition hover:bg-[var(--mc-surface-strong)]/90"
        >
          返回房間
        </Link>
      </header>
      <Outlet />
      <footer className="text-xs text-[var(--mc-text-muted)]">
        © 2026 MusicQuiz
      </footer>
    </div>
  </div>
);

export default LegalLayout;
