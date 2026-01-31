import React from "react";

import type { RoomSummary } from "../Room/model/types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

interface InvitedPageProps {
  joinPassword: string;
  inviteRoom: RoomSummary | null;
  inviteRoomId: string | null;
  inviteNotFound: boolean;
  onJoinPasswordChange: (value: string) => void;
  onJoinRoom: (roomId: string, hasPassword: boolean) => void;
}

const InvitedPage: React.FC<InvitedPageProps> = ({
  joinPassword,
  inviteRoom,
  inviteRoomId,
  inviteNotFound,
  onJoinPasswordChange,
  onJoinRoom,
}) => {
  return (
    <Box width={"50%"}>
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
              受邀房間不存在或已關閉
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
                  目前 {inviteRoom.playerCount} 人・清單{" "}
                  {inviteRoom.playlistCount} 首・
                  {inviteRoom.hasPassword ? "需要密碼" : "無需密碼"}
                </Typography>
                <Typography variant="caption" className="text-slate-300">
                  題數 {inviteRoom.gameSettings?.questionCount ?? "-"}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {inviteRoom.hasPassword && (
                    <TextField
                      size="small"
                      label="房間密碼"
                      variant="outlined"
                      value={joinPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!/^[a-zA-Z0-9]*$/.test(value)) return;
                        onJoinPasswordChange(value);
                      }}
                      className="bg-slate-950"
                      inputProps={{
                        inputMode: "text",
                        pattern: "[A-Za-z0-9]*",
                      }}
                    />
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      onJoinRoom(inviteRoom.id, inviteRoom.hasPassword)
                    }
                  >
                    加入房間
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default InvitedPage;
