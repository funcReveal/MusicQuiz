import React, { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List as MUIList,
  ListItem,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { List as VirtualList, type RowComponentProps } from "react-window";
import type {
  ChatMessage,
  GameState,
  PlaylistItem,
  PlaylistSuggestion,
  RoomParticipant,
  RoomState,
} from "../../model/types";
import type { YoutubePlaylist } from "../../model/RoomContext";
import { clampQuestionCount, getQuestionMax } from "../../model/roomUtils";
import {
  PLAYER_MAX,
  PLAYER_MIN,
  QUESTION_MIN,
  QUESTION_STEP,
} from "../../model/roomConstants";
import QuestionCountControls from "./QuestionCountControls";
import RoomAccessSettingsFields from "./RoomAccessSettingsFields";

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString();
};

type CollectionOption = {
  id: string;
  title: string;
  description?: string | null;
  visibility?: "private" | "public";
};

interface SuggestionPanelProps {
  collectionScope: "public" | "owner";
  onCollectionScopeChange: (scope: "public" | "owner") => void;
  collections: CollectionOption[];
  collectionsLoading: boolean;
  isGoogleAuthed: boolean;
  youtubePlaylists: YoutubePlaylist[];
  youtubePlaylistsLoading: boolean;
  youtubePlaylistsError: string | null;
  requestCollections: (scope: "public" | "owner") => void;
  requestYoutubePlaylists: (force?: boolean) => void;
  onSuggestPlaylist: (
    type: "collection" | "playlist",
    value: string,
    options?: { useSnapshot?: boolean; sourceId?: string | null; title?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
  extractPlaylistId: (url: string) => string | null;
  resolveVisibilityLabel: (visibility?: string) => string;
}

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  collectionScope,
  onCollectionScopeChange,
  collections,
  collectionsLoading,
  isGoogleAuthed,
  youtubePlaylists,
  youtubePlaylistsLoading,
  youtubePlaylistsError,
  requestCollections,
  requestYoutubePlaylists,
  onSuggestPlaylist,
  extractPlaylistId,
  resolveVisibilityLabel,
}) => {
  const [suggestType, setSuggestType] = useState<
    "playlist" | "collection" | "youtube"
  >("playlist");
  const [suggestPlaylistUrl, setSuggestPlaylistUrl] = useState("");
  const [suggestCollectionId, setSuggestCollectionId] = useState<string | null>(
    null,
  );
  const [suggestYoutubePlaylistId, setSuggestYoutubePlaylistId] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const cooldownIntervalRef = useRef<number | null>(null);
  const SUGGESTION_COOLDOWN_MS = 5000;
  const selectedSuggestCollection = collections.find(
    (item) => item.id === suggestCollectionId,
  );
  const isSuggestCollectionPrivate =
    selectedSuggestCollection?.visibility === "private";
  const isCooldownActive =
    typeof cooldownUntil === "number" && cooldownUntil > Date.now();
  const remainingCooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - cooldownNow) / 1000))
    : 0;
  const isSuggestCollectionEmptyNotice =
    !collectionsLoading &&
    collections.length === 0 &&
    !(collectionScope === "owner" && !isGoogleAuthed);
  const suggestPlaylistPrimaryText =
    "目前為貼上連結模式，請貼上 YouTube 播放清單連結";
  const suggestCollectionPrimaryText = (() => {
    const scopeLabel = collectionScope === "public" ? "公開" : "私人";
    if (collectionScope === "owner" && !isGoogleAuthed) {
      return "目前為私人收藏庫，請先登入後再選擇收藏庫";
    }
    if (collectionsLoading) {
      return `目前為${scopeLabel}收藏庫，正在讀取收藏庫清單`;
    }
    if (collections.length === 0) {
      return `目前為${scopeLabel}收藏庫，請先建立後再選擇`;
    }
    return `目前為${scopeLabel}收藏庫，請選擇收藏庫`;
  })();
  const isSuggestYoutubeEmptyNotice =
    isGoogleAuthed &&
    !youtubePlaylistsLoading &&
    youtubePlaylists.length === 0 &&
    !youtubePlaylistsError;
  const isSuggestYoutubeMissingNotice = Boolean(
    youtubePlaylistsError &&
    (youtubePlaylistsError.includes("尚未建立 YouTube 頻道") ||
      youtubePlaylistsError.includes("沒有播放清單")),
  );
  const visibleSuggestYoutubeError =
    youtubePlaylistsError && !isSuggestYoutubeMissingNotice
      ? youtubePlaylistsError
      : null;
  const suggestYoutubePrimaryText = (() => {
    if (!isGoogleAuthed) {
      return "目前為我的播放清單，請先登入後再選擇播放清單";
    }
    if (youtubePlaylistsLoading) {
      return "目前為我的播放清單，正在讀取播放清單";
    }
    if (isSuggestYoutubeMissingNotice) {
      return "目前為我的播放清單，尚未建立 YouTube 頻道或沒有播放清單";
    }
    if (isSuggestYoutubeEmptyNotice) {
      return "目前為我的播放清單，尚未建立播放清單，請先建立後再選擇";
    }
    return "目前為我的播放清單，請選擇播放清單";
  })();

  useEffect(() => {
    if (suggestType !== "collection") return;
    requestCollections(collectionScope);
  }, [collectionScope, requestCollections, suggestType]);

  useEffect(() => {
    if (suggestType !== "youtube") return;
    if (!isGoogleAuthed) return;
    requestYoutubePlaylists();
  }, [isGoogleAuthed, requestYoutubePlaylists, suggestType]);

  useEffect(() => {
    if (cooldownTimerRef.current) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (cooldownIntervalRef.current) {
      window.clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    if (!cooldownUntil) return;
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setCooldownUntil(null);
      setSuggestNotice(null);
      return;
    }
    setCooldownNow(Date.now());
    cooldownIntervalRef.current = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 500);
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownUntil(null);
      setSuggestNotice(null);
    }, remaining);
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (cooldownIntervalRef.current) {
        window.clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };
  }, [cooldownUntil]);

  return (
    <Accordion
      disableGutters
      expanded
      className="border border-slate-800/80 bg-slate-950/40 room-lobby-suggestion-accordion"
    >
      <AccordionSummary>
        <Typography variant="subtitle2" className="text-slate-200">
          推薦歌單給房主
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <Stack direction="row" className="room-lobby-mode-row">
            <Button
              size="small"
              variant={suggestType === "playlist" ? "contained" : "outlined"}
              className="room-lobby-mode-button"
              onClick={() => {
                setSuggestType("playlist");
                if (suggestError) {
                  setSuggestError(null);
                }
              }}
              disabled={isSubmitting}
            >
              貼上連結
            </Button>
            <Button
              size="small"
              variant={
                suggestType === "collection" && collectionScope === "public"
                  ? "contained"
                  : "outlined"
              }
              className="room-lobby-mode-button"
              onClick={() => {
                setSuggestType("collection");
                onCollectionScopeChange("public");
                setSuggestCollectionId(null);
                if (suggestError) {
                  setSuggestError(null);
                }
              }}
              disabled={isSubmitting}
            >
              公開收藏庫
            </Button>
            <Button
              size="small"
              variant={
                suggestType === "collection" && collectionScope === "owner"
                  ? "contained"
                  : "outlined"
              }
              className="room-lobby-mode-button"
              onClick={() => {
                setSuggestType("collection");
                onCollectionScopeChange("owner");
                setSuggestCollectionId(null);
                if (suggestError) {
                  setSuggestError(null);
                }
              }}
              disabled={isSubmitting || !isGoogleAuthed}
            >
              私人收藏庫
            </Button>
            <Button
              size="small"
              variant={suggestType === "youtube" ? "contained" : "outlined"}
              className="room-lobby-mode-button"
              onClick={() => {
                setSuggestType("youtube");
                if (suggestError) {
                  setSuggestError(null);
                }
              }}
              disabled={isSubmitting}
            >
              我的播放清單
            </Button>
          </Stack>
          {suggestType === "playlist" && (
            <>
              <Typography variant="caption" className="text-slate-400">
                {suggestPlaylistPrimaryText}
              </Typography>
              <TextField
                size="small"
                value={suggestPlaylistUrl}
                onChange={(e) => {
                  setSuggestPlaylistUrl(e.target.value);
                  if (suggestError) {
                    setSuggestError(null);
                  }
                  if (suggestNotice && !isCooldownActive) {
                    setSuggestNotice(null);
                  }
                }}
                placeholder="貼上 YouTube 播放清單 URL"
                disabled={isSubmitting}
                fullWidth
              />
            </>
          )}
          {suggestType === "collection" && (
            <>
              <Typography
                variant="caption"
                className={
                  isSuggestCollectionEmptyNotice ? "text-rose-300" : "text-slate-400"
                }
              >
                {suggestCollectionPrimaryText}
              </Typography>
              {!isGoogleAuthed && collectionScope === "owner" && (
                <Typography variant="caption" className="text-slate-400">
                  登入後可使用私人收藏庫
                </Typography>
              )}
              <TextField
                select
                size="small"
                value={suggestCollectionId ?? ""}
                onChange={(e) => {
                  setSuggestCollectionId(
                    e.target.value ? e.target.value : null,
                  );
                  if (suggestError) {
                    setSuggestError(null);
                  }
                  if (suggestNotice && !isCooldownActive) {
                    setSuggestNotice(null);
                  }
                }}
                disabled={isSubmitting}
                fullWidth
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) => {
                    const selectedId = String(selected ?? "");
                    if (!selectedId) return "請選擇收藏庫";
                    const selectedOption = collections.find(
                      (item) => item.id === selectedId,
                    );
                    if (!selectedOption) return selectedId;
                    return `${selectedOption.title} · ${resolveVisibilityLabel(
                      selectedOption.visibility,
                    )}`;
                  },
                }}
              >
                <MenuItem value="">選擇收藏庫</MenuItem>
                {collections.map((collection) => (
                  <MenuItem key={collection.id} value={collection.id}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <span>{collection.title}</span>
                      <Chip
                        size="small"
                        label={resolveVisibilityLabel(collection.visibility)}
                        variant="outlined"
                        color={
                          collection.visibility === "public"
                            ? "success"
                            : "default"
                        }
                        sx={{ ml: "auto" }}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          {suggestType === "youtube" && (
            <>
              <Typography
                variant="caption"
                className={
                  isSuggestYoutubeEmptyNotice || isSuggestYoutubeMissingNotice
                    ? "text-rose-300"
                    : "text-slate-400"
                }
              >
                {suggestYoutubePrimaryText}
              </Typography>
              {visibleSuggestYoutubeError && (
                <Typography variant="caption" className="text-rose-300">
                  {visibleSuggestYoutubeError}
                </Typography>
              )}
              <TextField
                select
                size="small"
                value={suggestYoutubePlaylistId ?? ""}
                onChange={(e) => {
                  setSuggestYoutubePlaylistId(
                    e.target.value ? e.target.value : null,
                  );
                  if (suggestError) {
                    setSuggestError(null);
                  }
                  if (suggestNotice && !isCooldownActive) {
                    setSuggestNotice(null);
                  }
                }}
                disabled={isSubmitting || !isGoogleAuthed}
                fullWidth
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) => {
                    const selectedId = String(selected ?? "");
                    if (!selectedId) return "請選擇播放清單";
                    const selectedOption = youtubePlaylists.find(
                      (item) => item.id === selectedId,
                    );
                    if (!selectedOption) return selectedId;
                    return `${selectedOption.title} (${selectedOption.itemCount})`;
                  },
                }}
              >
                <MenuItem value="">選擇播放清單</MenuItem>
                {youtubePlaylists.map((playlist) => (
                  <MenuItem key={playlist.id} value={playlist.id}>
                    {playlist.title} ({playlist.itemCount})
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          {suggestError && (
            <Typography variant="caption" className="text-rose-300">
              {suggestError}
            </Typography>
          )}
          {suggestType === "collection" && suggestCollectionId && (
            <Typography
              variant="caption"
              className={
                isSuggestCollectionPrivate
                  ? "text-amber-200"
                  : "text-emerald-300"
              }
            >
              {isSuggestCollectionPrivate
                ? "此收藏庫為私人，將以快照推薦給房主"
                : "此收藏庫為公開，將直接推薦給房主"}
            </Typography>
          )}
          {(suggestNotice || isCooldownActive) && (
            <Typography variant="caption" className="text-emerald-300">
              {isCooldownActive
                ? `已送出，${remainingCooldownSeconds} 秒後可再推薦`
                : suggestNotice}
            </Typography>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={
              isSubmitting ||
              isCooldownActive ||
              (suggestType === "playlist" && !suggestPlaylistUrl.trim()) ||
              (suggestType === "collection" && !suggestCollectionId) ||
              (suggestType === "youtube" && !suggestYoutubePlaylistId)
            }
            onClick={async () => {
              if (isCooldownActive) {
                const remaining = Math.max(
                  1,
                  Math.ceil(((cooldownUntil ?? Date.now()) - Date.now()) / 1000),
                );
                setSuggestNotice(`請稍候 ${remaining} 秒後再推薦`);
                return;
              }
              setIsSubmitting(true);
              setSuggestError(null);
              setSuggestNotice(null);
              try {
                let result: { ok: boolean; error?: string } | null = null;
                if (suggestType === "playlist") {
                  const trimmed = suggestPlaylistUrl.trim();
                  const playlistId = extractPlaylistId(trimmed);
                  if (!playlistId) {
                    setSuggestError("請輸入有效的播放清單 URL");
                    setSuggestNotice(null);
                    return;
                  }
                  result = await onSuggestPlaylist("playlist", trimmed, {
                    useSnapshot: false,
                    sourceId: playlistId,
                  });
                } else if (suggestType === "youtube") {
                  if (!suggestYoutubePlaylistId) {
                    setSuggestError("請先選擇播放清單");
                    setSuggestNotice(null);
                    return;
                  }
                  const selected = youtubePlaylists.find(
                    (playlist) => playlist.id === suggestYoutubePlaylistId,
                  );
                  result = await onSuggestPlaylist(
                    "playlist",
                    suggestYoutubePlaylistId,
                    {
                      useSnapshot: true,
                      sourceId: suggestYoutubePlaylistId,
                      title: selected?.title ?? null,
                    },
                  );
                } else if (suggestCollectionId) {
                  result = await onSuggestPlaylist(
                    "collection",
                    suggestCollectionId,
                    {
                      useSnapshot: isSuggestCollectionPrivate,
                      sourceId: suggestCollectionId,
                      title: selectedSuggestCollection?.title ?? null,
                    },
                  );
                }
                if (!result?.ok) {
                  setSuggestError(result?.error ?? "推薦失敗");
                  setSuggestNotice(null);
                  return;
                }
                setCooldownUntil(Date.now() + SUGGESTION_COOLDOWN_MS);
                setSuggestNotice("已送出");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting
              ? "送出中..."
              : isCooldownActive
                ? `倒數 ${Math.max(1, remainingCooldownSeconds)} 秒`
                : "送出推薦"}
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

interface RoomLobbyPanelProps {
  currentRoom: RoomState["room"] | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  username: string | null;
  roomPassword?: string | null;
  messageInput: string;
  playlistItems: PlaylistItem[];
  playlistHasMore: boolean;
  playlistLoadingMore: boolean;
  playlistProgress: { received: number; total: number; ready: boolean };
  playlistSuggestions: PlaylistSuggestion[];
  playlistUrl: string;
  playlistItemsForChange: PlaylistItem[];
  playlistError?: string | null;
  playlistLoading?: boolean;
  collections: CollectionOption[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  selectedCollectionId: string | null;
  collectionItemsLoading: boolean;
  collectionItemsError: string | null;
  isGoogleAuthed?: boolean;
  youtubePlaylists: YoutubePlaylist[];
  youtubePlaylistsLoading: boolean;
  youtubePlaylistsError: string | null;
  isHost: boolean;
  gameState?: GameState | null;
  canStartGame: boolean;
  onLeave: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onLoadMorePlaylist: () => void;
  onStartGame: () => void;
  onUpdateRoomSettings: (payload: {
    name?: string;
    visibility?: "public" | "private";
    password?: string | null;
    questionCount?: number;
    maxPlayers?: number | null;
  }) => Promise<boolean>;
  onOpenGame?: () => void;
  /** Invite handler that returns Promise<void>; surface errors via throw or status text */
  onInvite: () => Promise<void>;
  onKickPlayer: (clientId: string, durationMs?: number | null) => void;
  onTransferHost: (clientId: string) => void;
  onSuggestPlaylist: (
    type: "collection" | "playlist",
    value: string,
    options?: { useSnapshot?: boolean; sourceId?: string | null; title?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
  onApplySuggestionSnapshot: (suggestion: PlaylistSuggestion) => Promise<void>;
  onChangePlaylist: () => Promise<void>;
  onPlaylistUrlChange: (value: string) => void;
  onFetchPlaylistByUrl: (url: string) => void;
  onFetchCollections: (scope?: "owner" | "public") => void;
  onSelectCollection: (collectionId: string | null) => void;
  onLoadCollectionItems: (
    collectionId: string,
    options?: { readToken?: string | null },
  ) => Promise<void>;
  onFetchYoutubePlaylists: () => void;
  onImportYoutubePlaylist: (playlistId: string) => Promise<void>;
}

const RoomLobbyPanel: React.FC<RoomLobbyPanelProps> = ({
  currentRoom,
  participants,
  messages,
  username,
  roomPassword,
  messageInput,
  playlistItems,
  playlistHasMore,
  playlistLoadingMore,
  playlistProgress,
  playlistSuggestions,
  playlistUrl,
  playlistItemsForChange,
  playlistError,
  playlistLoading = false,
  collections,
  collectionsLoading,
  collectionsError,
  selectedCollectionId,
  collectionItemsLoading,
  collectionItemsError,
  isGoogleAuthed = false,
  youtubePlaylists,
  youtubePlaylistsLoading,
  youtubePlaylistsError,
  isHost,
  gameState,
  canStartGame,
  onLeave,
  onInputChange,
  onSend,
  onLoadMorePlaylist,
  onStartGame,
  onUpdateRoomSettings,
  onOpenGame,
  onInvite,
  onKickPlayer,
  onTransferHost,
  onSuggestPlaylist,
  onApplySuggestionSnapshot,
  onChangePlaylist,
  onPlaylistUrlChange,
  onFetchPlaylistByUrl,
  onFetchCollections,
  onSelectCollection,
  onLoadCollectionItems,
  onFetchYoutubePlaylists,
  onImportYoutubePlaylist,
}) => {
  const rowCount = playlistItems.length + (playlistHasMore ? 1 : 0);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [showRoomPassword, setShowRoomPassword] = useState(false);
  const [hostSourceType, setHostSourceType] = useState<
    "suggestions" | "playlist" | "collection" | "youtube"
  >("suggestions");
  const [selectedSuggestionKey, setSelectedSuggestionKey] = useState("");
  const [isApplyingHostSuggestion, setIsApplyingHostSuggestion] = useState(false);
  const [hostSuggestionHint, setHostSuggestionHint] = useState(
    "確認後會向來源重新載入並切換。",
  );
  const [collectionScope, setCollectionScope] = useState<"public" | "owner">(
    "public",
  );
  const lastRequestedScopeRef = useRef<"public" | "owner" | null>(null);
  const lastFetchedScopeRef = useRef<"public" | "owner" | null>(null);
  const lastRequestedYoutubeRef = useRef(false);
  const hasAttemptedYoutubeFetchRef = useRef(false);
  const [selectedYoutubePlaylistId, setSelectedYoutubePlaylistId] = useState<
    string | null
  >(null);
  const [hostPanelExpanded, setHostPanelExpanded] = useState(true);
  const isCompactLobbyLayout = useMediaQuery("(max-width:1180px)");
  const isHostPanelCollapsible = isCompactLobbyLayout;
  const isHostPanelExpanded = isHostPanelCollapsible ? hostPanelExpanded : true;
  const [lastSuggestionSeenAt, setLastSuggestionSeenAt] = useState(0);
  const [actionAnchorEl, setActionAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const confirmActionRef = useRef<null | (() => void)>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    detail?: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsVisibility, setSettingsVisibility] = useState<
    "public" | "private"
  >("public");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsPasswordDirty, setSettingsPasswordDirty] = useState(false);
  const [settingsQuestionCount, setSettingsQuestionCount] =
    useState(QUESTION_MIN);
  const [settingsMaxPlayers, setSettingsMaxPlayers] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const maskedRoomPassword = roomPassword
    ? "*".repeat(roomPassword.length)
    : "";
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);
  const playlistLoadNotice = (() => {
    if (playlistLoading || collectionItemsLoading) {
      return "載入中...";
    }
    if (playlistError || collectionItemsError) {
      return `載入失敗：${playlistError ?? collectionItemsError}`;
    }
    if (playlistItemsForChange.length === 0) {
      return null;
    }
    return `載入成功，共 ${playlistItemsForChange.length} 首`;
  })();
  const hostPlaylistPrimaryText =
    "目前為貼上連結模式，請貼上 YouTube 播放清單連結";
  const isHostCollectionEmptyNotice =
    hostSourceType === "collection" &&
    !collectionsLoading &&
    collections.length === 0 &&
    !(collectionScope === "owner" && !isGoogleAuthed);
  const hostCollectionPrimaryText = (() => {
    const scopeLabel = collectionScope === "public" ? "公開" : "私人";
    if (collectionScope === "owner" && !isGoogleAuthed) {
      return "目前為私人收藏庫，請先登入後再選擇收藏庫";
    }
    if (collectionsLoading) {
      return `目前為${scopeLabel}收藏庫，正在讀取收藏庫清單`;
    }
    if (collections.length === 0) {
      return `目前為${scopeLabel}收藏庫，請先建立後再選擇`;
    }
    return `目前為${scopeLabel}收藏庫，請選擇收藏庫`;
  })();
  const isHostYoutubeEmptyNotice =
    hostSourceType === "youtube" &&
    isGoogleAuthed &&
    !youtubePlaylistsLoading &&
    youtubePlaylists.length === 0 &&
    !youtubePlaylistsError;
  const isHostYoutubeMissingNotice =
    hostSourceType === "youtube" &&
    Boolean(
      youtubePlaylistsError &&
      (youtubePlaylistsError.includes("尚未建立 YouTube 頻道") ||
        youtubePlaylistsError.includes("沒有播放清單")),
    );
  const visibleHostYoutubeError =
    youtubePlaylistsError && !isHostYoutubeMissingNotice
      ? youtubePlaylistsError
      : null;
  const hostYoutubePrimaryText = (() => {
    if (!isGoogleAuthed) {
      return "目前為我的播放清單，請先登入後再選擇播放清單";
    }
    if (youtubePlaylistsLoading) {
      return "目前為我的播放清單，正在讀取播放清單";
    }
    if (isHostYoutubeMissingNotice) {
      return "目前為我的播放清單，尚未建立 YouTube 頻道或沒有播放清單";
    }
    if (youtubePlaylists.length === 0 && !youtubePlaylistsError) {
      return "目前為我的播放清單，尚未建立播放清單，請先建立後再選擇";
    }
    return "目前為我的播放清單，請選擇播放清單";
  })();
  const questionMaxLimit = getQuestionMax(
    currentRoom?.playlist.totalCount ?? 0,
  );
  const questionMinLimit = Math.min(QUESTION_MIN, questionMaxLimit);
  const settingsDisabled = gameState?.status === "playing";

  const extractPlaylistId = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      const listId = parsed.searchParams.get("list");
      if (listId) return listId;
      const segments = parsed.pathname.split("/");
      const last = segments[segments.length - 1];
      return last || null;
    } catch {
      return null;
    }
  };
  const handlePlaylistPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    const trimmed = pasted.trim();
    if (!trimmed) return;
    openConfirmModal("切換到這個歌單？", trimmed, () => {
      onFetchPlaylistByUrl(trimmed);
    });
  };
  const resolveVisibilityLabel = (visibility?: string) =>
    visibility === "public" ? "公開" : "私人";
  const isCollectionsEmptyNotice =
    collectionsError === "尚未建立收藏庫" ||
    collectionsError === "尚未建立公開收藏庫";
  const visibleCollectionsError = React.useMemo(() => {
    if (!collectionsError || isCollectionsEmptyNotice) {
      return null;
    }
    return collectionsError;
  }, [collectionsError, isCollectionsEmptyNotice]);

  useEffect(() => {
    if (collectionsLoading) return;
    const requested = lastRequestedScopeRef.current;
    if (!requested) return;
    if (!collectionsError || isCollectionsEmptyNotice) {
      lastFetchedScopeRef.current = requested;
    }
  }, [collectionsError, collectionsLoading, isCollectionsEmptyNotice]);

  const shouldFetchCollections = React.useCallback(
    (scope: "public" | "owner") => {
      if (collectionsLoading) return false;
      if (collectionsError && !isCollectionsEmptyNotice) return true;
      if (lastFetchedScopeRef.current !== scope) return true;
      return false;
    },
    [collectionsError, collectionsLoading, isCollectionsEmptyNotice],
  );

  const requestCollections = React.useCallback(
    (scope: "public" | "owner") => {
      if (!shouldFetchCollections(scope)) return;
      lastRequestedScopeRef.current = scope;
      onFetchCollections(scope);
    },
    [onFetchCollections, shouldFetchCollections],
  );

  useEffect(() => {
    if (youtubePlaylistsLoading) return;
    if (!lastRequestedYoutubeRef.current) return;
    hasAttemptedYoutubeFetchRef.current = true;
  }, [youtubePlaylistsLoading]);

  const shouldFetchYoutube = React.useCallback(() => {
    if (!isGoogleAuthed || youtubePlaylistsLoading) return false;
    return !hasAttemptedYoutubeFetchRef.current;
  }, [isGoogleAuthed, youtubePlaylistsLoading]);

  const requestYoutubePlaylists = React.useCallback((force = false) => {
    if (!isGoogleAuthed) return;
    if (!force && !shouldFetchYoutube()) return;
    lastRequestedYoutubeRef.current = true;
    hasAttemptedYoutubeFetchRef.current = true;
    onFetchYoutubePlaylists();
  }, [isGoogleAuthed, onFetchYoutubePlaylists, shouldFetchYoutube]);

  useEffect(() => {
    if (isGoogleAuthed) return;
    lastRequestedYoutubeRef.current = false;
    hasAttemptedYoutubeFetchRef.current = false;
  }, [isGoogleAuthed]);

  useEffect(() => {
    if (hostSourceType !== "collection") return;
    requestCollections(collectionScope);
  }, [collectionScope, hostSourceType, requestCollections]);

  useEffect(() => {
    if (hostSourceType !== "youtube") return;
    requestYoutubePlaylists();
  }, [hostSourceType, isGoogleAuthed, requestYoutubePlaylists]);

  const latestSuggestionAt = playlistSuggestions.reduce(
    (max, suggestion) => Math.max(max, suggestion.suggestedAt),
    0,
  );
  const hostSuggestionApplyingRef = useRef(false);
  const lastHostSuggestionRequestRef = useRef<{
    key: string;
    at: number;
  } | null>(null);
  const HOST_SUGGESTION_REQUEST_GAP_MS = 1200;
  const getSuggestionKey = React.useCallback(
    (suggestion: PlaylistSuggestion) =>
      `${suggestion.clientId}-${suggestion.suggestedAt}`,
    [],
  );

  useEffect(() => {
    if (playlistSuggestions.length === 0) {
      setSelectedSuggestionKey("");
      setHostSuggestionHint("目前沒有推薦可切換。");
      return;
    }
    setHostSuggestionHint("確認後會向來源重新載入並切換。");
    setSelectedSuggestionKey((prev) => {
      if (!prev) return "";
      const stillExists = playlistSuggestions.some(
        (suggestion) => getSuggestionKey(suggestion) === prev,
      );
      return stillExists ? prev : "";
    });
  }, [getSuggestionKey, playlistSuggestions]);

  const markSuggestionsSeen = () => {
    if (latestSuggestionAt > 0) {
      setLastSuggestionSeenAt(latestSuggestionAt);
    }
  };
  const hasNewSuggestions =
    isHost &&
    !(isHostPanelExpanded && hostSourceType === "suggestions") &&
    latestSuggestionAt > lastSuggestionSeenAt;

  useEffect(() => {
    if (!isHost) return;
    if (isHostPanelCollapsible) return;
    if (hostSourceType !== "suggestions") return;
    if (latestSuggestionAt <= lastSuggestionSeenAt) return;
    setLastSuggestionSeenAt(latestSuggestionAt);
  }, [
    hostSourceType,
    isHost,
    isHostPanelCollapsible,
    lastSuggestionSeenAt,
    latestSuggestionAt,
  ]);

  const closeActionMenu = () => {
    setActionAnchorEl(null);
    setActionTargetId(null);
  };

  const openSettingsModal = () => {
    if (!currentRoom) return;
    setSettingsName(currentRoom.name);
    setSettingsVisibility(currentRoom.visibility ?? "public");
    setSettingsPassword(roomPassword ?? "");
    setSettingsPasswordDirty(false);
    const baseQuestion =
      currentRoom.gameSettings?.questionCount ?? QUESTION_MIN;
    setSettingsQuestionCount(
      clampQuestionCount(baseQuestion, questionMaxLimit),
    );
    setSettingsMaxPlayers(
      currentRoom.maxPlayers && currentRoom.maxPlayers > 0
        ? String(currentRoom.maxPlayers)
        : "",
    );
    setSettingsError(null);
    setSettingsOpen(true);
  };

  const closeSettingsModal = () => {
    setSettingsOpen(false);
    setSettingsError(null);
  };

  const handleSaveSettings = async () => {
    if (settingsDisabled) return;
    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      setSettingsError("請輸入房間名稱");
      return;
    }
    const parsedMaxPlayers = settingsMaxPlayers.trim()
      ? Number(settingsMaxPlayers)
      : null;
    if (parsedMaxPlayers !== null && !Number.isFinite(parsedMaxPlayers)) {
      setSettingsError("請輸入有效的人數上限");
      return;
    }
    const normalizedMaxPlayers =
      parsedMaxPlayers !== null ? Math.floor(parsedMaxPlayers) : null;
    const effectiveMaxPlayers =
      normalizedMaxPlayers && normalizedMaxPlayers > 0
        ? normalizedMaxPlayers
        : null;
    if (
      effectiveMaxPlayers !== null &&
      (effectiveMaxPlayers < PLAYER_MIN || effectiveMaxPlayers > PLAYER_MAX)
    ) {
      setSettingsError(
        `人數上限需介於 ${PLAYER_MIN} 到 ${PLAYER_MAX}`,
      );
      return;
    }

    const nextMaxPlayers = effectiveMaxPlayers;
    const nextQuestionCount = clampQuestionCount(
      settingsQuestionCount,
      questionMaxLimit,
    );
    const payload = {
      name: trimmedName,
      visibility: settingsVisibility,
      questionCount: nextQuestionCount,
      maxPlayers: nextMaxPlayers,
      ...(settingsPasswordDirty ? { password: settingsPassword } : {}),
    };
    const success = await onUpdateRoomSettings(payload);
    if (success) {
      closeSettingsModal();
    }
  };

  const openConfirmModal = (title: string, detail: string | undefined, action: () => void) => {
    confirmActionRef.current = action;
    setConfirmModal({ title, detail });
  };

  const closeConfirmModal = () => {
    setConfirmModal(null);
    confirmActionRef.current = null;
  };

  const handleConfirmSwitch = () => {
    const action = confirmActionRef.current;
    closeConfirmModal();
    action?.();
  };

  const handleApplyHostSuggestion = async (suggestion: PlaylistSuggestion) => {
    const suggestionKey = getSuggestionKey(suggestion);
    const now = Date.now();
    const lastRequest = lastHostSuggestionRequestRef.current;
    if (hostSuggestionApplyingRef.current) {
      setHostSuggestionHint("正在切換中，請稍候...");
      return;
    }
    if (
      lastRequest &&
      lastRequest.key === suggestionKey &&
      now - lastRequest.at < HOST_SUGGESTION_REQUEST_GAP_MS
    ) {
      setHostSuggestionHint("同一筆推薦切換過於頻繁，請稍候再試。");
      return;
    }

    lastHostSuggestionRequestRef.current = { key: suggestionKey, at: now };
    hostSuggestionApplyingRef.current = true;
    setIsApplyingHostSuggestion(true);
    setHostSuggestionHint("正在套用推薦...");

    try {
      const isSnapshot = Boolean(suggestion.items?.length);
      if (isSnapshot) {
        await onApplySuggestionSnapshot(suggestion);
        setHostSuggestionHint("已送出切換，等待房間同步。");
        return;
      }

      if (suggestion.type === "playlist") {
        onFetchPlaylistByUrl(suggestion.value);
        setHostSuggestionHint("已送出切換，等待房間同步。");
        return;
      }

      onSelectCollection(suggestion.value);
      await onLoadCollectionItems(suggestion.value, {
        readToken: suggestion.readToken ?? null,
      });
      setHostSuggestionHint("已送出切換，等待房間同步。");
    } catch (error) {
      console.error(error);
      setHostSuggestionHint("切換失敗，請稍後再試。");
    } finally {
      window.setTimeout(() => {
        hostSuggestionApplyingRef.current = false;
        setIsApplyingHostSuggestion(false);
      }, HOST_SUGGESTION_REQUEST_GAP_MS);
    }
  };

  const requestApplyHostSuggestion = (suggestion: PlaylistSuggestion) => {
    const isSnapshot = Boolean(suggestion.items?.length);
    const displayLabel = suggestion.title ?? suggestion.value;
    openConfirmModal(
      suggestion.type === "playlist"
        ? "切換到推薦歌單？"
        : "切換到推薦收藏庫？",
      displayLabel,
      () => {
        void handleApplyHostSuggestion(suggestion);
      },
    );
    setHostSuggestionHint(
      isSnapshot
        ? "此推薦會使用快照套用，確認後立即切換。"
        : "確認後會向來源重新載入並切換。",
    );
  };

  const suggestionResetKey =
    gameState?.status === "ended"
      ? `ended-${gameState?.startedAt ?? 0}`
      : "not-ended";

  const PlaylistRow = ({ index, style, ariaAttributes }: RowComponentProps) => {
    if (index >= playlistItems.length) {
      if (playlistHasMore && !playlistLoadingMore) {
        onLoadMorePlaylist();
      }
      return (
        <Box
          style={style}
          {...ariaAttributes}
          className="text-center text-slate-400 text-xs py-2"
        >
          {playlistHasMore ? "載入中..." : "已到底了"}
        </Box>
      );
    }

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

  return (
    <Card
      variant="outlined"
      className="w-full lg:w-4/5 bg-slate-900/70 border-slate-700 text-slate-50 room-lobby-card"
      sx={{
        maxHeight: isCompactLobbyLayout ? "none" : 820,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" className="text-slate-100">
              {currentRoom && currentRoom.name}
            </Typography>
            <Chip
              size="small"
              label={
                currentRoom?.maxPlayers
                  ? `${participants.length}/${currentRoom.maxPlayers} 人`
                  : `${participants.length} 人`
              }
              color="success"
              variant="outlined"
            />
            {isHost && currentRoom?.hasPassword && (
              <Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Typography variant="subtitle2" className="text-slate-200">
                    房間密碼
                  </Typography>
                  {roomPassword ? (
                    <>
                      <TextField
                        size="small"
                        value={
                          showRoomPassword ? roomPassword : maskedRoomPassword
                        }
                        InputProps={{ readOnly: true }}
                        sx={{ minWidth: 180 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setShowRoomPassword((prev) => !prev)}
                      >
                        {showRoomPassword ? "隱藏" : "顯示"}
                      </Button>
                    </>
                  ) : (
                    <Typography variant="caption" className="text-slate-500">
                      尚未取得密碼
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        }
        action={
          <Stack direction="row" spacing={1}>
            {gameState?.status === "playing" && (
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={() => onOpenGame?.()}
              >
                回到遊戲
              </Button>
            )}
            {isHost && (
              <Button
                variant="contained"
                color="warning"
                size="small"
                disabled={!canStartGame || gameState?.status === "playing"}
                onClick={onStartGame}
              >
                開始遊戲
              </Button>
            )}
            {isHost && (
              <IconButton
                size="small"
                color="inherit"
                onClick={openSettingsModal}
              >
                <SettingsOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {isHost && (
              <Button
                variant="contained"
                color={inviteSuccess ? "success" : "info"}
                size="small"
                sx={{
                  transition: "color 150ms ease, box-shadow 150ms ease",
                  boxShadow: inviteSuccess ? 3 : "none",
                }}
                onClick={() => {
                  void (async () => {
                    try {
                      await onInvite();
                      setInviteSuccess(true);
                      setTimeout(() => setInviteSuccess(false), 1000);
                    } catch (e) {
                      console.log(e);
                    }
                  })();
                }}
              >
                {inviteSuccess ? "已複製" : "邀請"}
              </Button>
            )}
            {currentRoom && (
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onLeave}
              >
                離開
              </Button>
            )}
          </Stack>
        }
      />
      <CardContent
        className="room-lobby-content"
        sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <div className="room-lobby-top-grid">
          <Box className="room-lobby-participants">
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              mb={1}
            >
              <Typography variant="subtitle2" className="text-slate-200">
                房間設定
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`題數 ${currentRoom?.gameSettings?.questionCount ?? "-"}`}
                className="text-slate-200 border-slate-600"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`清單 ${currentRoom?.playlist.totalCount ?? "-"} 首`}
                className="text-slate-200 border-slate-600"
              />
              <Chip
                size="small"
                variant="outlined"
                label={playlistProgress.ready ? "清單已就緒" : "清單準備中"}
                className="text-slate-200 border-slate-600"
              />
              {currentRoom?.hasPassword && (
                <Chip
                  size="small"
                  variant="outlined"
                  label="有密碼"
                  className="text-slate-200 border-slate-600"
                />
              )}
              {currentRoom?.visibility === "private" && (
                <Chip
                  size="small"
                  variant="outlined"
                  label="私人"
                  className="text-slate-200 border-slate-600"
                />
              )}
            </Stack>

            <Typography
              variant="subtitle2"
              className="text-slate-200"
              gutterBottom
            >
              成員
            </Typography>
            {participants.length === 0 ? (
              <Typography variant="body2" className="text-slate-500">
                目前沒有其他人
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {participants.map((p) => {
                  const isSelf = p.username === username;
                  const host = p.clientId === currentRoom?.hostClientId;
                  const isActionOpen =
                    Boolean(actionAnchorEl) && actionTargetId === p.clientId;
                  const showActions = isHost && !isSelf;
                  return (
                    <Box key={p.clientId} className="flex items-center gap-1">
                      <Chip
                        label={
                          <Stack
                            display={"flex"}
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Badge
                              variant="dot"
                              color={p.isOnline ? "success" : "default"}
                              overlap="circular"
                            >
                              <Box className="h-1.5 w-1.5 rounded-full" />
                            </Badge>
                            <span>{p.username}</span>
                            {host && (
                              <span className="text-amber-200 text-[10px]">
                                Host
                              </span>
                            )}
                            {isSelf && (
                              <span className="opacity-80 text-[10px]">(我)</span>
                            )}
                            {showActions && (
                              <IconButton
                                size="small"
                                color="inherit"
                                sx={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "999px",
                                  "&:hover": {
                                    backgroundColor: "rgba(148,163,184,0.25)",
                                  },
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActionAnchorEl(event.currentTarget);
                                  setActionTargetId(p.clientId);
                                }}
                              >
                                ...
                              </IconButton>
                            )}
                          </Stack>
                        }
                        variant="outlined"
                        color={isSelf ? "info" : "default"}
                        className={
                          isSelf
                            ? "text-sky-100 border-sky-500/60"
                            : "text-slate-200"
                        }
                      />
                      {showActions && (
                        <Popover
                          open={isActionOpen}
                          anchorEl={actionAnchorEl}
                          onClose={closeActionMenu}
                          anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                          }}
                        >
                          <MUIList dense>
                            <ListItem>
                              <Button
                                size="small"
                                variant="text"
                                color="info"
                                disabled={!p.isOnline}
                                onClick={() => {
                                  onTransferHost(p.clientId);
                                  closeActionMenu();
                                }}
                              >
                                設為房主
                              </Button>
                            </ListItem>
                            <ListItem>
                              <Button
                                size="small"
                                variant="text"
                                color="warning"
                                onClick={() => {
                                  onKickPlayer(p.clientId);
                                  closeActionMenu();
                                }}
                              >
                                踢出（5 分鐘）
                              </Button>
                            </ListItem>
                            <ListItem>
                              <Button
                                size="small"
                                variant="text"
                                color="warning"
                                onClick={() => {
                                  onKickPlayer(p.clientId, null);
                                  closeActionMenu();
                                }}
                              >
                                永久踢出
                              </Button>
                            </ListItem>
                          </MUIList>
                        </Popover>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>

          {isHost && (
            <Accordion
              disableGutters
              className={`border border-slate-800/80 bg-slate-950/40 room-lobby-host-accordion ${isHostPanelCollapsible ? "" : "room-lobby-host-accordion-fixed"}`}
              expanded={isHostPanelExpanded}
              onChange={
                isHostPanelCollapsible
                  ? (_event, expanded) => {
                    setHostPanelExpanded(expanded);
                    if (expanded && hostSourceType === "suggestions") {
                      markSuggestionsSeen();
                    }
                  }
                  : undefined
              }
            >
              <AccordionSummary
                expandIcon={isHostPanelCollapsible ? <ExpandMoreIcon /> : undefined}
              >
                <div className="flex items-center gap-2">
                  <Typography variant="subtitle2" className="text-slate-200">
                    房主控制
                  </Typography>
                  {hasNewSuggestions && (
                    <Chip
                      size="small"
                      color="warning"
                      label={`新推薦 ${playlistSuggestions.length}`}
                    />
                  )}
                </div>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {gameState?.status === "playing" && (
                    <Typography variant="caption" className="text-slate-400">
                      遊戲進行中無法切換歌單或套用推薦
                    </Typography>
                  )}
                  <Box className="room-lobby-host-controls">
                    <Stack
                      spacing={1}
                      className={`room-lobby-source-panel ${hostSourceType === "suggestions"
                        ? "room-lobby-source-panel-suggestions"
                        : "room-lobby-source-panel-fixed"
                        }`}
                    >
                      <Stack
                        direction="row"
                        className="room-lobby-mode-row room-lobby-mode-row--host"
                      >
                        <Button
                          size="small"
                          variant={
                            hostSourceType === "suggestions"
                              ? "contained"
                              : "outlined"
                          }
                          className="room-lobby-mode-button"
                          onClick={() => {
                            if (
                              isHostPanelExpanded &&
                              hostSourceType !== "suggestions"
                            ) {
                              markSuggestionsSeen();
                            }
                            setHostSourceType("suggestions");
                          }}
                        >
                          推薦清單
                        </Button>
                        <Button
                          size="small"
                          variant={
                            hostSourceType === "playlist" ? "contained" : "outlined"
                          }
                          className="room-lobby-mode-button"
                          onClick={() => {
                            if (
                              isHostPanelExpanded &&
                              hostSourceType === "suggestions"
                            ) {
                              markSuggestionsSeen();
                            }
                            setHostSourceType("playlist");
                          }}
                        >
                          貼上連結
                        </Button>
                        <Button
                          size="small"
                          variant={
                            hostSourceType === "collection" &&
                              collectionScope === "public"
                              ? "contained"
                              : "outlined"
                          }
                          className="room-lobby-mode-button"
                          onClick={() => {
                            if (
                              isHostPanelExpanded &&
                              hostSourceType === "suggestions"
                            ) {
                              markSuggestionsSeen();
                            }
                            setHostSourceType("collection");
                            setCollectionScope("public");
                            onSelectCollection(null);
                          }}
                        >
                          公開收藏庫
                        </Button>
                        <Button
                          size="small"
                          variant={
                            hostSourceType === "collection" &&
                              collectionScope === "owner"
                              ? "contained"
                              : "outlined"
                          }
                          className="room-lobby-mode-button"
                          onClick={() => {
                            if (
                              isHostPanelExpanded &&
                              hostSourceType === "suggestions"
                            ) {
                              markSuggestionsSeen();
                            }
                            setHostSourceType("collection");
                            setCollectionScope("owner");
                            onSelectCollection(null);
                          }}
                          disabled={!isGoogleAuthed}
                        >
                          私人收藏庫
                        </Button>
                        <Button
                          size="small"
                          variant={
                            hostSourceType === "youtube" ? "contained" : "outlined"
                          }
                          className="room-lobby-mode-button"
                          onClick={() => {
                            if (
                              isHostPanelExpanded &&
                              hostSourceType === "suggestions"
                            ) {
                              markSuggestionsSeen();
                            }
                            setHostSourceType("youtube");
                          }}
                        >
                          我的播放清單
                        </Button>
                      </Stack>

                      <Stack spacing={1} className="room-lobby-source-view">
                        {hostSourceType === "suggestions" && (
                          <Stack spacing={1}>
                            <Typography
                              variant="caption"
                              className={
                                isApplyingHostSuggestion
                                  ? "text-amber-200"
                                  : "text-slate-400"
                              }
                            >
                              {hostSuggestionHint}
                            </Typography>
                            <TextField
                              select
                              size="small"
                              value={selectedSuggestionKey}
                              onChange={(e) => {
                                const nextKey = e.target.value;
                                setSelectedSuggestionKey(nextKey);
                                if (!nextKey) return;
                                const suggestion = playlistSuggestions.find(
                                  (item) => getSuggestionKey(item) === nextKey,
                                );
                                if (!suggestion) return;
                                requestApplyHostSuggestion(suggestion);
                              }}
                              disabled={isApplyingHostSuggestion}
                              fullWidth
                              SelectProps={{
                                displayEmpty: true,
                                renderValue: (selected) => {
                                  const key = String(selected ?? "");
                                  if (!key) {
                                    return "請選擇推薦清單";
                                  }
                                  const selectedSuggestion = playlistSuggestions.find(
                                    (suggestion) =>
                                      getSuggestionKey(suggestion) === key,
                                  );
                                  if (!selectedSuggestion) {
                                    return "請選擇推薦清單";
                                  }
                                  const label =
                                    selectedSuggestion.title ??
                                    selectedSuggestion.value;
                                  const count =
                                    selectedSuggestion.totalCount ??
                                    selectedSuggestion.items?.length;
                                  return `${selectedSuggestion.username} · ${label}${count ? ` (${count})` : ""
                                    }`;
                                },
                              }}
                            >
                              <MenuItem value="">請選擇推薦清單</MenuItem>
                              {playlistSuggestions.map((suggestion) => {
                                const optionKey = getSuggestionKey(suggestion);
                                const displayLabel =
                                  suggestion.title ?? suggestion.value;
                                const displayCount =
                                  suggestion.totalCount ?? suggestion.items?.length;
                                const sourceLabel =
                                  suggestion.type === "playlist" ? "歌單" : "收藏庫";
                                const snapshotLabel = suggestion.items?.length
                                  ? " · 快照"
                                  : "";
                                return (
                                  <MenuItem key={optionKey} value={optionKey}>
                                    <Stack
                                      spacing={0.25}
                                      sx={{ width: "100%", minWidth: 0 }}
                                    >
                                      <Typography variant="body2" noWrap>
                                        {`${suggestion.username} · ${sourceLabel}${snapshotLabel}`}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        className="text-slate-400"
                                        noWrap
                                      >
                                        {`${displayLabel}${displayCount ? ` (${displayCount})` : ""}`}
                                      </Typography>
                                    </Stack>
                                  </MenuItem>
                                );
                              })}
                            </TextField>
                          </Stack>
                        )}

                        {hostSourceType === "playlist" && (
                          <>
                            <Typography variant="caption" className="text-slate-400">
                              {hostPlaylistPrimaryText}
                            </Typography>
                            <TextField
                              size="small"
                              value={playlistUrl}
                              onChange={(e) => {
                                onPlaylistUrlChange(e.target.value);
                              }}
                              onPaste={handlePlaylistPaste}
                              placeholder="貼上 YouTube 播放清單 URL"
                              disabled={
                                playlistLoading || gameState?.status === "playing"
                              }
                              fullWidth
                            />
                          </>
                        )}

                        {hostSourceType === "collection" && (
                          <>
                            <Typography
                              variant="caption"
                              className={
                                isHostCollectionEmptyNotice ? "text-rose-300" : "text-slate-400"
                              }
                            >
                              {hostCollectionPrimaryText}
                            </Typography>
                            {!isGoogleAuthed && collectionScope === "owner" && (
                              <Typography
                                variant="caption"
                                className="text-slate-400"
                              >
                                登入後可使用私人收藏庫
                              </Typography>
                            )}
                            <TextField
                              select
                              size="small"
                              value={selectedCollectionId ?? ""}
                              onChange={(e) => {
                                const nextId = e.target.value || null;
                                if (!nextId) {
                                  onSelectCollection(null);
                                  return;
                                }
                                const selected = collections.find(
                                  (item) => item.id === nextId,
                                );
                                const label = selected
                                  ? `${selected.title} · ${resolveVisibilityLabel(
                                    selected.visibility,
                                  )}`
                                  : nextId;
                                openConfirmModal("切換到收藏庫？", label, () => {
                                  onSelectCollection(nextId);
                                  void onLoadCollectionItems(nextId);
                                });
                              }}
                              disabled={
                                collectionsLoading || gameState?.status === "playing"
                              }
                              fullWidth
                              placeholder="選擇收藏庫"
                              SelectProps={{
                                displayEmpty: true,
                                renderValue: (selected) => {
                                  const selectedId = String(selected ?? "");
                                  if (!selectedId) return "請選擇收藏庫";
                                  const selectedOption = collections.find(
                                    (item) => item.id === selectedId,
                                  );
                                  if (!selectedOption) return selectedId;
                                  return `${selectedOption.title} · ${resolveVisibilityLabel(
                                    selectedOption.visibility,
                                  )}`;
                                },
                              }}
                            >
                              <MenuItem value="">選擇收藏庫</MenuItem>
                              {collections.map((collection) => (
                                <MenuItem key={collection.id} value={collection.id}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ width: "100%" }}
                                  >
                                    <span>{collection.title}</span>
                                    <Chip
                                      size="small"
                                      label={resolveVisibilityLabel(
                                        collection.visibility,
                                      )}
                                      variant="outlined"
                                      color={
                                        collection.visibility === "public"
                                          ? "success"
                                          : "default"
                                      }
                                      sx={{ ml: "auto" }}
                                    />
                                  </Stack>
                                </MenuItem>
                              ))}
                            </TextField>
                            {visibleCollectionsError && (
                              <Typography variant="caption" className="text-rose-300">
                                {visibleCollectionsError}
                              </Typography>
                            )}
                            {collectionItemsError && (
                              <Typography variant="caption" className="text-rose-300">
                                {collectionItemsError}
                              </Typography>
                            )}
                          </>
                        )}

                        {hostSourceType === "youtube" && (
                          <>
                            <Typography
                              variant="caption"
                              className={
                                isHostYoutubeEmptyNotice || isHostYoutubeMissingNotice
                                  ? "text-rose-300"
                                  : "text-slate-400"
                              }
                            >
                              {hostYoutubePrimaryText}
                            </Typography>
                            {visibleHostYoutubeError && (
                              <Typography variant="caption" className="text-rose-300">
                                {visibleHostYoutubeError}
                              </Typography>
                            )}
                            <TextField
                              select
                              size="small"
                              value={selectedYoutubePlaylistId ?? ""}
                              onChange={(e) => {
                                const nextId = e.target.value || null;
                                if (!nextId) {
                                  setSelectedYoutubePlaylistId(null);
                                  return;
                                }
                                const selected = youtubePlaylists.find(
                                  (item) => item.id === nextId,
                                );
                                const label = selected
                                  ? `${selected.title} (${selected.itemCount})`
                                  : nextId;
                                openConfirmModal("切換到播放清單？", label, () => {
                                  setSelectedYoutubePlaylistId(nextId);
                                  void onImportYoutubePlaylist(nextId);
                                });
                              }}
                              disabled={youtubePlaylistsLoading || !isGoogleAuthed}
                              fullWidth
                              SelectProps={{
                                displayEmpty: true,
                                renderValue: (selected) => {
                                  const selectedId = String(selected ?? "");
                                  if (!selectedId) return "請選擇播放清單";
                                  const selectedOption = youtubePlaylists.find(
                                    (item) => item.id === selectedId,
                                  );
                                  if (!selectedOption) return selectedId;
                                  return `${selectedOption.title} (${selectedOption.itemCount})`;
                                },
                              }}
                            >
                              <MenuItem value="">選擇播放清單</MenuItem>
                              {youtubePlaylists.map((playlist) => (
                                <MenuItem key={playlist.id} value={playlist.id}>
                                  {playlist.title} ({playlist.itemCount})
                                </MenuItem>
                              ))}
                            </TextField>
                          </>
                        )}

                      </Stack>

                      <Stack spacing={0.75} className="room-lobby-source-footer">
                        {playlistLoadNotice && (
                          <Typography
                            variant="caption"
                            className={
                              playlistError || collectionItemsError
                                ? "text-rose-300"
                                : "text-slate-400"
                            }
                          >
                            {playlistLoadNotice}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          className="room-lobby-apply-button"
                          onClick={() => void onChangePlaylist()}
                          disabled={
                            playlistItemsForChange.length === 0 ||
                            playlistLoading ||
                            gameState?.status === "playing"
                          }
                        >
                          套用到房間
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}

          {!isHost && gameState?.status !== "playing" && (
            <SuggestionPanel
              key={suggestionResetKey}
              collectionScope={collectionScope}
              onCollectionScopeChange={setCollectionScope}
              collections={collections}
              collectionsLoading={collectionsLoading}
              isGoogleAuthed={isGoogleAuthed}
              youtubePlaylists={youtubePlaylists}
              youtubePlaylistsLoading={youtubePlaylistsLoading}
              youtubePlaylistsError={youtubePlaylistsError}
              requestCollections={requestCollections}
              requestYoutubePlaylists={requestYoutubePlaylists}
              onSuggestPlaylist={onSuggestPlaylist}
              extractPlaylistId={extractPlaylistId}
              resolveVisibilityLabel={resolveVisibilityLabel}
            />
          )}
        </div>

        <Box
          className="room-lobby-chat-log"
          ref={chatScrollRef}
          sx={{
            flex: 1,
            border: "1px solid #1f2937",
            borderRadius: 2,
            backgroundColor: "rgba(15,23,42,0.6)",
            p: 1.5,
            maxHeight: "150px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {messages.length === 0 ? (
            <Typography
              variant="body2"
              className="text-slate-500"
              align="center"
            >
              還沒有訊息，先來打聲招呼吧！
            </Typography>
          ) : (
            <MUIList dense disablePadding>
              {messages.map((msg) => {
                // const isSelf = msg.username === username;
                return (
                  <ListItem
                    key={msg.id}
                    sx={
                      {
                        // justifyContent: isSelf ? "flex-end" : "flex-start",
                        // textAlign: isSelf ? "right" : "left",
                      }
                    }
                  >
                    <Box
                      sx={{
                        maxWidth: "75%",
                        borderRadius: 3,
                        px: 1.5,
                        py: 1,
                        // bgcolor: isSelf ? "primary.dark" : "#334155",
                        color: "white",
                        // whiteSpace: "wrap",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                      // justifyContent="space-between"
                      >
                        <Typography variant="caption" fontWeight={600}>
                          {msg.username}
                          {/* {isSelf && "（我）"} */}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="rgba(255,255,255,0.7)"
                        >
                          {formatTime(msg.timestamp)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content}
                      </Typography>
                    </Box>
                  </ListItem>
                );
              })}
            </MUIList>
          )}
        </Box>

        <Stack direction="row" spacing={1} className="room-lobby-chat-input">
          <TextField
            autoComplete="off"
            fullWidth
            size="small"
            placeholder="輸入訊息後按 Enter 送出"
            value={messageInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button variant="contained" onClick={onSend}>
            Send
          </Button>
        </Stack>

        <Divider className="room-lobby-divider" />

        <Box className="room-lobby-playlist-panel">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" className="text-slate-200">
                播放清單
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`${playlistProgress.received}/${playlistProgress.total}${playlistProgress.ready ? " · 已準備" : ""
                  }`}
                className="text-slate-200 border-slate-600"
              />
            </Stack>
          </Stack>
          {playlistItems.length === 0 ? (
            <Typography
              variant="body2"
              className="text-slate-500"
              align="center"
              py={2}
            >
              尚無歌曲，等主持人載入吧。
            </Typography>
          ) : (
            <div className="rounded border border-slate-800 bg-slate-900/60">
              <VirtualList
                style={{ height: 280, width: "100%" }}
                rowCount={rowCount}
                rowHeight={75}
                rowProps={{}}
                rowComponent={PlaylistRow}
              />
            </div>
          )}
        </Box>
      </CardContent>
      <Dialog
        open={settingsOpen}
        onClose={closeSettingsModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>房間設定</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {settingsDisabled && (
              <Typography variant="caption" className="text-amber-300">
                遊戲進行中，暫停修改房間設定。
              </Typography>
            )}
            <TextField
              label="房間名稱"
              value={settingsName}
              onChange={(e) => {
                setSettingsName(e.target.value);
                if (settingsError) {
                  setSettingsError(null);
                }
              }}
              disabled={settingsDisabled}
              fullWidth
            />
            <RoomAccessSettingsFields
              visibility={settingsVisibility}
              password={settingsPassword}
              disabled={settingsDisabled}
              allowPasswordWhenPublic
              onVisibilityChange={(nextVisibility) => {
                setSettingsVisibility(nextVisibility);
                if (settingsError) {
                  setSettingsError(null);
                }
              }}
              onPasswordChange={(value) => {
                setSettingsPassword(value);
                setSettingsPasswordDirty(true);
                if (settingsError) {
                  setSettingsError(null);
                }
              }}
              onPasswordClear={() => {
                setSettingsPassword("");
                setSettingsPasswordDirty(true);
                if (settingsError) {
                  setSettingsError(null);
                }
              }}
              classes={{
                helperText: "text-slate-400",
                noteText: "text-slate-400",
              }}
            />
            <Stack spacing={1}>
              <TextField
                label="人數上限"
                type="number"
                value={settingsMaxPlayers}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!/^\d*$/.test(next)) return;
                  setSettingsMaxPlayers(next);
                  if (settingsError) {
                    setSettingsError(null);
                  }
                }}
                inputProps={{ min: PLAYER_MIN, max: PLAYER_MAX, inputMode: "numeric" }}
                placeholder="留空表示不限制"
                disabled={settingsDisabled}
                fullWidth
              />
              <Typography variant="caption" className="text-slate-400">
                留空代表不限制，最多 {PLAYER_MAX} 人。
              </Typography>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" className="text-slate-200">
                題數
              </Typography>
              <QuestionCountControls
                value={settingsQuestionCount}
                min={questionMinLimit}
                max={questionMaxLimit}
                step={QUESTION_STEP}
                disabled={settingsDisabled}
                onChange={(nextValue) => {
                  setSettingsQuestionCount(nextValue);
                  if (settingsError) {
                    setSettingsError(null);
                  }
                }}
              />
            </Stack>
            {settingsError && (
              <Typography variant="caption" className="text-rose-300">
                {settingsError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSettingsModal} variant="text">
            取消
          </Button>
          <Button
            onClick={() => void handleSaveSettings()}
            variant="contained"
            disabled={settingsDisabled}
          >
            儲存
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(confirmModal)} onClose={closeConfirmModal}>
        <DialogTitle>{confirmModal?.title ?? "切換播放清單"}</DialogTitle>
        <DialogContent>
          {confirmModal?.detail && (
            <Typography variant="body2" className="text-slate-600">
              {confirmModal.detail}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmModal} variant="text">
            取消
          </Button>
          <Button
            onClick={handleConfirmSwitch}
            variant="contained"
            color="warning"
          >
            切換
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default RoomLobbyPanel;
