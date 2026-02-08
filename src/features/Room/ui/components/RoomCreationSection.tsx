import React from "react";
import {
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
import type { PlaylistItem, RoomSummary } from "../../model/types";
import QuestionCountControls from "./QuestionCountControls";

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
    visibility?: "private" | "public";
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
  onFetchCollections?: (scope?: "owner" | "public") => void;
  onSelectCollection?: (collectionId: string | null) => void;
  onLoadCollectionItems?: (
    collectionId: string,
    options?: { readToken?: string | null },
  ) => void;
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
  const [collectionScope, setCollectionScope] = React.useState<
    "public" | "owner"
  >("public");
  const lastRequestedCollectionScopeRef = React.useRef<
    "public" | "owner" | null
  >(null);
  const lastFetchedCollectionScopeRef = React.useRef<
    "public" | "owner" | null
  >(null);
  const lastRequestedYoutubeRef = React.useRef(false);
  const hasAttemptedYoutubeFetchRef = React.useRef(false);
  const [hasAttemptedYoutubeFetch, setHasAttemptedYoutubeFetch] = React.useState(false);
  const [loadedCollectionScopes, setLoadedCollectionScopes] = React.useState<{
    public: boolean;
    owner: boolean;
  }>({ public: false, owner: false });
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
  const sourceHintText = React.useMemo(() => {
    if (playlistSource === "link") {
      return "貼上 YouTube 播放清單網址後按「載入清單」。";
    }
    if (playlistSource === "mine") {
      return isGoogleAuthed
        ? "從你的 YouTube 播放清單中選擇並匯入。"
        : "請先使用 Google 登入以讀取播放清單。";
    }
    if (collectionScope === "public") {
      return "你目前在公開收藏庫，可直接選擇並載入。";
    }
    return isGoogleAuthed
      ? "你目前在私人收藏庫，可直接選擇並載入。"
      : "私人收藏庫需要 Google 登入後才能使用。";
  }, [collectionScope, isGoogleAuthed, playlistSource]);
  const showPlaylistInput = playlistStage === "input";
  const privacyLabel = roomPassword.trim() ? "需密碼" : "公開";
  const playlistSourceLoading = playlistLoading || collectionItemsLoading;
  const isCollectionsEmptyNotice =
    collectionsError === "尚未建立收藏庫" ||
    collectionsError === "尚未建立公開收藏庫";
  const sourceStatus = React.useMemo(() => {
    if (playlistSource === "link") {
      if (playlistLoading) {
        return { message: "正在載入播放清單...", tone: "info" as const };
      }
      if (playlistError) {
        return { message: playlistError, tone: "error" as const };
      }
      return { message: sourceHintText, tone: "muted" as const };
    }

    if (playlistSource === "mine") {
      if (!isGoogleAuthed) {
        return {
          message: "請先使用 Google 登入，再讀取我的播放清單。",
          tone: "info" as const,
        };
      }
      if (youtubePlaylistsLoading) {
        return { message: "正在讀取你的播放清單...", tone: "info" as const };
      }
      if (needsReauth) {
        return {
          message: youtubePlaylistsError ?? "Google 授權已過期，請重新授權。",
          tone: "error" as const,
        };
      }
      if (channelMissing) {
        return {
          message: youtubePlaylistsError ?? "尚未建立 YouTube 頻道或播放清單。",
          tone: "info" as const,
        };
      }
      if (youtubePlaylistsError) {
        return { message: youtubePlaylistsError, tone: "error" as const };
      }
      if (youtubePlaylists.length === 0 && hasAttemptedYoutubeFetch) {
        return { message: "目前沒有可匯入的播放清單。", tone: "info" as const };
      }
      return { message: sourceHintText, tone: "muted" as const };
    }

    if (collectionScope === "owner" && !isGoogleAuthed) {
      return {
        message: "私人收藏庫需要先使用 Google 登入。",
        tone: "info" as const,
      };
    }
    if (collectionsLoading) {
      return { message: "正在更新收藏庫列表...", tone: "info" as const };
    }
    if (collectionItemsLoading) {
      return { message: "正在載入收藏庫歌曲...", tone: "info" as const };
    }
    if (collectionItemsError) {
      return { message: collectionItemsError, tone: "error" as const };
    }
    if (collectionsError) {
      return {
        message: collectionsError,
        tone: isCollectionsEmptyNotice ? ("info" as const) : ("error" as const),
      };
    }
    if (collections.length === 0 && loadedCollectionScopes[collectionScope]) {
      return { message: "目前沒有可用收藏庫。", tone: "info" as const };
    }
    return { message: sourceHintText, tone: "muted" as const };
  }, [
    channelMissing,
    collectionItemsError,
    collectionItemsLoading,
    collectionScope,
    collections.length,
    collectionsError,
    collectionsLoading,
    isCollectionsEmptyNotice,
    isGoogleAuthed,
    hasAttemptedYoutubeFetch,
    loadedCollectionScopes,
    needsReauth,
    playlistError,
    playlistLoading,
    playlistSource,
    sourceHintText,
    youtubePlaylists.length,
    youtubePlaylistsError,
    youtubePlaylistsLoading,
  ]);

  React.useEffect(() => {
    if (collectionsLoading) return;
    const requested = lastRequestedCollectionScopeRef.current;
    if (!requested) return;
    if (!collectionsError || isCollectionsEmptyNotice) {
      lastFetchedCollectionScopeRef.current = requested;
      setLoadedCollectionScopes((prev) => {
        if (requested === "public" && prev.public) return prev;
        if (requested === "owner" && prev.owner) return prev;
        return { ...prev, [requested]: true };
      });
    }
  }, [collectionsError, collectionsLoading, isCollectionsEmptyNotice]);

  const shouldFetchCollections = React.useCallback(
    (scope: "public" | "owner") => {
      if (collectionsLoading) return false;
      if (collectionsError && !isCollectionsEmptyNotice) return true;
      if (lastFetchedCollectionScopeRef.current !== scope) return true;
      return false;
    },
    [collectionsError, collectionsLoading, isCollectionsEmptyNotice],
  );

  const requestCollections = React.useCallback(
    (scope: "public" | "owner") => {
      if (!onFetchCollections) return;
      if (!shouldFetchCollections(scope)) return;
      lastRequestedCollectionScopeRef.current = scope;
      onFetchCollections(scope);
    },
    [onFetchCollections, shouldFetchCollections],
  );

  React.useEffect(() => {
    if (youtubePlaylistsLoading) return;
    if (!lastRequestedYoutubeRef.current) return;
    hasAttemptedYoutubeFetchRef.current = true;
    setHasAttemptedYoutubeFetch(true);
  }, [youtubePlaylistsLoading]);

  const shouldFetchYoutube = React.useCallback(() => {
    if (!isGoogleAuthed || youtubePlaylistsLoading) return false;
    return !hasAttemptedYoutubeFetchRef.current;
  }, [isGoogleAuthed, youtubePlaylistsLoading]);

  const requestYoutubePlaylists = React.useCallback((force = false) => {
    if (!onFetchYoutubePlaylists) return;
    if (!force && !shouldFetchYoutube()) return;
    lastRequestedYoutubeRef.current = true;
    hasAttemptedYoutubeFetchRef.current = true;
    setHasAttemptedYoutubeFetch(true);
    onFetchYoutubePlaylists();
  }, [onFetchYoutubePlaylists, shouldFetchYoutube]);

  React.useEffect(() => {
    if (playlistSource !== "mine") return;
    if (!isGoogleAuthed) return;
    requestYoutubePlaylists();
  }, [isGoogleAuthed, playlistSource, requestYoutubePlaylists]);

  React.useEffect(() => {
    if (playlistSource !== "collection") return;
    requestCollections(collectionScope);
  }, [collectionScope, playlistSource, requestCollections]);

  React.useEffect(() => {
    if (collectionScope !== "owner") return;
    if (isGoogleAuthed) return;
    setCollectionScope("public");
  }, [collectionScope, isGoogleAuthed]);

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
        <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--mc-border)]">
          <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-hidden">
            <Avatar
              variant="rounded"
              src={item.thumbnail}
              sx={{
                bgcolor: "rgba(15, 23, 42, 0.8)",
                width: 56,
                height: 56,
                fontSize: 14,
                color: "rgba(226, 232, 240, 0.8)",
              }}
            >
              {index + 1}
            </Avatar>
            <div className="flex-1 min-w-0">
              <Typography
                variant="body2"
                className="max-w-99/100 truncate room-create-muted"
              >
                <a
                  className="text-[var(--mc-text)] hover:text-[var(--mc-accent)] transition-colors duration-300"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
              </Typography>

              <p className="text-[11px] text-[var(--mc-text-muted)]">
                {item.uploader ?? "Unknown"}
                {item.duration ? ` · ${item.duration}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
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
              backgroundColor: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              transition:
                "background-color 200ms ease, border-color 200ms ease",
              "&::before": {
                display: "none",
              },
              "&.Mui-disabled": {
                opacity: 1,
                backgroundColor: "rgba(15, 23, 42, 0.4)",
              },
              "& .MuiButton-root": {
                transition: "color 200ms ease, border-color 200ms ease",
              },
            }}
          >
            <AccordionSummary
              sx={{
                "& .MuiSvgIcon-root": {
                  color: "rgba(148, 163, 184, 0.8)",
                },
                "&.Mui-disabled .MuiTypography-root": {
                  color: "rgba(148, 163, 184, 0.8)",
                  opacity: 1,
                  transition: "color 200ms ease, opacity 200ms ease",
                },
                "&.Mui-disabled .MuiSvgIcon-root": {
                  opacity: 1,
                },
                "&.Mui-disabled .MuiAccordionSummary-expandIconWrapper": {
                  color: "rgba(148, 163, 184, 0.6)",
                },
              }}
              expandIcon={
                !canAdjustQuestions ? (
                  <Fade in={!canAdjustQuestions} timeout={200} unmountOnExit>
                    <LockOutlinedIcon
                      fontSize="small"
                      sx={{
                        color: "rgba(148, 163, 184, 0.6)",
                      }}
                    />
                  </Fade>
                ) : (
                  <ExpandMoreIcon
                    sx={{
                      color: canAdjustQuestions
                        ? "rgba(226, 232, 240, 0.8)"
                        : "rgba(148, 163, 184, 0.5)",
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
              <QuestionCountControls
                value={questionCount}
                min={questionMin}
                max={questionMax}
                step={questionStep}
                disabled={!canAdjustQuestions}
                onChange={(nextValue) => {
                  onQuestionCountChange(nextValue);
                }}
              />
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
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                className="room-create-source-switch"
              >
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
                    playlistSource === "collection" &&
                      collectionScope === "public"
                      ? "contained"
                      : "outlined"
                  }
                  className="room-create-accent-button"
                  onClick={() => {
                    setPlaylistSource("collection");
                    setCollectionScope("public");
                    onSelectCollection?.(null);
                    setSelectedYoutubeId("");
                  }}
                >
                  {"公開收藏庫"}
                </Button>
                <Button
                  variant={
                    playlistSource === "collection" &&
                      collectionScope === "owner"
                      ? "contained"
                      : "outlined"
                  }
                  className="room-create-accent-button"
                  onClick={() => {
                    setPlaylistSource("collection");
                    setCollectionScope("owner");
                    onSelectCollection?.(null);
                    setSelectedYoutubeId("");
                  }}
                  disabled={!isGoogleAuthed}
                >
                  {"私人收藏庫"}
                </Button>
              </Stack>
              <div className="room-create-source-status" aria-live="polite">
                <Typography
                  variant="caption"
                  className={
                    sourceStatus.tone === "error"
                      ? "room-create-status-error"
                      : sourceStatus.tone === "info"
                        ? "room-create-status-info"
                        : "room-create-muted"
                  }
                >
                  {sourceStatus.message}
                </Typography>
              </div>

              <div className="room-create-source-content">
                {playlistSource === "link" && (
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      sx={{
                        flex: 1,
                        "& .MuiInput-root.Mui-disabled:before": {
                          borderBottom: "1px solid rgba(148, 163, 184, 0.4)",
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
                      className={`room-create-accent-button ${
                        playlistLoading ? "room-create-loading-button" : ""
                      }`}
                      disabled={
                        !username ||
                        !isPlaylistLink ||
                        playlistLoading ||
                        playlistLocked
                      }
                      onClick={onFetchPlaylist}
                    >
                      {playlistLoading ? (
                        <span className="room-create-loading-content">
                          <span aria-hidden="true" className="room-create-loading-eq">
                            <span />
                            <span />
                            <span />
                          </span>
                          <span className="room-create-loading-text">
                            載入歌單中
                          </span>
                        </span>
                      ) : (
                        "載入清單"
                      )}
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
                      <Stack spacing={1} className="room-create-mine-wrap">
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          className="room-create-mine-row"
                        >
                          <select
                            value={selectedYoutubeId}
                            onChange={(e) =>
                              setSelectedYoutubeId(e.target.value)
                            }
                            disabled={
                              youtubePlaylistsLoading ||
                              youtubePlaylists.length === 0
                            }
                            className="room-create-mine-select flex-1 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] px-3 py-2 text-sm text-[var(--mc-text)]"
                          >
                            <option value="">
                              {youtubePlaylistsLoading
                                ? "播放清單載入中..."
                                : "請選擇播放清單"}
                            </option>
                            {youtubePlaylists.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} · {item.itemCount}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="contained"
                            color="secondary"
                            className="room-create-accent-button room-create-mine-import-button"
                            disabled={!selectedYoutubeId || youtubePlaylistsLoading}
                            onClick={() =>
                              selectedYoutubeId &&
                              onImportYoutubePlaylist?.(selectedYoutubeId)
                            }
                          >
                            {"匯入"}
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                    {(channelMissing || (needsReauth && onGoogleLogin)) && (
                      <div className="room-create-mine-actions">
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
                      </div>
                    )}
                  </Stack>
                )}
                {playlistSource === "collection" && (
                  <Stack spacing={1.5}>
                    {collectionScope === "owner" && !isGoogleAuthed && (
                      <Button
                        variant="outlined"
                        onClick={onGoogleLogin}
                        disabled={!onGoogleLogin}
                      >
                        {"使用 Google 登入"}
                      </Button>
                    )}

                    <Stack spacing={1} className="room-create-collection-wrap">
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        className="room-create-collection-row"
                      >
                        <select
                          value={selectedCollectionId ?? ""}
                          onChange={(e) =>
                            onSelectCollection?.(
                              e.target.value ? e.target.value : null,
                            )
                          }
                          disabled={collectionsLoading || collections.length === 0}
                          className="room-create-collection-select flex-1 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface-strong)] px-3 py-2 text-sm text-[var(--mc-text)]"
                        >
                          <option value="">
                            {collectionsLoading
                              ? "收藏庫載入中..."
                              : "請選擇收藏庫"}
                          </option>
                          {collections.map((item) => (
                            <option key={item.id} value={item.id}>
                              {`${item.title} · ${
                                item.visibility === "public" ? "公開" : "私人"
                              }`}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="contained"
                          color="secondary"
                          className={`room-create-accent-button room-create-collection-load-button ${
                            collectionItemsLoading ? "room-create-loading-button" : ""
                          }`}
                          disabled={
                            collectionsLoading ||
                            !selectedCollectionId ||
                            collectionItemsLoading
                          }
                          onClick={() =>
                            selectedCollectionId &&
                            onLoadCollectionItems?.(selectedCollectionId)
                          }
                        >
                          {collectionItemsLoading ? (
                            <span className="room-create-loading-content">
                              <span aria-hidden="true" className="room-create-loading-eq">
                                <span />
                                <span />
                                <span />
                              </span>
                              <span className="room-create-loading-text">
                                載入中
                              </span>
                            </span>
                          ) : (
                            "載入收藏庫"
                          )}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                )}
              </div>
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
          <div className="room-create-progress-slot" aria-live="polite">
            <LinearProgress
              color="primary"
              className={playlistSourceLoading ? "opacity-100" : "opacity-0"}
            />
          </div>
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
