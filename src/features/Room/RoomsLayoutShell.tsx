import React from "react";
import { Outlet } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
} from "@mui/material";

import HeaderSection from "./components/HeaderSection";
import LoginPage from "./components/LoginPage";
import { useRoom } from "./useRoom";

const RoomsLayoutShell: React.FC = () => {
  const {
    authLoading,
    authUser,
    loginWithGoogle,
    logout,
    needsNicknameConfirm,
    nicknameDraft,
    setNicknameDraft,
    confirmNickname,
    isProfileEditorOpen,
    openProfileEditor,
    closeProfileEditor,
    displayUsername,
    isConnected,
    statusText,
    username,
    usernameInput,
    setUsernameInput,
    handleSetUsername,
  } = useRoom();

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 justify-center items-start p-4">
      <div className="flex flex-col w-95/100 space-y-4">
          <HeaderSection
            serverUrl={
              import.meta.env.VITE_SOCKET_URL ||
              (typeof window !== "undefined" ? window.location.origin : "")
            }
            isConnected={isConnected}
            displayUsername={displayUsername}
          authUser={authUser}
          authLoading={authLoading}
          onLogin={loginWithGoogle}
          onLogout={logout}
          onEditProfile={openProfileEditor}
        />

        {!username && !authUser && (
          <LoginPage
            usernameInput={usernameInput}
            onInputChange={setUsernameInput}
            onConfirm={handleSetUsername}
            onGoogleLogin={loginWithGoogle}
            googleLoading={authLoading}
          />
        )}

        <Outlet />
        <footer className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
          <a href="/privacy" className="hover:text-slate-200">隱私權政策</a>
          <span className="text-slate-600">·</span>
          <a href="/terms" className="hover:text-slate-200">服務條款</a>
        </footer>

        {statusText && (
          <Snackbar message={`Status: ${statusText}`} open={true} />
        )}
        <Dialog
          open={needsNicknameConfirm || isProfileEditorOpen}
          onClose={() => {
            if (!needsNicknameConfirm) {
              closeProfileEditor();
            }
          }}
        >
          <DialogTitle>
            {needsNicknameConfirm ? "首次登入設定暱稱" : "編輯個人資料"}
          </DialogTitle>
          <DialogContent>
            <p className="text-sm text-slate-300 mb-2">
              {needsNicknameConfirm
                ? "初次 Google 登入可修改暱稱，之後也可以再改。"
                : "更新你在遊戲中顯示的暱稱。"}
            </p>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-500/60"
              placeholder="請輸入暱稱"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            {!needsNicknameConfirm && (
              <Button onClick={closeProfileEditor} variant="outlined">
                取消
              </Button>
            )}
            <Button onClick={confirmNickname} variant="contained">
              儲存
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default RoomsLayoutShell;
