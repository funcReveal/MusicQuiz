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
  CardHeader,
  Chip,
  Divider,
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
  rooms,
  username,
  currentRoomId,
  joinPassword,
  playlistProgress,
  questionCount,
  onQuestionCountChange,
  questionMin = 1,
  questionMax = 100,
  questionStep = 5,
  questionControlsEnabled = true,
  showRoomList = true,
  onRoomNameChange,
  onRoomPasswordChange,
  onJoinPasswordChange,
  onPlaylistUrlChange,
  onFetchPlaylist,
  onResetPlaylist,
  onCreateRoom,
  onJoinRoom,
}) => {
  const canCreateRoom = Boolean(
    username && roomName.trim() && playlistItems.length > 0
  );
  const showPlaylistInput = playlistStage === "input";
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
          {/* <Button
            size="small"
            variant="text"
            color="info"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            開啟
          </Button> */}
        </div>
      </div>
    );
  };

  const adjustQuestionCount = (delta: number) => {
    const next = Math.min(
      questionMax,
      Math.max(questionMin, questionCount + delta)
    );
    onQuestionCountChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        variant="outlined"
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-50"
      >
        {/* <CardHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-violet-400 inline-block" />
              <Typography variant="h6" className="text-slate-50" fontSize={16}>
                建立房間
              </Typography>
              {!showPlaylistInput ? (
                <Chip
                  label="播放清單已鎖定"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  label="待貼播放清單"
                  size="small"
                  variant="outlined"
                  className="text-slate-200 border-slate-600"
                />
              )}
              {playlistProgress.total > 0 && (
                <Chip
                  label={`進度 ${playlistProgress.received}/${playlistProgress.total}`}
                  size="small"
                  variant="outlined"
                  className="text-slate-200 border-slate-600"
                />
              )}
            </Stack>
          }
        /> */}
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
              placeholder="留空代表無需密碼"
              value={roomPassword}
              onChange={(e) => onRoomPasswordChange(e.target.value)}
              disabled={!username}
              variant="standard"
              autoComplete="off"
            />
          </Stack>

          <Accordion
            disabled={!canAdjustQuestions}
            disableGutters
            square
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
                <Typography variant="body2" className="text-slate-100">
                  房間設定
                </Typography>
                <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                  <Typography variant="caption" className="text-slate-400">
                    匯入歌單後解鎖
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

          {/* {!showPlaylistInput ? (
                <Chip
                  label="播放清單已鎖定"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  label="待貼播放清單"
                  size="small"
                  variant="outlined"
                  className="text-slate-200 border-slate-600"
                />
              )} */}
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
                    borderBottom: "1px solid rgba(148,163,184,.6)", // disabled 底線樣式
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
                  若要換清單，請按「重選播放清單」，並重新貼上。
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

      {showRoomList && (
        <Card
          variant="outlined"
          className="w-full bg-slate-950/80 border border-slate-800 text-slate-50"
        >
          <CardHeader
            title={
              <Typography variant="subtitle1" className="text-slate-100">
                房間列表
              </Typography>
            }
          />
          <CardContent className="p-0">
            {rooms.length === 0 ? (
              <Typography
                variant="body2"
                className="text-slate-500 text-center py-4"
              >
                目前沒有房間，試著建立一個吧！
              </Typography>
            ) : (
              rooms.map((room) => {
                const isCurrent = currentRoomId === room.id;
                return (
                  <React.Fragment key={room.id}>
                    <div
                      className={`px-4 py-3 flex items-center justify-between text-sm ${
                        isCurrent
                          ? "bg-slate-900/90 border-l-2 border-l-sky-400"
                          : "hover:bg-slate-900/70"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-100 flex items-center gap-2">
                          {room.name}
                          {room.hasPassword && (
                            <Chip
                              label="密碼"
                              size="small"
                              variant="outlined"
                              className="text-slate-200 border-slate-600"
                            />
                          )}
                          <Chip
                            label={`題數 ${
                              room.gameSettings?.questionCount ?? "-"
                            }`}
                            size="small"
                            variant="outlined"
                            className="text-slate-200 border-slate-600"
                          />
                          {isCurrent && (
                            <Chip
                              label="Current"
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Players: {room.playerCount} ・ 清單{" "}
                          {room.playlistCount} 首 ・{" "}
                          {new Date(room.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {room.hasPassword && (
                          <TextField
                            size="small"
                            label="房間密碼"
                            value={joinPassword}
                            onChange={(e) =>
                              onJoinPasswordChange(e.target.value)
                            }
                            className="bg-slate-900"
                          />
                        )}
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={!username}
                          onClick={() => onJoinRoom(room.id, room.hasPassword)}
                        >
                          加入
                        </Button>
                      </Stack>
                    </div>
                    <Divider className="bg-slate-800" />
                  </React.Fragment>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoomCreationSection;
