import React, { useState } from "react";
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
} from "../types";

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString();
};

interface ChatPanelProps {
  currentRoom: RoomState["room"] | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  username: string | null;
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

const ChatPanel: React.FC<ChatPanelProps> = ({
  currentRoom,
  participants,
  messages,
  username,
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

  const PlaylistRow = ({ index, style, ariaAttributes }: RowComponentProps) => {
    // Loader / 結尾列
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
          {playlistHasMore ? "載入中..." : "已到底"}
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

  return (
    <Card
      variant="outlined"
      className="w-full lg:w-4/5 bg-slate-900/70 border-slate-700 text-slate-50"
      sx={{ maxHeight: 760, display: "flex", flexDirection: "column" }}
    >
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 inline-block" />
            <Typography variant="subtitle1" className="text-slate-100">
              {currentRoom && currentRoom.name}
            </Typography>
            <Chip
              size="small"
              label={`${participants.length} 人`}
              color="success"
              variant="outlined"
            />
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
                前往遊戲
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
                  // 不讓 React 去管 Promise → 用 void 吃掉
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
        {/* 成員列表 */}
        <Box>
          <Typography
            variant="subtitle2"
            className="text-slate-200"
            gutterBottom
          >
            成員
          </Typography>
          {participants.length === 0 ? (
            <Typography variant="body2" className="text-slate-500">
              目前無成員
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
                          <span className="opacity-80 text-[10px]">（我）</span>
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

        {/* 聊天區 */}
        <Box
          sx={{
            flex: 1,
            border: "1px solid #1f2937",
            borderRadius: 2,
            backgroundColor: "rgba(15,23,42,0.6)",
            p: 1.5,
            overflowY: "auto",
          }}
        >
          {messages.length === 0 ? (
            <Typography
              variant="body2"
              className="text-slate-500"
              align="center"
            >
              目前還沒有訊息，先打個招呼吧！
            </Typography>
          ) : (
            <MUIList dense disablePadding>
              {messages.map((msg) => {
                const isSelf = msg.username === username;
                return (
                  <ListItem
                    key={msg.id}
                    sx={{
                      justifyContent: isSelf ? "flex-end" : "flex-start",
                      textAlign: isSelf ? "right" : "left",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "75%",
                        borderRadius: 3,
                        px: 1.5,
                        py: 1,
                        bgcolor: isSelf ? "primary.dark" : "#334155",
                        color: "white",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="space-between"
                      >
                        <Typography variant="caption" fontWeight={600}>
                          {msg.username}
                          {isSelf && "（我）"}
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
                        sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
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

        {/* 輸入列 */}
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="輸入訊息後按 Enter 或點 Send"
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

        {/* 播放清單虛擬列表 */}
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
                label={`${playlistProgress.received}/${playlistProgress.total}${
                  playlistProgress.ready ? " · 已完成" : ""
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
              尚無歌曲或尚未載入。
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

export default ChatPanel;
