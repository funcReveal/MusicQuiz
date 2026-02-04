import React from "react";

interface LoginPageProps {
  usernameInput: string;
  onInputChange: (value: string) => void;
  onConfirm: () => void;
  onGoogleLogin: () => void;
  googleLoading?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({
  usernameInput,
  onInputChange,
  onConfirm,
  onGoogleLogin,
  googleLoading = false,
}) => (
  <section className="login-root relative overflow-hidden rounded-[32px] border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.8)]">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-[var(--mc-accent)]/20 blur-[120px]" />
      <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-[var(--mc-accent-2)]/15 blur-[140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.8),transparent_55%)]" />
    </div>

    <div className="relative grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="flex flex-col justify-between gap-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-[var(--mc-text-muted)]">
            Studio Mode
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-accent-2)] shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          </div>
          <h2 className="login-title text-4xl font-semibold leading-tight text-[var(--mc-text)] lg:text-5xl">
            開啟你的音樂
            <span className="block bg-gradient-to-r from-[var(--mc-accent)] via-cyan-300 to-[var(--mc-accent-2)] bg-clip-text text-transparent">
              Quiz Stage
            </span>
          </h2>
          <p className="max-w-md text-sm text-[var(--mc-text-muted)]">
            快速建立暱稱就能加入房間，也可以使用 Google
            同步播放清單與個人收藏。所有動作都在同一個舞台完成。
          </p>
        </div>

        <div className="flex items-end gap-2">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className="h-8 w-1.5 rounded-full bg-[var(--mc-surface-strong)]/80"
              style={{
                animation: "login-eq 1.6s ease-in-out infinite",
                animationDelay: `${index * 0.12}s`,
                height: `${10 + (index % 6) * 6}px`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-6 shadow-[0_24px_60px_-32px_rgba(2,6,23,0.9)] backdrop-blur">
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
              Quick Entry
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--mc-text)]">
              暱稱登入
            </h3>
            <p className="mt-2 text-sm text-[var(--mc-text-muted)]">
              不想綁定帳號？輸入暱稱即可快速加入房間。
            </p>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="nickname"
              className="text-xs uppercase tracking-[0.2em] text-[var(--mc-text-muted)]"
            >
              暱稱
            </label>
            <input
              id="nickname"
              value={usernameInput}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="例如：Night DJ"
              className="w-full rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/70 px-4 py-3 text-sm text-[var(--mc-text)] placeholder:text-slate-500 focus:border-[var(--mc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mc-glow)]"
            />
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-2xl border border-[var(--mc-accent)]/60 bg-[var(--mc-accent)]/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-[var(--mc-text)] transition hover:border-[var(--mc-accent)] hover:bg-[var(--mc-accent)]/40"
            >
              進入房間
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--mc-border)]" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--mc-border)]" />
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
              Connected
            </div>
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={googleLoading}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--mc-accent-2)]/50 bg-[var(--mc-accent-2)]/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-[var(--mc-accent-2)] hover:bg-[var(--mc-accent-2)]/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--mc-accent-2)]" />
                {googleLoading ? "連線中..." : "Google 登入"}
              </span>
              <span className="text-[11px] text-emerald-200/70">
                同步收藏
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <style>
      {`
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Sora:wght@400;500;600&display=swap");

        .login-root {
          font-family: "Sora", "Noto Sans TC", sans-serif;
        }

        .login-title {
          font-family: "Fraunces", "Noto Serif TC", serif;
        }

        @keyframes login-eq {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 0.9; }
        }
      `}
    </style>
  </section>
);

export default LoginPage;
