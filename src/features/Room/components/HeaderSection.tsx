import { ExpandMore } from "@mui/icons-material";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface HeaderSectionProps {
  serverUrl: string;
  isConnected: boolean;
  displayUsername: string;
  authUser?: {
    id: string;
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  authLoading?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  serverUrl,
  isConnected,
  displayUsername,
  authUser,
  authLoading = false,
  onLogin,
  onLogout,
}) => {
  const navigate = useNavigate();
  const authLabel = authUser?.display_name || authUser?.id || displayUsername;
  const authSubLabel = authUser?.email ?? null;

  async function checkPing() {
    const start = performance.now();
    await fetch(`${import.meta.env.VITE_API_URL}/health`);
    const end = performance.now();
    return Math.round(end - start);
  }
  const [ping, setPing] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const ms = await checkPing();
        setPing(ms);
      } catch {
        setPing(null);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);
  return (
    <header className="mb-3 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-5xl font-semibold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
          MusicQuiz
        </h1>
        <p className="text-1xl text-slate-400">
          打造你的音樂房間，和朋友一起猜歌！
        </p>
      </div>
      <div className="text-right text-shadow-md text-slate-400 space-y-1">
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-slate-300 text-[11px]">{serverUrl}</span>
        </div>
        <div>
          連線狀態
          <span
            className={
              isConnected
                ? "ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/40"
                : "ml-1 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300 border border-red-500/40"
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2" ref={menuRef}>
          <span>使用者:</span>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-slate-200 transition-colors hover:bg-slate-800/70"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              {authUser?.avatar_url ? (
                <img
                  src={authUser.avatar_url}
                  alt={authLabel}
                  className="h-5 w-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-200">
                  {authLabel?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span>{authLabel}</span>
              <span
                className={`text-[10px] transition-transform ${
                  isMenuOpen ? "rotate-180" : ""
                }`}
              >
                <ExpandMore />
              </span>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-slate-700 bg-slate-950/95 shadow-lg">
                {authSubLabel && (
                  <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800">
                    {authSubLabel}
                  </div>
                )}

                {authUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800/70"
                  >
                    Google 登出
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogin?.();
                    }}
                    disabled={authLoading}
                    className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800/70 disabled:opacity-60"
                  >
                    {authLoading ? "登入中..." : "Google 登入"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/rooms");
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800/70"
                >
                  回主畫面
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/edit");
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800/70"
                >
                  自己的收藏庫
                </button>
              </div>
            )}
          </div>
        </div>
        Ping: {ping ? ping + "ms" : "Loading.."}
      </div>
    </header>
  );
};

export default HeaderSection;
