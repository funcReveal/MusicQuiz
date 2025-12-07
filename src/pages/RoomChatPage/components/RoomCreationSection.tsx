import React from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
  inviteRoom: RoomSummary | null;
  inviteRoomId?: string | null;
  isInviteMode?: boolean;
  inviteNotFound?: boolean;
  questionCount: number;
  onQuestionCountChange: (value: number) => void;
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
  inviteRoom,
  inviteRoomId,
  isInviteMode = false,
  inviteNotFound = false,
  questionCount,
  onQuestionCountChange,
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

  const PlaylistRow = ({ index, style }: RowComponentProps) => {
    const item = playlistItems[index];
    return (
      <div style={style}>
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Avatar
              variant="rounded"
              src={item.thumbnail}
              sx={{ bgcolor: "#334155", width: 56, height: 56, fontSize: 14 }}
            >
              {index + 1}
            </Avatar>
            <div className="text-left">
              <p className="text-slate-100 text-sm">{item.title}</p>
              <p className="text-[11px] text-slate-400">
                {item.uploader ?? "Unknown"}
                {item.duration ? ` · ${item.duration}` : ""}
              </p>
            </div>
          </div>
          <Button
            size="small"
            variant="text"
            color="info"
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            開啟
          </Button>
        </div>
      </div>
    );
  };

  // 邀請模式：只顯示受邀卡片
  if (isInviteMode) {
    return (
      <Card
        variant="outlined"
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-50"
      >
        <CardContent className="space-y-3">
          {inviteRoomId && !inviteRoom && !inviteNotFound && (
            <Alert severity="info" variant="outlined">
              正在載入受邀房間資訊...
            </Alert>
          )}
          {inviteNotFound && (
            <Alert severity="error" variant="outlined">
              受邀房間不存在或已關閉。
            </Alert>
          )}
          {inviteRoom && (
            <Alert
              severity="info"
              variant="outlined"
              className="bg-sky-900/40 border-sky-600 text-slate-50"
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" className="text-slate-50">
                  房間：{inviteRoom.name}
                </Typography>
                <Typography variant="body2" className="text-slate-200">
                  玩家 {inviteRoom.playerCount} ・ 清單 {inviteRoom.playlistCount} 首{" "}
                  {inviteRoom.hasPassword ? "（需要密碼）" : "（無需密碼）"}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {inviteRoom.hasPassword && (
                    <TextField
                      size="small"
                      label="房間密碼"
                      variant="outlined"
                      value={joinPassword}
                      onChange={(e) => onJoinPasswordChange(e.target.value)}
                      className="bg-slate-950"
                    />
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => onJoinRoom(inviteRoom.id, inviteRoom.hasPassword)}
                  >
                    立即加入
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card
        variant="outlined"
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-50"
      >
        <CardHeader
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
        />
        <CardContent className="space-y-3">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="房間名稱"
              placeholder="例如：Quiz Room #1"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              disabled={!username}
            />
            <TextField
              size="small"
              label="密碼（選填）"
              placeholder="留空代表無需密碼"
              value={roomPassword}
              onChange={(e) => onRoomPasswordChange(e.target.value)}
              disabled={!username}
            />
            <TextField
              size="small"
              label="題數"
              type="number"
              inputProps={{ min: 1, max: 50 }}
              value={questionCount}
              onChange={(e) => onQuestionCountChange(Number(e.target.value) || 0)}
            />
            <Button
              variant="contained"
              color="success"
              disabled={!canCreateRoom}
              onClick={onCreateRoom}
            >
              建立房間
            </Button>
          </Stack>

          <Card variant="outlined" className="bg-slate-950/80 border-slate-800">
            <CardContent className="space-y-2">
              {showPlaylistInput ? (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="YouTube 播放清單網址"
                    placeholder="https://www.youtube.com/playlist?list=..."
                    value={playlistUrl}
                    onChange={(e) => onPlaylistUrlChange(e.target.value)}
                    disabled={!username || playlistLoading || playlistLocked}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={
                      !username || !playlistUrl || playlistLoading || playlistLocked
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
                      若要換清單，請按「重選播放清單」重新貼上。
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
                      rowHeight={96}
                      rowProps={{}}
                      rowComponent={PlaylistRow}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
                            label={`題數 ${room.gameSettings?.questionCount ?? "-"}`}
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
                          Players: {room.playerCount} ・ 清單 {room.playlistCount} 首 ・{" "}
                          {new Date(room.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {room.hasPassword && (
                          <TextField
                            size="small"
                            label="房間密碼"
                            value={joinPassword}
                            onChange={(e) => onJoinPasswordChange(e.target.value)}
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
