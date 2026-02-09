import React from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { RoomCreateSourceMode } from "../../model/RoomContext";
import type { PlaylistItem, RoomSummary } from "../../model/types";
import QuestionCountControls from "./QuestionCountControls";
import RoomAccessSettingsFields from "./RoomAccessSettingsFields";

interface RoomCreationSectionProps {
  roomName: string;
  roomVisibility: "public" | "private";
  sourceMode: RoomCreateSourceMode;
  roomPassword: string;
  roomMaxPlayers: string;
  playlistUrl: string;
  playlistItems: PlaylistItem[];
  playlistLoading: boolean;
  playlistError: string | null;
  playlistStage: "input" | "preview";
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
  collectionScope?: "owner" | "public" | null;
  selectedCollectionId?: string | null;
  collectionItemsLoading?: boolean;
  collectionItemsError?: string | null;
  isGoogleAuthed?: boolean;
  onGoogleLogin?: () => void;
  onRoomNameChange: (value: string) => void;
  onRoomVisibilityChange: (value: "public" | "private") => void;
  onSourceModeChange: (mode: RoomCreateSourceMode) => void;
  onRoomPasswordChange: (value: string) => void;
  onRoomMaxPlayersChange: (value: string) => void;
  onJoinPasswordChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylist: (options?: {
    url?: string;
    force?: boolean;
    lock?: boolean;
  }) => void | Promise<void>;
  onFetchYoutubePlaylists?: () => void;
  onImportYoutubePlaylist?: (playlistId: string) => void;
  onFetchCollections?: (scope?: "owner" | "public") => void;
  onSelectCollection?: (collectionId: string | null) => void;
  onLoadCollectionItems?: (
    collectionId: string,
    options?: { readToken?: string | null; force?: boolean },
  ) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string, hasPassword: boolean) => void;
  playerMin?: number;
  playerMax?: number;
}

const sourceModeOptions: Array<{
  mode: RoomCreateSourceMode;
  label: string;
  hint: string;
}> = [
  {
    mode: "link",
    label: "YouTube 連結",
    hint: "貼上播放清單網址，快速匯入",
  },
  {
    mode: "youtube",
    label: "我的播放清單",
    hint: "登入 Google 後直接選取",
  },
  {
    mode: "publicCollection",
    label: "公開收藏庫",
    hint: "從社群收藏快速套用",
  },
  {
    mode: "privateCollection",
    label: "私人收藏庫",
    hint: "使用自己的收藏內容",
  },
];

const sourceModeLabelMap: Record<RoomCreateSourceMode, string> = {
  link: "YouTube 連結",
  youtube: "我的播放清單",
  publicCollection: "公開收藏庫",
  privateCollection: "私人收藏庫",
};

