import { Google } from "@mui/icons-material";
import { Box, Button, TextField, Typography } from "@mui/material";
import React from "react";

interface LoginPageProps {
  usernameInput: string;
  onInputChange: (value: string) => void;
  onConfirm: () => void;
  onGoogleLogin: () => void;
  googleLoading?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({
  usernameInput,
  onInputChange,
  onConfirm,
  onGoogleLogin,
  googleLoading = false,
}) => (
  <Box
    display={"flex"}
    justifyContent={"center"}
    gap={10}
    py={5}
    border={"1px solid gray"}
    borderRadius={"5px"}
  >
    <Box display={"flex"} flexDirection={"column"} gap={1}>
      <Typography variant="h5">訪客遊玩</Typography>
      <Typography variant="caption">輸入暱稱，快速開始</Typography>
      <TextField
        size="small"
        label="暱稱"
        variant="filled"
        placeholder=""
        value={usernameInput}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <Button
        variant="contained"
        onClick={onConfirm}
        className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm shadow-sky-900/60 transition-colors"
      >
        開始遊玩
      </Button>
    </Box>

    <Box display={"flex"} flexDirection={"column"} gap={1}>
      <Typography variant="h5">Google 登入</Typography>
      <Typography variant="caption">可保存收藏庫，跨裝置同步</Typography>
      <Button
        sx={{ gap: 1 }}
        variant="contained"
        onClick={onGoogleLogin}
        disabled={googleLoading}
        className="w-full cursor-pointer px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-900/40 transition-colors disabled:opacity-60"
      >
        <Google />
        {googleLoading ? "登入中..." : "使用 Google 登入"}
      </Button>
    </Box>
  </Box>
);

export default LoginPage;
