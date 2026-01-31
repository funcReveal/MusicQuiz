import {
  ExpandMore,
  LibraryMusic,
  Login,
  Logout,
  ManageAccounts,
  MeetingRoom,
} from "@mui/icons-material";
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Typography,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
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
  onEditProfile?: () => void;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  serverUrl,
  isConnected,
  displayUsername,
  authUser,
  authLoading = false,
  onLogin,
  onLogout,
  onEditProfile,
}) => {
  const navigate = useNavigate();
  const authLabel = authUser?.display_name || authUser?.id || displayUsername;
  const authSubLabel = authUser?.email ?? null;

    async function checkPing() {
      const API_URL =
        import.meta.env.VITE_API_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const start = performance.now();
      await fetch(`${API_URL}/health`);
      const end = performance.now();
      return Math.round(end - start);
    }
  const [ping, setPing] = useState<number | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchorEl);
  const menuId = isMenuOpen ? "header-menu-popover" : undefined;

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

  const equalizerBars = useMemo(
    () => [
      { height: 8, delay: "0s" },
      { height: 14, delay: "0.12s" },
      { height: 10, delay: "0.24s" },
    ],
    [],
  );

  const handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl((prev) => (prev ? null : event.currentTarget));
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const menuItemSx = useMemo(
    () => ({
      px: 2,
      py: 1.1,
      gap: 1.5,
      "&:hover": {
        background:
          "linear-gradient(90deg, rgba(56, 189, 248, 0.14), rgba(129, 140, 248, 0.08))",
      },
      "& .MuiListItemText-primary": {
        color: "#e2e8f0",
        fontWeight: 600,
        fontSize: "0.92rem",
      },
      "& .MuiListItemText-secondary": {
        color: "rgba(148, 163, 184, 0.85)",
        fontSize: "0.72rem",
        marginTop: "2px",
      },
    }),
    [],
  );
  return (
    <header className="mb-3 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-5xl font-semibold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
          MusicQuiz
        </h1>
        <p className="text-1xl text-slate-400" />
      </div>
      <div className="text-right text-shadow-md text-slate-400 space-y-1">
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-slate-300 text-[11px]">{serverUrl}</span>
        </div>
        <div>
          連線狀態：
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
        <div className="flex items-center justify-end gap-2">
          <span>使用者：</span>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={handleMenuToggle}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-slate-200 transition-colors hover:bg-slate-800/70"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
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
            <Popover
              id={menuId}
              open={isMenuOpen}
              anchorEl={menuAnchorEl}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 260,
                  borderRadius: 2.5,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  background:
                    "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98))",
                  boxShadow:
                    "0 18px 40px rgba(2, 6, 23, 0.45), 0 0 0 1px rgba(14, 165, 233, 0.08)",
                  backdropFilter: "blur(16px)",
                  overflow: "hidden",
                },
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  background:
                    "linear-gradient(90deg, rgba(14, 165, 233, 0.12), rgba(129, 140, 248, 0.05))",
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(148, 163, 184, 0.8)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                    }}
                  >
                    帳號
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "#e2e8f0", fontWeight: 700 }}
                  >
                    {authLabel}
                  </Typography>
                  {authSubLabel && (
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(148, 163, 184, 0.85)" }}
                    >
                      {authSubLabel}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end" }}>
                  {equalizerBars.map((bar) => (
                    <Box
                      key={bar.delay}
                      sx={{
                        width: 4,
                        height: bar.height,
                        borderRadius: 999,
                        background:
                          "linear-gradient(180deg, rgba(56, 189, 248, 0.95), rgba(129, 140, 248, 0.95))",
                        transformOrigin: "bottom",
                        animation: "eqPulse 1.05s ease-in-out infinite",
                        animationDelay: bar.delay,
                        "@keyframes eqPulse": {
                          "0%": { transform: "scaleY(0.6)", opacity: 0.75 },
                          "50%": { transform: "scaleY(1.4)", opacity: 1 },
                          "100%": { transform: "scaleY(0.7)", opacity: 0.85 },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.14)" }} />
              <MenuList sx={{ py: 0 }}>
                {authUser ? (
                  <>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        onEditProfile?.();
                      }}
                      sx={menuItemSx}
                    >
                      <ListItemIcon sx={{ minWidth: 30, color: "#7dd3fc" }}>
                        <ManageAccounts fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="編輯個人資料"
                        secondary="更換暱稱與頭像"
                      />
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        onLogout?.();
                      }}
                      sx={menuItemSx}
                    >
                      <ListItemIcon sx={{ minWidth: 30, color: "#fca5a5" }}>
                        <Logout fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="登出" secondary="切換帳號" />
                    </MenuItem>
                  </>
                ) : (
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      onLogin?.();
                    }}
                    disabled={authLoading}
                    sx={menuItemSx}
                  >
                    <ListItemIcon sx={{ minWidth: 30, color: "#38bdf8" }}>
                      <Login fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={authLoading ? "登入中..." : "使用 Google 登入"}
                      secondary="同步 YouTube 播放清單"
                    />
                  </MenuItem>
                )}
                <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.12)" }} />
                <MenuItem
                  onClick={() => {
                    handleMenuClose();
                    navigate("/rooms");
                  }}
                  sx={menuItemSx}
                >
                  <ListItemIcon sx={{ minWidth: 30, color: "#fde68a" }}>
                    <MeetingRoom fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="房間列表" secondary="回到大廳" />
                </MenuItem>
                {authUser && (
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      navigate("/collections");
                    }}
                    sx={menuItemSx}
                  >
                    <ListItemIcon sx={{ minWidth: 30, color: "#a7f3d0" }}>
                      <LibraryMusic fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="收藏庫" secondary="管理題庫" />
                  </MenuItem>
                )}
              </MenuList>
            </Popover>
          </div>
        </div>
        Ping: {ping ? ping + "ms" : "Loading.."}
      </div>
    </header>
  );
};

export default HeaderSection;