const extractYoutubePlaylistId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`,
    );
    return parsed.searchParams.get("list")?.trim() ?? null;
  } catch {
    const match = trimmed.match(/[?&]list=([^&#]+)/);
    return match?.[1] ?? null;
  }
};

const RoomCreationSection: React.FC<RoomCreationSectionProps> = (props) => {
  const {
    roomName,
    roomVisibility,
    sourceMode,
    roomPassword,
    roomMaxPlayers,
    playlistUrl,
    playlistItems,
    playlistLoading,
    playlistError,
    playlistStage,
    username,
    playlistProgress,
    questionCount,
    onQuestionCountChange,
    questionMin = 1,
    questionMax = 100,
    questionStep = 5,
    questionControlsEnabled = true,
    questionLimitLabel,
    youtubePlaylists = [],
    youtubePlaylistsLoading = false,
    youtubePlaylistsError = null,
    collections = [],
    collectionsLoading = false,
    collectionsError = null,
    collectionScope = null,
    selectedCollectionId = null,
    collectionItemsLoading = false,
    collectionItemsError = null,
    isGoogleAuthed = false,
    onGoogleLogin,
    onRoomNameChange,
    onRoomVisibilityChange,
    onSourceModeChange,
    onRoomPasswordChange,
    onRoomMaxPlayersChange,
    onPlaylistUrlChange,
    onFetchPlaylist,
    onFetchYoutubePlaylists,
    onImportYoutubePlaylist,
    onFetchCollections,
    onSelectCollection,
    onLoadCollectionItems,
    onCreateRoom,
    playerMin = 1,
    playerMax = 100,
  } = props;

  const [selectedYoutubeId, setSelectedYoutubeId] = React.useState("");

  const hasFetchedYoutubeRef = React.useRef(false);
  const [emptyCollectionScope, setEmptyCollectionScope] = React.useState<{
    public: boolean;
    owner: boolean;
  }>({
    public: false,
    owner: false,
  });
  const lastAutoLoadedCollectionRef = React.useRef<string | null>(null);
  const confirmActionRef = React.useRef<null | (() => void)>(null);
  const [confirmModal, setConfirmModal] = React.useState<{
    title: string;
    detail?: string;
  } | null>(null);

  const normalizedMaxPlayersInput = roomMaxPlayers.trim();
  const parsedMaxPlayers = normalizedMaxPlayersInput
    ? Number(normalizedMaxPlayersInput)
    : null;
  const maxPlayersInvalid =
    parsedMaxPlayers !== null &&
    (!Number.isInteger(parsedMaxPlayers) ||
      parsedMaxPlayers < playerMin ||
      parsedMaxPlayers > playerMax);

  const canCreateRoom = Boolean(
    username &&
      roomName.trim() &&
      playlistItems.length > 0 &&
      !maxPlayersInvalid,
  );

  const previewItems = React.useMemo(() => playlistItems.slice(0, 80), [playlistItems]);
  const stageLabel = playlistStage === "preview" ? "預覽中" : "設定中";
  const sourceModeLabel = sourceModeLabelMap[sourceMode];
  const createHelperText = React.useMemo(() => {
    if (!roomName.trim()) return "請先填寫房間名稱。";
    if (maxPlayersInvalid) {
      return `人數限制需介於 ${playerMin} 到 ${playerMax} 人。`;
    }
    if (playlistItems.length === 0) return "請先載入至少一首歌曲。";
    if (playlistLoading) return "歌曲仍在載入，完成後即可建立。";
    return "設定已完成，可以建立房間。";
  }, [
    maxPlayersInvalid,
    playerMax,
    playerMin,
    playlistItems.length,
    playlistLoading,
    roomName,
  ]);

  const sourceStatusClass = React.useCallback(
    (tone: "info" | "success" | "error") => {
      if (tone === "error") return "text-rose-300";
      if (tone === "success") return "text-emerald-300";
      return "room-create-muted";
    },
    [],
  );

  const targetCollectionScope =
    sourceMode === "privateCollection"
      ? "owner"
      : sourceMode === "publicCollection"
        ? "public"
        : null;
  const hasCollectionScopeMatch =
    targetCollectionScope !== null && collectionScope === targetCollectionScope;
  const collectionOptions = React.useMemo(
    () => (hasCollectionScopeMatch ? collections : []),
    [collections, hasCollectionScopeMatch],
  );

  const youtubeStatus = React.useMemo(() => {
    if (sourceMode !== "youtube") return null;
    if (!isGoogleAuthed) {
      return { tone: "info" as const, text: "需要先登入 Google 才能使用我的播放清單。" };
    }
    if (youtubePlaylistsLoading) {
      return { tone: "info" as const, text: "正在讀取你的 YouTube 播放清單..." };
    }
    if (youtubePlaylistsError) {
      return { tone: "error" as const, text: youtubePlaylistsError };
    }
    if (youtubePlaylists.length === 0) {
      return { tone: "info" as const, text: "尚未找到播放清單，請先在 YouTube 建立清單。" };
    }
    if (!selectedYoutubeId) {
      return { tone: "info" as const, text: "請先選擇播放清單。" };
    }
    return { tone: "success" as const, text: "已選擇播放清單，會自動載入歌曲。" };
  }, [
    isGoogleAuthed,
    selectedYoutubeId,
    sourceMode,
    youtubePlaylists.length,
    youtubePlaylistsError,
    youtubePlaylistsLoading,
  ]);

  const collectionStatus = React.useMemo(() => {
    const isCollectionMode =
      sourceMode === "publicCollection" || sourceMode === "privateCollection";
    if (!isCollectionMode) return null;
    const scopeLabel = sourceMode === "privateCollection" ? "私人" : "公開";
    const isEmptyCollectionError =
      collectionsError === "尚未建立收藏庫" || collectionsError === "尚未建立公開收藏庫";
    const scopeKnownEmpty =
      sourceMode === "privateCollection"
        ? emptyCollectionScope.owner
        : emptyCollectionScope.public;
    if (sourceMode === "privateCollection" && !isGoogleAuthed) {
      return { tone: "info" as const, text: "需要先登入 Google 才能使用私人收藏庫。" };
    }
    if (collectionsLoading) {
      return { tone: "info" as const, text: `正在讀取${scopeLabel}收藏庫...` };
    }
    if (!hasCollectionScopeMatch) {
      if (scopeKnownEmpty) {
        return {
          tone: "error" as const,
          text: `目前沒有${scopeLabel}收藏庫，請先建立內容後再回來選擇。`,
        };
      }
      return { tone: "info" as const, text: `正在同步${scopeLabel}收藏庫...` };
    }
    if (collectionItemsLoading && selectedCollectionId) {
      return { tone: "info" as const, text: "正在載入收藏庫歌曲..." };
    }
    if (collectionItemsError) {
      return { tone: "error" as const, text: collectionItemsError };
    }
    if (collectionsError && !isEmptyCollectionError) {
      return { tone: "error" as const, text: collectionsError };
    }
    if (collectionOptions.length === 0 || isEmptyCollectionError || scopeKnownEmpty) {
      return {
        tone: "error" as const,
        text: `目前沒有${scopeLabel}收藏庫，請先建立內容後再回來選擇。`,
      };
    }
    if (!selectedCollectionId) {
      return { tone: "info" as const, text: `請先選擇${scopeLabel}收藏庫。` };
    }
    return { tone: "success" as const, text: "已選擇收藏庫，會自動載入歌曲。" };
  }, [
    collectionOptions.length,
    collectionItemsError,
    collectionItemsLoading,
    collectionsError,
    collectionsLoading,
    emptyCollectionScope.owner,
    emptyCollectionScope.public,
    hasCollectionScopeMatch,
    isGoogleAuthed,
    selectedCollectionId,
    sourceMode,
  ]);

  const linkStatus = React.useMemo(() => {
    if (sourceMode !== "link") return null;
    if (playlistLoading) {
      return { tone: "info" as const, text: "正在匯入播放清單，請稍候..." };
    }
    if (playlistError) {
      return { tone: "error" as const, text: playlistError };
    }
    if (playlistItems.length > 0) {
      return {
        tone: "success" as const,
        text: `已完成匯入，共 ${playlistItems.length} 首歌曲。`,
      };
    }
    return { tone: "info" as const, text: "貼上播放清單網址後會自動匯入。" };
  }, [playlistError, playlistItems.length, playlistLoading, sourceMode]);

  React.useEffect(() => {
    if (sourceMode !== "youtube") return;
    if (!isGoogleAuthed || !onFetchYoutubePlaylists) return;
    if (hasFetchedYoutubeRef.current) return;
    hasFetchedYoutubeRef.current = true;
    void onFetchYoutubePlaylists();
  }, [isGoogleAuthed, onFetchYoutubePlaylists, sourceMode]);

  React.useEffect(() => {
    if (collectionScope === "public") {
      if (collections.length > 0) {
        setEmptyCollectionScope((prev) =>
          prev.public ? { ...prev, public: false } : prev,
        );
        return;
      }
      const nextEmpty = collectionsError === "尚未建立公開收藏庫";
      setEmptyCollectionScope((prev) =>
        prev.public === nextEmpty ? prev : { ...prev, public: nextEmpty },
      );
    }
    if (collectionScope === "owner") {
      if (collections.length > 0) {
        setEmptyCollectionScope((prev) =>
          prev.owner ? { ...prev, owner: false } : prev,
        );
        return;
      }
      const nextEmpty = collectionsError === "尚未建立收藏庫";
      setEmptyCollectionScope((prev) =>
        prev.owner === nextEmpty ? prev : { ...prev, owner: nextEmpty },
      );
    }
  }, [collectionScope, collections.length, collectionsError]);

  React.useEffect(() => {
    if (!onFetchCollections || collectionsLoading) return;
    if (sourceMode === "publicCollection") {
      if (emptyCollectionScope.public) return;
      if (collectionScope === "public" && collections.length > 0) return;
      void onFetchCollections("public");
      return;
    }
    if (sourceMode === "privateCollection") {
      if (!isGoogleAuthed) return;
      if (emptyCollectionScope.owner) return;
      if (collectionScope === "owner" && collections.length > 0) return;
      void onFetchCollections("owner");
    }
  }, [
    collectionScope,
    collections.length,
    collectionsLoading,
    emptyCollectionScope.owner,
    emptyCollectionScope.public,
    isGoogleAuthed,
    onFetchCollections,
    sourceMode,
  ]);

  React.useEffect(() => {
    const isCollectionMode =
      sourceMode === "publicCollection" || sourceMode === "privateCollection";
    if (!isCollectionMode) return;
    if (!selectedCollectionId || !onLoadCollectionItems) return;
    if (lastAutoLoadedCollectionRef.current === selectedCollectionId) return;
    lastAutoLoadedCollectionRef.current = selectedCollectionId;
    void onLoadCollectionItems(selectedCollectionId);
  }, [onLoadCollectionItems, selectedCollectionId, sourceMode]);

  const openConfirmModal = React.useCallback(
    (title: string, detail: string, action: () => void) => {
      confirmActionRef.current = action;
      setConfirmModal({ title, detail });
    },
    [],
  );

  const closeConfirmModal = React.useCallback(() => {
    setConfirmModal(null);
    confirmActionRef.current = null;
  }, []);

  const handleConfirmSwitch = React.useCallback(() => {
    const action = confirmActionRef.current;
    closeConfirmModal();
    action?.();
  }, [closeConfirmModal]);

  const confirmBeforeReplace = React.useCallback(
    (targetLabel: string, action: () => void, title = "切換播放來源？") => {
      if (playlistItems.length === 0) {
        action();
        return;
      }
      openConfirmModal(
        title,
        `目前已載入 ${playlistItems.length} 首歌曲，確定要切換成「${targetLabel}」嗎？`,
        action,
      );
    },
    [openConfirmModal, playlistItems.length],
  );

  const handleSourceModeChange = (nextMode: RoomCreateSourceMode) => {
    if (nextMode === sourceMode) return;
    if (nextMode === "publicCollection" || nextMode === "privateCollection") {
      onSelectCollection?.(null);
      lastAutoLoadedCollectionRef.current = null;
    }
    if (nextMode !== "youtube") {
      setSelectedYoutubeId("");
    }
    onSourceModeChange(nextMode);
  };

  const handleFetchPlaylistByLink = React.useCallback(
    async (targetUrl?: string) => {
      const nextUrl = (targetUrl ?? playlistUrl).trim();
      if (!nextUrl) return;
      await Promise.resolve(
        onFetchPlaylist({
          url: nextUrl,
          force: true,
          lock: false,
        }),
      );
    },
    [onFetchPlaylist, playlistUrl],
  );

  const handlePlaylistPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").trim();
    if (!pasted) return;
    if (!extractYoutubePlaylistId(pasted)) return;
    event.preventDefault();
    onPlaylistUrlChange(pasted);
    confirmBeforeReplace(
      "YouTube 連結",
      () => {
        void handleFetchPlaylistByLink(pasted);
      },
      "切換到新的播放清單？",
    );
  };

  const handleYoutubeSelectionChange = (playlistId: string) => {
    const nextPlaylistId = playlistId || "";
    if (!nextPlaylistId) {
      setSelectedYoutubeId("");
      return;
    }
    if (nextPlaylistId === selectedYoutubeId) return;
    const targetTitle =
      youtubePlaylists.find((item) => item.id === nextPlaylistId)?.title ??
      "我的播放清單";
    confirmBeforeReplace(
      targetTitle,
      () => {
        setSelectedYoutubeId(nextPlaylistId);
        if (!onImportYoutubePlaylist) return;
        void onImportYoutubePlaylist(nextPlaylistId);
      },
      "切換到播放清單？",
    );
  };

  const handleCollectionSelectionChange = (collectionId: string) => {
    const nextCollectionId = collectionId || null;
    if (nextCollectionId === selectedCollectionId) return;
    const targetTitle =
      collectionOptions.find((item) => item.id === nextCollectionId)?.title ??
      "收藏庫";
    const applySelection = () => {
      onSelectCollection?.(nextCollectionId);
      if (!nextCollectionId || !onLoadCollectionItems) {
        lastAutoLoadedCollectionRef.current = null;
        return;
      }
      lastAutoLoadedCollectionRef.current = nextCollectionId;
      void onLoadCollectionItems(nextCollectionId);
    };
    if (!nextCollectionId) {
      applySelection();
      return;
    }
    confirmBeforeReplace(targetTitle, applySelection, "切換到收藏庫？");
  };

  const isSourceImporting = playlistLoading || collectionItemsLoading;
  const importStatusText = React.useMemo(() => {
    if (sourceMode === "link") return "正在匯入 YouTube 播放清單...";
    if (sourceMode === "youtube") return "正在載入你的播放清單歌曲...";
    if (sourceMode === "publicCollection" || sourceMode === "privateCollection") {
      return "正在套用收藏庫歌曲...";
    }
    return "正在載入歌曲...";
  }, [sourceMode]);
  const previewAnimationKey = `${sourceMode}-${selectedCollectionId ?? "none"}-${selectedYoutubeId}-${playlistItems.length}`;

  return (
    <Stack spacing={2.5}>
      <div className="room-create-setup-strip">
        <span className="room-create-setup-strip-label">來源模式</span>
        <span className="room-create-setup-strip-value">{sourceModeLabel}</span>
        <span className="room-create-setup-strip-dot" aria-hidden="true" />
        <span className="room-create-setup-strip-label">狀態</span>
        <span className="room-create-setup-strip-value">{stageLabel}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="room-create-step-card">
          <div className="room-create-step-head">
            <div>
              <span className="room-create-step-index">STEP 01</span>
              <Typography variant="h5" className="room-create-step-title">
                基本設定
              </Typography>
              <Typography variant="body2" className="room-create-muted">
                設定房間名稱、權限、題數與可加入人數。
              </Typography>
            </div>
            <Chip
              size="small"
              className="room-create-visibility-chip"
              label={roomVisibility === "private" ? "私人" : "公開"}
            />
          </div>

          <TextField
            size="small"
            label="房間名稱"
            value={roomName}
            onChange={(event) => onRoomNameChange(event.target.value)}
            placeholder="例如：阿哲的 room"
            fullWidth
            className="room-create-field"
          />

          <RoomAccessSettingsFields
            visibility={roomVisibility}
            password={roomPassword}
            onVisibilityChange={onRoomVisibilityChange}
            onPasswordChange={onRoomPasswordChange}
            onPasswordClear={() => onRoomPasswordChange("")}
            allowPasswordWhenPublic
            showClearButton={Boolean(roomPassword)}
            classes={{
              root: "room-create-access-block",
              visibilityRow: "room-create-visibility-switch",
              visibilityButton: "room-create-visibility-button",
              helperText: "room-create-muted",
              passwordField: "room-create-field",
              noteText: "room-create-muted",
            }}
          />

          <TextField
            size="small"
            type="number"
            label="人數限制（選填）"
            value={roomMaxPlayers}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (!/^\d*$/.test(nextValue)) return;
              onRoomMaxPlayersChange(nextValue);
            }}
            placeholder="留空代表不限制"
            fullWidth
            className="room-create-field"
            error={maxPlayersInvalid}
            helperText={
              maxPlayersInvalid
                ? `請輸入 ${playerMin}-${playerMax} 的整數`
                : `可留空；若設定，允許 ${playerMin}-${playerMax} 人`
            }
            slotProps={{
              htmlInput: {
                min: playerMin,
                max: playerMax,
                inputMode: "numeric",
              },
            }}
          />

          <div className="room-create-question-card">
            <div className="room-create-question-head">
              <Typography variant="subtitle1" className="room-create-step-title">
                題數設定
              </Typography>
              <span className="room-create-question-badge">目前 {questionCount} 題</span>
            </div>
            <QuestionCountControls
              value={questionCount}
              min={questionMin}
              max={questionMax}
              step={questionStep}
              disabled={!questionControlsEnabled}
              compact
              onChange={onQuestionCountChange}
            />
            {questionLimitLabel && (
              <Typography variant="caption" className="room-create-muted">
                {questionLimitLabel}
              </Typography>
            )}
          </div>
        </div>

        <div className="room-create-step-card">
          <div className="room-create-step-head">
            <div>
              <span className="room-create-step-index">STEP 02</span>
              <Typography variant="h5" className="room-create-step-title">
                播放清單
              </Typography>
              <Typography variant="body2" className="room-create-muted">
                先選來源，再於下方確認清單預覽，避免操作被分散。
              </Typography>
            </div>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="outlined"
                label={stageLabel}
                sx={{
                  borderColor: "rgba(148, 163, 184, 0.28)",
                  color: "var(--mc-text-muted)",
                  background: "rgba(2, 6, 23, 0.35)",
                }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`來源：${sourceModeLabel}`}
                sx={{
                  borderColor: "rgba(148, 163, 184, 0.28)",
                  color: "var(--mc-text-muted)",
                  background: "rgba(2, 6, 23, 0.35)",
                }}
              />
            </Stack>
          </div>

          <div className="room-create-source-grid">
            {sourceModeOptions.map((option) => {
              const isActive = sourceMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  className={`room-create-source-pill${isActive ? " is-active" : ""}`}
                  onClick={() => handleSourceModeChange(option.mode)}
                >
                  <span className="label">{option.label}</span>
                  <span className="hint">{option.hint}</span>
                </button>
              );
            })}
          </div>

          <Stack spacing={1.25} className="room-create-playlist-panel room-create-playlist-panel-controls">
            {sourceMode === "link" && (
              <Stack spacing={1.25}>
                <TextField
                  size="small"
                  fullWidth
                  label="YouTube 播放清單網址"
                  value={playlistUrl}
                  onChange={(event) => onPlaylistUrlChange(event.target.value)}
                  onPaste={handlePlaylistPaste}
                  placeholder="https://www.youtube.com/playlist?list=..."
                  className="room-create-field"
                />
                {linkStatus && (
                  <Typography
                    variant="caption"
                    className={sourceStatusClass(linkStatus.tone)}
                  >
                    {linkStatus.text}
                  </Typography>
                )}
              </Stack>
            )}

            {sourceMode === "youtube" && (
              <Stack spacing={1.25}>
                {!isGoogleAuthed ? (
                  <>
                    <Button variant="outlined" onClick={onGoogleLogin} fullWidth>
                      登入 Google
                    </Button>
                    {youtubeStatus && (
                      <Typography
                        variant="caption"
                        className={sourceStatusClass(youtubeStatus.tone)}
                      >
                        {youtubeStatus.text}
                      </Typography>
                    )}
                  </>
                ) : (
                  <>
                    <FormControl size="small" fullWidth className="room-create-field">
                      <InputLabel id="room-create-youtube-playlist">選擇清單</InputLabel>
                      <Select
                        labelId="room-create-youtube-playlist"
                        label="選擇清單"
                        value={selectedYoutubeId}
                        onChange={(event) =>
                          handleYoutubeSelectionChange(String(event.target.value))
                        }
                      >
                        <MenuItem value="">請選擇清單</MenuItem>
                        {youtubePlaylists.map((playlist) => (
                          <MenuItem key={playlist.id} value={playlist.id}>
                            {playlist.title}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {youtubePlaylistsLoading && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} />
                      </Stack>
                    )}
                    {youtubeStatus && (
                      <Typography
                        variant="caption"
                        className={sourceStatusClass(youtubeStatus.tone)}
                      >
                        {youtubeStatus.text}
                      </Typography>
                    )}
                  </>
                )}
              </Stack>
            )}

            {(sourceMode === "publicCollection" || sourceMode === "privateCollection") && (
              <Stack spacing={1.25}>
                {sourceMode === "privateCollection" && !isGoogleAuthed ? (
                  <Button variant="outlined" onClick={onGoogleLogin} fullWidth>
                    登入 Google
                  </Button>
                ) : (
                  <>
                    <FormControl size="small" fullWidth className="room-create-field">
                      <InputLabel id="room-create-collection-select">選擇收藏庫</InputLabel>
                      <Select
                        labelId="room-create-collection-select"
                        label="選擇收藏庫"
                        value={hasCollectionScopeMatch ? selectedCollectionId ?? "" : ""}
                        onChange={(event) =>
                          handleCollectionSelectionChange(String(event.target.value))
                        }
                      >
                        <MenuItem value="">請選擇收藏庫</MenuItem>
                        {collectionOptions.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.title}
                            {item.visibility === "private" ? "（私人）" : "（公開）"}
                          </MenuItem>
                          ))}
                        </Select>
                    </FormControl>
                    {collectionStatus && (
                      <Typography
                        variant="caption"
                        className={sourceStatusClass(collectionStatus.tone)}
                      >
                        {collectionStatus.text}
                      </Typography>
                    )}
                    {(collectionsLoading || collectionItemsLoading) && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} />
                        <Typography variant="caption" className="room-create-muted">
                          {collectionsLoading ? "正在同步收藏庫..." : "正在載入收藏庫歌曲..."}
                        </Typography>
                      </Stack>
                    )}
                  </>
                )}
                {sourceMode === "privateCollection" && !isGoogleAuthed && collectionStatus && (
                  <Typography
                    variant="caption"
                    className={sourceStatusClass(collectionStatus.tone)}
                  >
                    {collectionStatus.text}
                  </Typography>
                )}
              </Stack>
            )}

            {isSourceImporting && (
              <Stack spacing={0.75}>
                <LinearProgress
                  variant={
                    playlistLoading && playlistProgress.total > 0
                      ? "determinate"
                      : "indeterminate"
                  }
                  value={
                    playlistLoading && playlistProgress.total > 0
                      ? Math.min(
                          100,
                          Math.round((playlistProgress.received / playlistProgress.total) * 100),
                        )
                      : undefined
                  }
                />
                <Typography variant="caption" className="room-create-muted">
                  {playlistLoading && playlistProgress.total > 0
                    ? `已接收 ${playlistProgress.received} / ${playlistProgress.total}`
                    : importStatusText}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Stack spacing={1} className="room-create-playlist-panel room-create-playlist-panel-preview">
            <div className="room-create-preview-headline">
              <Typography variant="subtitle1" className="room-create-step-title">
                歌曲預覽
              </Typography>
              <span className="room-create-question-badge">共 {playlistItems.length} 首</span>
            </div>
            <div className={`room-create-preview-stage${isSourceImporting ? " is-loading" : ""}`}>
              {playlistItems.length === 0 ? (
                <div className="room-create-preview-empty">尚未載入歌曲</div>
              ) : (
                <>
                  <div
                    key={previewAnimationKey}
                    className="room-create-preview-list room-create-preview-list--animated"
                  >
                    {previewItems.map((item, index) => (
                      <div key={`${item.url}-${index}`} className="room-create-preview-item">
                        <img
                          src={item.thumbnail || "https://via.placeholder.com/96x54?text=Music"}
                          alt={item.title}
                          className="room-create-preview-thumb"
                          loading="lazy"
                        />
                        <div className="room-create-preview-text">
                          <div className="title">{item.title}</div>
                          <div className="meta">
                            {item.uploader || "未知上傳者"}
                            {item.duration ? ` · ${item.duration}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {playlistItems.length > previewItems.length && (
                    <Typography variant="caption" className="room-create-muted">
                      已顯示前 {previewItems.length} 首，完整清單可在房間內查看。
                    </Typography>
                  )}
                </>
              )}

              {isSourceImporting && (
                <div className="room-create-preview-loading-mask" role="status" aria-live="polite">
                  <div className="room-create-preview-loading-content">
                    <CircularProgress size={16} />
                    <span>{importStatusText}</span>
                  </div>
                </div>
              )}
            </div>
          </Stack>
        </div>
      </div>

      <div className="room-create-submit-wrap">
        <Button
          variant="contained"
          size="large"
          onClick={onCreateRoom}
          disabled={!canCreateRoom || isSourceImporting}
          className="room-create-submit"
        >
          建立房間
        </Button>
        <Typography variant="caption" className="room-create-muted">
          {createHelperText}
        </Typography>
      </div>

      <Dialog open={Boolean(confirmModal)} onClose={closeConfirmModal}>
        <DialogTitle>{confirmModal?.title ?? "切換播放來源"}</DialogTitle>
        <DialogContent>
          {confirmModal?.detail && (
            <Typography variant="body2" className="room-create-muted">
              {confirmModal.detail}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmModal}>取消</Button>
          <Button variant="contained" onClick={handleConfirmSwitch}>
            確認切換
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default RoomCreationSection;


