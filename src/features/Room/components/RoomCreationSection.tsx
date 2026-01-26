import React from "react";
import {
  Alert,
  Avatar,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  CardContent,
  Chip,
  Fade,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { List as VirtualList, type RowComponentProps } from "react-window";
import type { PlaylistItem, RoomSummary } from "../types";

interface RoomCreationSectionProps {
  roomName: string;
  roomPassword: string;
  playlistUrl: string;
  playlistItems: PlaylistItem[];
  playlistLoading: boolean;
  playlistError: string | null;
  playlistStage: "input" | "preview";
  playlistLocked: boolean;
  rooms: RoomSummary[];
  username: string | null;
  currentRoomId: string | null;
  joinPassword: string;
  playlistProgress: { received: number; total: number; ready: boolean };
  questionCount: number;
  onQuestionCountChange: (value: number) => void;
  questionMin?: number;
  questionMax?: number;
  questionStep?: number;
  questionControlsEnabled?: boolean;
  questionLimitLabel?: string;
  showRoomList?: boolean;
  onRoomNameChange: (value: string) => void;
  onRoomPasswordChange: (value: string) => void;
  onJoinPasswordChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylist: () => void;
  onResetPlaylist: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string, hasPassword: boolean) => void;
}

const RoomCreationSection: React.FC<RoomCreationSectionProps> = ({
  roomName,
  roomPassword,
  playlistUrl,
  playlistItems,
  playlistError,
  playlistLoading,
  playlistStage,
  playlistLocked,

  username,

  playlistProgress,
  questionCount,
  onQuestionCountChange,
  questionMin = 1,
  questionMax = 100,
  questionStep = 5,
  questionControlsEnabled = true,
  onRoomNameChange,
  onRoomPasswordChange,
  onPlaylistUrlChange,
  onFetchPlaylist,
  onResetPlaylist,
  onCreateRoom,
}) => {
  const [settingsExpanded, setSettingsExpanded] = React.useState(false);
  const passwordRef = React.useRef(roomPassword);
  const isComposingRef = React.useRef(false);
  const isAsciiAlphaNum = (value: string) => /^[a-zA-Z0-9]*$/.test(value);
  const canCreateRoom = Boolean(
    username && roomName.trim() && playlistItems.length > 0,
  );
  const showPlaylistInput = playlistStage === "input";

  React.useEffect(() => {
    passwordRef.current = roomPassword;
  }, [roomPassword]);
  const rowCount = playlistItems.length;
  const canAdjustQuestions =
    questionControlsEnabled && playlistItems.length > 0;

  const isPlaylistLink = React.useMemo(() => {
    const url = playlistUrl.trim();
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isYouTubeHost =
        host.includes("youtube.com") || host.includes("youtu.be");
      if (!isYouTubeHost) return false;

      if (parsed.searchParams.get("list")) return true;

      const segments = parsed.pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return parsed.pathname.includes("playlist") && Boolean(lastSegment);
    } catch {
      return false;
    }
  }, [playlistUrl]);

  const PlaylistRow = ({ index, style }: RowComponentProps) => {
    const item = playlistItems[index];
    return (
      <div style={style}>
        <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-800/60">
          <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-hidden">
            <Avatar
              variant="rounded"
              src={item.thumbnail}
              sx={{ bgcolor: "#334155", width: 56, height: 56, fontSize: 14 }}
            >
              {index + 1}
            </Avatar>
            <div className="flex-1 min-w-0">
              <Typography
                variant="body2"
                className="max-w-99/100 truncate text-slate-400 "
              >
                <a
                  className="text-slate-100 hover:text-sky-400 transition-colors duration-300"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
              </Typography>

              <p className="text-[11px] text-slate-400">
                {item.uploader ?? "Unknown"}
                {item.duration ? ` · ${item.duration}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const adjustQuestionCount = (delta: number) => {
    const next = Math.min(
      questionMax,
      Math.max(questionMin, questionCount + delta),
    );
    onQuestionCountChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        variant="outlined"
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-50"
      >
        <CardContent className="space-y-3">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="房間名稱"
              slotProps={{ inputLabel: { shrink: true } }}
              placeholder="例如：Quiz Room #1"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              disabled={!username}
              variant="standard"
              autoComplete="off"
            />
            <TextField
              size="small"
              label="密碼（選填）"
              slotProps={{ inputLabel: { shrink: true } }}
              placeholder="留空代表不設密碼"
              value={roomPassword}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                const value = e.currentTarget.value;
                if (isAsciiAlphaNum(value)) {
                  passwordRef.current = value;
                  onRoomPasswordChange(value);
                } else {
                  onRoomPasswordChange(passwordRef.current);
                }
              }}
              onBeforeInput={(e) => {
                const data = e.data ?? "";
                if (data && !isAsciiAlphaNum(data)) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (pasted && !isAsciiAlphaNum(pasted)) {
                  e.preventDefault();
                }
              }}
              onChange={(e) => {
                if (isComposingRef.current) return;
                const value = e.target.value;
                if (!isAsciiAlphaNum(value)) return;
                passwordRef.current = value;
                onRoomPasswordChange(value);
              }}
              disabled={!username}
              variant="standard"
              autoComplete="off"
              inputProps={{ inputMode: "text", pattern: "[A-Za-z0-9]*" }}
            />
          </Stack>

          <Accordion
            disabled={!canAdjustQuestions}
            disableGutters
            square
            expanded={settingsExpanded}
            onChange={(_, expanded) => setSettingsExpanded(expanded)}
            sx={{
              borderRadius: 1.5,
              backgroundColor: "rgba(15,23,42,0.4)",
              border: "1px solid rgba(148,163,184,0.2)",
              transition:
                "background-color 200ms ease, border-color 200ms ease",
              "&::before": {
                display: "none",
              },
              "&.Mui-disabled": {
                opacity: 1,
                backgroundColor: "rgba(15,23,42,0.25)",
              },
              "& .MuiButton-root": {
                transition: "color 200ms ease, border-color 200ms ease",
              },
            }}
          >
            <AccordionSummary
              sx={{
                "&.Mui-disabled .MuiTypography-root": {
                  color: "rgba(241,245,249,0.95)",
                  opacity: 1,
                  transition: "color 200ms ease, opacity 200ms ease",
                },
                "&.Mui-disabled .MuiSvgIcon-root": {
                  opacity: 1,
                },
                "&.Mui-disabled .MuiAccordionSummary-expandIconWrapper": {
                  color: "rgba(148,163,184,0.9)",
                },
              }}
              expandIcon={
                !canAdjustQuestions ? (
                  <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                    <LockOutlinedIcon
                      fontSize="small"
                      sx={{
                        color: "text.disabled",
                      }}
                    />
                  </Fade>
                ) : (
                  <ExpandMoreIcon
                    sx={{
                      color: canAdjustQuestions
                        ? "text.primary"
                        : "text.disabled",
                    }}
                  />
                )
              }
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {!settingsExpanded && canAdjustQuestions ? (
                  <Typography variant="body2" className="text-slate-100">
                    公開、共 {questionCount} 題
                  </Typography>
                ) : (
                  <Typography variant="body2" className="text-slate-100">
                    房間設定
                  </Typography>
                )}
                <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                  <Typography variant="caption" className="text-slate-400">
                    載入清單後解鎖
                  </Typography>
                </Fade>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack
                direction={"row"}
                spacing={1.5}
                alignItems={{ sm: "center" }}
                sx={{
                  p: 1,
                  minWidth: "fit-content",
                }}
              >
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onQuestionCountChange(questionMin)}
                    disabled={
                      !canAdjustQuestions || questionCount === questionMin
                    }
                  >
                    最小
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => adjustQuestionCount(-questionStep)}
                    disabled={
                      !canAdjustQuestions || questionCount <= questionMin
                    }
                  >
                    -{questionStep}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => adjustQuestionCount(-1)}
                    disabled={
                      !canAdjustQuestions || questionCount <= questionMin
                    }
                  >
                    -1
                  </Button>
                </Stack>

                <Stack
                  spacing={0.25}
                  alignItems={"center"}
                  sx={{ minWidth: 120 }}
                >
                  <Typography variant="body2" className="text-slate-200">
                    題數
                  </Typography>
                  <Typography variant="h4" className="text-slate-50">
                    {questionCount}
                  </Typography>
                  <Typography variant="caption" className="text-slate-400">
                    {questionMin}–{questionMax}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => adjustQuestionCount(1)}
                    disabled={
                      !canAdjustQuestions || questionCount >= questionMax
                    }
                  >
                    +1
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => adjustQuestionCount(questionStep)}
                    disabled={
                      !canAdjustQuestions || questionCount >= questionMax
                    }
                  >
                    +{questionStep}
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onQuestionCountChange(questionMax)}
                    disabled={
                      !canAdjustQuestions || questionCount === questionMax
                    }
                  >
                    最大
                  </Button>
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Button
            sx={{ mb: "20px" }}
            fullWidth
            variant="contained"
            color="success"
            disabled={!canCreateRoom}
            onClick={onCreateRoom}
          >
            建立房間
          </Button>

          {playlistProgress.total > 0 && (
            <Chip
              label={`進度 ${playlistProgress.received}/${playlistProgress.total}`}
              size="small"
              variant="outlined"
              className="text-slate-200 border-slate-600"
            />
          )}
          {showPlaylistInput ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                sx={{
                  flex: 1,
                  "& .MuiInput-root.Mui-disabled:before": {
                    borderBottom: "1px solid rgba(148,163,184,.6)", // disabled underline style
                  },
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
                label="YouTube 播放清單網址"
                variant="standard"
                placeholder="https://www.youtube.com/playlist?list=..."
                value={playlistUrl}
                onChange={(e) => onPlaylistUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const canFetch =
                    !!username &&
                    isPlaylistLink &&
                    !playlistLoading &&
                    !playlistLocked;
                  if (canFetch) {
                    onFetchPlaylist();
                  }
                }}
                disabled={!username || playlistLoading || playlistLocked}
                autoComplete="off"
              />
              <Button
                variant="contained"
                color="primary"
                disabled={
                  !username ||
                  !isPlaylistLink ||
                  playlistLoading ||
                  playlistLocked
                }
                onClick={onFetchPlaylist}
              >
                {playlistLoading ? "載入中..." : "載入清單"}
              </Button>
            </Stack>
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" className="text-slate-100">
                  播放清單已鎖定
                </Typography>
                <Typography variant="body2" className="text-slate-400">
                  如需重選，請按「重選播放清單」並重新貼上網址。
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="outlined" onClick={onResetPlaylist}>
                  重選播放清單
                </Button>
                <Chip
                  label="Locked"
                  color="success"
                  variant="outlined"
                  className="animate-pulse"
                />
              </Stack>
            </Stack>
          )}
          {playlistLoading && <LinearProgress color="primary" />}
          {playlistError && (
            <Alert severity="error" variant="outlined">
              {playlistError}
            </Alert>
          )}
          {playlistItems.length > 0 && (
            <div className="space-y-1 text-xs text-slate-300">
              <Typography variant="subtitle2" className="text-slate-100">
                已載入 {playlistItems.length} 首歌曲
              </Typography>
              <div className="rounded border border-slate-800 bg-slate-900/60">
                <VirtualList
                  style={{ height: 280, width: "100%" }}
                  rowCount={rowCount}
                  rowHeight={75}
                  rowProps={{}}
                  rowComponent={PlaylistRow}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomCreationSection;
