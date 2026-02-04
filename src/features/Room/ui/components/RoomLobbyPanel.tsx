import React, { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  List as MUIList,
  ListItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { List as VirtualList, type RowComponentProps } from "react-window";
import type {
  ChatMessage,
  GameState,
  PlaylistItem,
  RoomParticipant,
  RoomState,
} from "../../model/types";

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString();
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
  isHost: boolean;
  gameState?: GameState | null;
  canStartGame: boolean;
  onLeave: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onLoadMorePlaylist: () => void;
  onStartGame: () => void;
  onOpenGame?: () => void;
  /** Invite handler that returns Promise<void>; surface errors via throw or status text */
  onInvite: () => Promise<void>;
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
  isHost,
  gameState,
  canStartGame,
  onLeave,
  onInputChange,
  onSend,
  onLoadMorePlaylist,
  onStartGame,
  onOpenGame,
  onInvite,
}) => {
  const rowCount = playlistItems.length + (playlistHasMore ? 1 : 0);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [showRoomPassword, setShowRoomPassword] = useState(false);
  const maskedRoomPassword = roomPassword
    ? "*".repeat(roomPassword.length)
    : "";
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

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
      className="w-full lg:w-4/5 bg-slate-900/70 border-slate-700 text-slate-50"
      sx={{ maxHeight: 760, display: "flex", flexDirection: "column" }}
    >
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" className="text-slate-100">
              {currentRoom && currentRoom.name}
            </Typography>
            <Chip
              size="small"
              label={`${participants.length} 人`}
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
        sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <Box>
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
                return (
                  <Chip
                    key={p.clientId}
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
                );
              })}
            </Stack>
          )}
        </Box>

        <Box
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

        <Stack direction="row" spacing={1}>
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

        <Divider />

        <Box>
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
    </Card>
  );
};

export default RoomLobbyPanel;
