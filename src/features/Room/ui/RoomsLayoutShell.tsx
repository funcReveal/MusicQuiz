import React from "react";
import { Link, Outlet } from "react-router-dom";
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
import { useRoom } from "../model/useRoom";

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
    statusText,
    username,
    usernameInput,
    setUsernameInput,
    handleSetUsername,
  } = useRoom();

  return (
    <div className="flex min-h-screen bg-[var(--mc-bg)] text-[var(--mc-text)] justify-center items-start p-4">
      <div className="flex flex-col w-95/100 space-y-4">
        <HeaderSection
          displayUsername={displayUsername}
          authUser={authUser}
          authLoading={authLoading}
          onLogin={loginWithGoogle}
          onLogout={logout}
          onEditProfile={openProfileEditor}
        />

        {!authLoading && !username && !authUser && (
          <LoginPage
            usernameInput={usernameInput}
            onInputChange={setUsernameInput}
            onConfirm={handleSetUsername}
            onGoogleLogin={loginWithGoogle}
            googleLoading={authLoading}
          />
        )}

        <Outlet />

        <footer className="flex m-0 items-center justify-center gap-4 text-xs text-[var(--mc-text-muted)]">
          <Link to="/privacy" className="hover:text-[var(--mc-text)]">
            隱私權政策
          </Link>
          <span className="text-[var(--mc-border)]">•</span>
          <Link to="/terms" className="hover:text-[var(--mc-text)]">
            服務條款
          </Link>
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
            {needsNicknameConfirm ? "請設定暱稱" : "編輯個人資料"}
          </DialogTitle>
          <DialogContent>
            <p className="text-sm text-[var(--mc-text-muted)] mb-2">
              {needsNicknameConfirm
                ? "你已使用 Google 登入，請設定顯示暱稱。之後可在個人資料中修改。"
                : "請更新你的暱稱。"}
            </p>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--mc-surface-strong)] border border-[var(--mc-border)] outline-none focus:border-[var(--mc-accent)] focus:ring-1 focus:ring-[var(--mc-glow)]"
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
              確認
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default RoomsLayoutShell;
