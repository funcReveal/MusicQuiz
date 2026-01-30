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
  youtubePlaylists?: { id: string; title: string; itemCount: number }[];
  youtubePlaylistsLoading?: boolean;
  youtubePlaylistsError?: string | null;
  collections?: Array<{
    id: string;
    title: string;
    description?: string | null;
  }>;
  collectionsLoading?: boolean;
  collectionsError?: string | null;
  selectedCollectionId?: string | null;
  collectionItemsLoading?: boolean;
  collectionItemsError?: string | null;
  isGoogleAuthed?: boolean;
  onGoogleLogin?: () => void;
  onRoomNameChange: (value: string) => void;
  onRoomPasswordChange: (value: string) => void;
  onJoinPasswordChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylist: () => void;
  onResetPlaylist: () => void;
  onFetchYoutubePlaylists?: () => void;
  onImportYoutubePlaylist?: (playlistId: string) => void;
  onFetchCollections?: () => void;
  onSelectCollection?: (collectionId: string | null) => void;
  onLoadCollectionItems?: (collectionId: string) => void;
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
  youtubePlaylists = [],
  youtubePlaylistsLoading = false,
  youtubePlaylistsError = null,
  collections = [],
  collectionsLoading = false,
  collectionsError = null,
  selectedCollectionId = null,
  collectionItemsLoading = false,
  collectionItemsError = null,
  isGoogleAuthed = false,
  onGoogleLogin,
  onRoomNameChange,
  onRoomPasswordChange,
  onPlaylistUrlChange,
  onFetchPlaylist,
  onResetPlaylist,
  onFetchYoutubePlaylists,
  onImportYoutubePlaylist,
  onFetchCollections,
  onSelectCollection,
  onLoadCollectionItems,
  onCreateRoom,
}) => {
  const [settingsExpanded, setSettingsExpanded] = React.useState(false);
  const [selectedYoutubeId, setSelectedYoutubeId] = React.useState("");
  const [playlistSource, setPlaylistSource] = React.useState<
    "link" | "mine" | "collection"
  >("link");
  const needsReauth = Boolean(
    youtubePlaylistsError && youtubePlaylistsError.includes("重新授權"),
  );
  const channelMissing = Boolean(
    youtubePlaylistsError &&
    youtubePlaylistsError.includes("尚未建立 YouTube 頻道"),
  );
  const isAsciiAlphaNum = (value: string) => /^[a-zA-Z0-9]*$/.test(value);
  const canCreateRoom = Boolean(
    username && roomName.trim() && playlistItems.length > 0,
  );
  const showPlaylistInput = playlistStage === "input";
  const privacyLabel = roomPassword.trim() ? "需密碼" : "公開";
  const playlistSourceLoading = playlistLoading || collectionItemsLoading;

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
        <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-200/80">
          <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-hidden">
            <Avatar
              variant="rounded"
              src={item.thumbnail}
              sx={{ bgcolor: "#e6d6c3", width: 56, height: 56, fontSize: 14 }}
            >
              {index + 1}
            </Avatar>
            <div className="flex-1 min-w-0">
              <Typography
                variant="body2"
                className="max-w-99/100 truncate room-create-muted"
              >
                <a
                  className="text-slate-900 hover:text-orange-600 transition-colors duration-300"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
              </Typography>

              <p className="text-[11px] text-slate-500">
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
      <Card variant="outlined" className="w-full room-create-card">
        <CardContent className="room-create-card-content">
          <div className="room-create-section-title">
            <div>
              <p className="room-create-kicker">Step 01</p>
              <h3>基本設定</h3>
              <p className="room-create-muted">
                房間名稱與密碼會顯示在邀請連結上。
              </p>
            </div>
            <span className="room-create-chip">{privacyLabel}</span>
          </div>

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
              className="room-create-field"
            />
            <TextField
              size="small"
              label="密碼（選填）"
              slotProps={{ inputLabel: { shrink: true } }}
              placeholder="留空代表不設密碼"
              value={roomPassword}
              onChange={(e) => {
                const value = e.target.value;
                if (!isAsciiAlphaNum(value)) return;
                onRoomPasswordChange(value);
              }}
              disabled={!username}
              variant="standard"
              autoComplete="off"
              className="room-create-field"
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
              backgroundColor: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(18,21,27,0.12)",
              transition:
                "background-color 200ms ease, border-color 200ms ease",
              "&::before": {
                display: "none",
              },
              "&.Mui-disabled": {
                opacity: 1,
                backgroundColor: "rgba(255,255,255,0.35)",
              },
              "& .MuiButton-root": {
                transition: "color 200ms ease, border-color 200ms ease",
              },
            }}
          >
            <AccordionSummary
              sx={{
                "& .MuiSvgIcon-root": {
                  color: "rgba(18,21,27,0.6)",
                },
                "&.Mui-disabled .MuiTypography-root": {
                  color: "rgba(18,21,27,0.75)",
                  opacity: 1,
                  transition: "color 200ms ease, opacity 200ms ease",
                },
                "&.Mui-disabled .MuiSvgIcon-root": {
                  opacity: 1,
                },
                "&.Mui-disabled .MuiAccordionSummary-expandIconWrapper": {
                  color: "rgba(18,21,27,0.5)",
                },
              }}
              expandIcon={
                !canAdjustQuestions ? (
                  <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                    <LockOutlinedIcon
                      fontSize="small"
                      sx={{
                        color: "rgba(18,21,27,0.45)",
                      }}
                    />
                  </Fade>
                ) : (
                  <ExpandMoreIcon
                    sx={{
                      color: canAdjustQuestions
                        ? "rgba(18,21,27,0.7)"
                        : "rgba(18,21,27,0.35)",
                    }}
                  />
                )
              }
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {!settingsExpanded && canAdjustQuestions ? (
                  <Typography variant="body2" className="room-create-muted">
                    公開、共 {questionCount} 題
                  </Typography>
                ) : (
                  <Typography variant="body2" className="room-create-muted">
                    房間設定
                  </Typography>
                )}
                <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                  <Typography variant="caption" className="room-create-muted">
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
                    className="room-create-accent-button"
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
                    className="room-create-accent-button"
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
                    className="room-create-accent-button"
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
                  <Typography variant="body2" className="room-create-muted">
                    題數
                  </Typography>
                  <Typography variant="h4" className="room-create-figure">
                    {questionCount}
                  </Typography>
                  <Typography variant="caption" className="room-create-muted">
                    {questionMin}–{questionMax}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    className="room-create-accent-button"
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
                    className="room-create-accent-button"
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
                    className="room-create-accent-button"
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

          {playlistProgress.total > 0 && (
            <Chip
              label={`進度 ${playlistProgress.received}/${playlistProgress.total}`}
              size="small"
              variant="outlined"
              className="room-create-muted"
            />
          )}
          <div className="room-create-section-title">
            <div>
              <p className="room-create-kicker">Step 02</p>
              <h3>播放清單</h3>
              <p className="room-create-muted">
                貼上 YouTube 播放清單連結或匯入已登入的清單。
              </p>
            </div>
          </div>
          {showPlaylistInput ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant={playlistSource === "link" ? "contained" : "outlined"}
                  className="room-create-accent-button"
                  onClick={() => {
                    setPlaylistSource("link");
                    setSelectedYoutubeId("");
                    onSelectCollection?.(null);
                  }}
                >
                  {"貼上連結"}
                </Button>
                <Button
                  variant={playlistSource === "mine" ? "contained" : "outlined"}
                  className="room-create-accent-button"
                  onClick={() => {
                    setPlaylistSource("mine");
                    onSelectCollection?.(null);
                  }}
                  disabled={!isGoogleAuthed}
                >
                  {"我的播放清單"}
                </Button>
                <Button
                  variant={
                    playlistSource === "collection" ? "contained" : "outlined"
                  }
                  onClick={() => {
                    setPlaylistSource("collection");
                    setSelectedYoutubeId("");
                  }}
                  disabled={!isGoogleAuthed}
                >
                  {"收藏庫"}
                </Button>
                {!isGoogleAuthed && (
                  <Typography variant="caption" className="room-create-muted">
                    {"登入後才能使用"}
                  </Typography>
                )}
              </Stack>

              {playlistSource === "link" && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    sx={{
                      flex: 1,
                      "& .MuiInput-root.Mui-disabled:before": {
                        borderBottom: "1px solid rgba(18, 21, 27, 0.4)",
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
                    className="room-create-field"
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    className="room-create-accent-button"
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
              )}

              {playlistSource === "mine" && onFetchYoutubePlaylists && (
                <Stack spacing={1.5}>
                  {!isGoogleAuthed && (
                    <Button
                      variant="outlined"
                      className="room-create-accent-button"
                      onClick={onGoogleLogin}
                      disabled={!onGoogleLogin}
                    >
                      {"使用 Google 登入"}
                    </Button>
                  )}
                  {isGoogleAuthed && (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Button
                        variant="outlined"
                        className="room-create-accent-button"
                        onClick={onFetchYoutubePlaylists}
                        disabled={!username || youtubePlaylistsLoading}
                      >
                        {youtubePlaylistsLoading
                          ? "載入中..."
                          : "取得我的播放清單"}
                      </Button>
                      {youtubePlaylists.length > 0 && (
                        <>
                          <select
                            value={selectedYoutubeId}
                            onChange={(e) =>
                              setSelectedYoutubeId(e.target.value)
                            }
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                          >
                            <option value="">{"請選擇播放清單"}</option>
                            {youtubePlaylists.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} · {item.itemCount}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="contained"
                            color="secondary"
                            className="room-create-accent-button"
                            disabled={!selectedYoutubeId}
                            onClick={() =>
                              selectedYoutubeId &&
                              onImportYoutubePlaylist?.(selectedYoutubeId)
                            }
                          >
                            {"匯入"}
                          </Button>
                        </>
                      )}
                    </Stack>
                  )}
                  {youtubePlaylistsError && (
                    <Alert
                      severity={channelMissing ? "info" : "error"}
                      variant="outlined"
                    >
                      {youtubePlaylistsError}
                    </Alert>
                  )}
                  {channelMissing && (
                    <Button
                      variant="outlined"
                      className="room-create-accent-button"
                      component="a"
                      href="https://www.youtube.com"
                      target="_blank"
                      rel="noreferrer"
                      disabled={youtubePlaylistsLoading}
                    >
                      {"前往 YouTube 建立播放清單"}
                    </Button>
                  )}
                  {needsReauth && onGoogleLogin && (
                    <Button
                      variant="outlined"
                      className="room-create-accent-button"
                      onClick={onGoogleLogin}
                      disabled={youtubePlaylistsLoading}
                    >
                      {"重新授權 Google"}
                    </Button>
                  )}
                </Stack>
              )}
              {playlistSource === "collection" && (
                <Stack spacing={1.5}>
                  {!isGoogleAuthed && (
                    <Button
                      variant="outlined"
                      onClick={onGoogleLogin}
                      disabled={!onGoogleLogin}
                    >
                      {"使用 Google 登入"}
                    </Button>
                  )}
                  {isGoogleAuthed && (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Button
                        variant="outlined"
                        onClick={onFetchCollections}
                        disabled={!onFetchCollections || collectionsLoading}
                      >
                        {collectionsLoading ? "載入中..." : "取得收藏庫"}
                      </Button>
                      {collections.length > 0 && (
                        <>
                          <select
                            value={selectedCollectionId ?? ""}
                            onChange={(e) =>
                              onSelectCollection?.(
                                e.target.value ? e.target.value : null,
                              )
                            }
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                          >
                            <option value="">{"請選擇收藏庫"}</option>
                            {collections.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="contained"
                            color="secondary"
                            disabled={
                              !selectedCollectionId || collectionItemsLoading
                            }
                            onClick={() =>
                              selectedCollectionId &&
                              onLoadCollectionItems?.(selectedCollectionId)
                            }
                          >
                            {collectionItemsLoading
                              ? "載入中..."
                              : "載入收藏庫"}
                          </Button>
                        </>
                      )}
                    </Stack>
                  )}
                  {collectionsError && (
                    <Alert severity="error" variant="outlined">
                      {collectionsError}
                    </Alert>
                  )}
                  {collectionItemsError && (
                    <Alert severity="error" variant="outlined">
                      {collectionItemsError}
                    </Alert>
                  )}
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" className="room-create-muted">
                  播放清單已鎖定
                </Typography>
                <Typography variant="body2" className="room-create-muted">
                  如需重選，請按「重選來源」並重新貼上網址。
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  className="room-create-accent-button"
                  onClick={() => {
                    onResetPlaylist();
                    setPlaylistSource("link");
                    setSelectedYoutubeId("");
                    onSelectCollection?.(null);
                  }}
                >
                  重選來源
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
          {playlistSourceLoading && <LinearProgress color="primary" />}
          {playlistError && (
            <Alert severity="error" variant="outlined">
              {playlistError}
            </Alert>
          )}
          {playlistItems.length > 0 && (
            <div className="space-y-1 text-xs">
              <Typography variant="subtitle2" className="room-create-muted">
                已載入 {playlistItems.length} 首歌曲
              </Typography>
              <div className="room-create-track">
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

          <Button
            fullWidth
            variant="contained"
            disabled={!canCreateRoom}
            onClick={onCreateRoom}
            className="room-create-primary"
          >
            建立房間
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomCreationSection;
