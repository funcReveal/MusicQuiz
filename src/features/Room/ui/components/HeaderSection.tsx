import {
  ExpandMore,
  LibraryMusic,
  Login,
  Logout,
  ManageAccounts,
  Memory,
  MeetingRoom,
  Refresh,
} from "@mui/icons-material";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import BrandLogo from "../../../../shared/ui/BrandLogo";

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

type SystemStatusPayload = {
  status: "ok";
  timestamp: string;
  process: {
    pid: number;
    uptimeSec: number;
    nodeVersion: string;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
  os: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    uptimeSec: number;
    cpus: number;
    loadAverage: [number, number, number];
    memory: {
      freeBytes: number;
      usedBytes: number;
      totalBytes: number;
      usedPercent: number;
    };
    containerMemory?: {
      source: "cgroup-v1" | "cgroup-v2";
      usedBytes: number | null;
      limitBytes: number | null;
      remainingBytes: number | null;
      usedPercent: number | null;
    } | null;
  };
};

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** power;
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
};

const formatDuration = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const day = Math.floor(sec / 86400);
  const hour = Math.floor((sec % 86400) / 3600);
  const min = Math.floor((sec % 3600) / 60);
  if (day > 0) return `${day}d ${hour}h`;
  if (hour > 0) return `${hour}h ${min}m`;
  return `${min}m`;
};

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
  const location = useLocation();
  const isHomeRoute = location.pathname === "/" || location.pathname === "/rooms";
  const authLabel =
    authUser?.display_name || authUser?.id || displayUsername || "Guest";
  const authSubLabel = authUser?.email ?? null;

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusPayload | null>(
    null,
  );

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

  const fetchSystemStatus = useCallback(async () => {
    setSystemLoading(true);
    setSystemError(null);
    try {
      const res = await fetch(`${API_URL}/api/system/status`);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const payload = (await res.json()) as SystemStatusPayload;
      setSystemStatus(payload);
    } catch (error) {
      setSystemError(
        error instanceof Error ? error.message : "Failed to fetch system status",
      );
    } finally {
      setSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!systemOpen) return;
    void fetchSystemStatus();
    const timer = window.setInterval(() => {
      void fetchSystemStatus();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [fetchSystemStatus, systemOpen]);

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
          <ListItemText
            primary="編輯個人資料"
            secondary="更新暱稱與頭像"
          />
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
          <ListItemText primary="登出" secondary="退出目前帳號" />
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
            secondary="啟用 YouTube 播放清單匯入"
          />
        </MenuItem>,
      ];

  return (
    <header className="flex items-center justify-between gap-4 text-[var(--mc-text)]">
      {isHomeRoute ? (
        <Link
          to="/rooms"
          className="inline-flex items-center rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/72 px-3 py-2 shadow-[0_12px_40px_-28px_rgba(245,158,11,0.45)] transition hover:bg-[var(--mc-surface-strong)]/82"
        >
          <BrandLogo compact />
        </Link>
      ) : (
        <div />
      )}
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
                setSystemOpen(true);
              }}
              sx={menuItemSx}
            >
              <ListItemIcon sx={{ minWidth: 30, color: "#f59e0b" }}>
                <Memory fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="系統狀態"
                secondary="檢視後端 OS 與執行狀態"
              />
            </MenuItem>

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
              <ListItemText
                primary="房間大廳"
                secondary="瀏覽與加入遊戲房間"
              />
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
                <ListItemText
                  primary="收藏庫"
                  secondary="管理你的題庫收藏"
                />
              </MenuItem>
            )}
          </MenuList>
        </Popover>

        <Dialog
          open={systemOpen}
          onClose={() => setSystemOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              borderRadius: 3,
              border: "1px solid var(--mc-border)",
              background:
                "linear-gradient(180deg, rgba(20, 17, 13, 0.98), rgba(11, 10, 8, 0.98))",
            },
          }}
        >
          <DialogTitle
            sx={{
              borderBottom: "1px solid rgba(245, 158, 11, 0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Memory fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                後端系統狀態
              </Typography>
              <Chip
                label={systemStatus?.status === "ok" ? "Healthy" : "Unknown"}
                size="small"
                sx={{
                  bgcolor:
                    systemStatus?.status === "ok"
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(148, 163, 184, 0.2)",
                  color: "#e2e8f0",
                }}
              />
            </Stack>

            <IconButton
              size="small"
              onClick={() => {
                void fetchSystemStatus();
              }}
              disabled={systemLoading}
              sx={{ color: "var(--mc-text-muted)" }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            {systemError ? (
              <Typography color="#fca5a5" variant="body2">
                Failed to load system status: {systemError}
              </Typography>
            ) : (
              <Stack spacing={1.4} sx={{ color: "var(--mc-text)" }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid rgba(245, 158, 11, 0.16)",
                    background: "rgba(0,0,0,0.26)",
                  }}
                >
                  <Typography variant="caption" color="var(--mc-text-muted)">
                    更新時間
                  </Typography>
                  <Typography variant="body2">
                    {systemStatus?.timestamp
                      ? new Date(systemStatus.timestamp).toLocaleString()
                      : "-"}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={`Host: ${systemStatus?.os.hostname ?? "-"}`}
                    sx={{
                      border: "1px solid rgba(245, 158, 11, 0.22)",
                      color: "var(--mc-text)",
                      bgcolor: "rgba(0,0,0,0.2)",
                    }}
                  />
                  <Chip
                    label={`OS: ${systemStatus?.os.platform ?? "-"} ${systemStatus?.os.arch ?? ""}`}
                    sx={{
                      border: "1px solid rgba(245, 158, 11, 0.22)",
                      color: "var(--mc-text)",
                      bgcolor: "rgba(0,0,0,0.2)",
                    }}
                  />
                  <Chip
                    label={`Node: ${systemStatus?.process.nodeVersion ?? "-"}`}
                    sx={{
                      border: "1px solid rgba(245, 158, 11, 0.22)",
                      color: "var(--mc-text)",
                      bgcolor: "rgba(0,0,0,0.2)",
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: "1px solid rgba(245, 158, 11, 0.12)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      服務運行時間
                    </Typography>
                    <Typography variant="body2">
                      {formatDuration(systemStatus?.process.uptimeSec ?? 0)}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: "1px solid rgba(245, 158, 11, 0.12)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      系統運行時間
                    </Typography>
                    <Typography variant="body2">
                      {formatDuration(systemStatus?.os.uptimeSec ?? 0)}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: "1px solid rgba(245, 158, 11, 0.12)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      CPU 核心 / 負載
                    </Typography>
                    <Typography variant="body2">
                      {(systemStatus?.os.cpus ?? 0).toString()} /{" "}
                      {(systemStatus?.os.loadAverage ?? [0, 0, 0])
                        .map((n) => n.toFixed(2))
                        .join(", ")}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: "1px solid rgba(245, 158, 11, 0.12)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      系統記憶體
                    </Typography>
                    <Typography variant="body2">
                      {formatBytes(systemStatus?.os.memory.usedBytes ?? 0)} /{" "}
                      {formatBytes(systemStatus?.os.memory.totalBytes ?? 0)} ({" "}
                      {systemStatus?.os.memory.usedPercent ?? 0}%)
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: "1px solid rgba(245, 158, 11, 0.12)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      Render 容器剩餘記憶體
                    </Typography>
                    <Typography variant="body2">
                      {systemStatus?.os.containerMemory?.remainingBytes !== null &&
                      systemStatus?.os.containerMemory?.remainingBytes !==
                        undefined
                        ? formatBytes(systemStatus.os.containerMemory.remainingBytes)
                        : "N/A"}
                    </Typography>
                    <Typography variant="caption" color="var(--mc-text-muted)">
                      {systemStatus?.os.containerMemory
                        ? `${systemStatus.os.containerMemory.usedBytes !== null ? formatBytes(systemStatus.os.containerMemory.usedBytes) : "N/A"} / ${systemStatus.os.containerMemory.limitBytes !== null ? formatBytes(systemStatus.os.containerMemory.limitBytes) : "N/A"} (${systemStatus.os.containerMemory.usedPercent !== null ? `${systemStatus.os.containerMemory.usedPercent}%` : "N/A"}) · ${systemStatus.os.containerMemory.source}`
                        : "目前環境未提供 cgroup 記憶體資訊"}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="caption" color="var(--mc-text-muted)">
                  每 10 秒自動更新
                </Typography>
              </Stack>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
};

export default HeaderSection;
