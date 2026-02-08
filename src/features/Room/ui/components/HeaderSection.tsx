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
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface HeaderSectionProps {
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
  onNavigateRooms?: () => void;
  onNavigateCollections?: () => void;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  displayUsername,
  authUser,
  authLoading = false,
  onLogin,
  onLogout,
  onEditProfile,
  onNavigateRooms,
  onNavigateCollections,
}) => {
  const navigate = useNavigate();
  const authLabel =
    authUser?.display_name || authUser?.id || displayUsername || "Guest";
  const authSubLabel = authUser?.email ?? null;
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchorEl);
  const menuId = isMenuOpen ? "header-menu-popover" : undefined;

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

  const authMenuItems = authUser
    ? [
        <MenuItem
          key="edit-profile"
          onClick={() => {
            handleMenuClose();
            onEditProfile?.();
          }}
          sx={menuItemSx}
        >
          <ListItemIcon sx={{ minWidth: 30, color: "#7dd3fc" }}>
            <ManageAccounts fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="編輯個人資料" secondary="更換暱稱與頭像" />
        </MenuItem>,
        <MenuItem
          key="logout"
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
        </MenuItem>,
      ]
    : [
        <MenuItem
          key="login"
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
        </MenuItem>,
      ];

  return (
    <header className="flex items-center justify-end gap-4 text-[var(--mc-text)]">
      <div className="relative inline-flex items-center">
        {authUser ? (
          <button
            type="button"
            onClick={handleMenuToggle}
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 px-3 py-1.5 text-sm font-medium text-[var(--mc-text)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition hover:border-slate-500/80 hover:bg-[var(--mc-surface-strong)]/80"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
          >
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
                Menu
              </span>
            <span className="h-4 w-[1px] bg-[var(--mc-border)]" />
            {authUser.avatar_url ? (
              <img
                src={authUser.avatar_url}
                alt={authLabel}
                className="h-6 w-6 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--mc-surface-strong)] text-[11px] text-[var(--mc-text)]">
                {authLabel?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="max-w-[140px] truncate text-sm text-[var(--mc-text)]">
              {authLabel}
            </span>
            <span
              className={`text-[10px] transition-transform ${
                isMenuOpen ? "rotate-180" : ""
              }`}
            >
              <ExpandMore />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMenuToggle}
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--mc-accent-2)]/40 bg-[var(--mc-accent-2)]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100 shadow-[0_10px_30px_-24px_rgba(16,185,129,0.5)] transition hover:border-[var(--mc-accent-2)]/60 hover:bg-[var(--mc-accent-2)]/20"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
          >
            <span className="h-2 w-2 rounded-full bg-[var(--mc-accent-2)] shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            Sign in
            <span
              className={`text-[10px] transition-transform ${
                isMenuOpen ? "rotate-180" : ""
              }`}
            >
              <ExpandMore />
            </span>
          </button>
        )}
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
            {authMenuItems}
            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.12)" }} />
            <MenuItem
              onClick={() => {
                handleMenuClose();
                if (onNavigateRooms) {
                  onNavigateRooms();
                  return;
                }
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
                  if (onNavigateCollections) {
                    onNavigateCollections();
                    return;
                  }
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
    </header>
  );
};

export default HeaderSection;
