import React, { useCallback, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
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
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";

type NavigationTarget = "rooms" | "collections";

const RoomsLayoutShell: React.FC = () => {
  const navigate = useNavigate();
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
    currentRoom,
    gameState,
    handleLeaveRoom,
    setStatusText,
  } = useRoom();
  const [loginConfirmOpen, setLoginConfirmOpen] = useState(false);
  const [navigationConfirmTarget, setNavigationConfirmTarget] =
    useState<NavigationTarget | null>(null);

  const loginConfirmText = useMemo(() => {
    if (gameState?.status === "playing") {
      return {
        title: "放棄本局並登入？",
        description:
          "目前正在遊戲中。若繼續登入，會先退出房間並放棄本局遊戲，接著返回房間列表。",
      };
    }
    return {
      title: "退出房間並登入？",
      description: "你目前在房間內。若繼續登入，會先退出房間並返回房間列表。",
    };
  }, [gameState?.status]);

  const startGoogleLogin = useCallback(() => {
    if (authLoading) return;
    loginWithGoogle();
  }, [authLoading, loginWithGoogle]);

  const handleLoginRequest = useCallback(() => {
    if (!currentRoom) {
      startGoogleLogin();
      return;
    }
    setLoginConfirmOpen(true);
  }, [currentRoom, startGoogleLogin]);

  const handleConfirmLogin = useCallback(() => {
    setLoginConfirmOpen(false);
    if (!currentRoom) {
      startGoogleLogin();
      return;
    }
    handleLeaveRoom(() => {
      navigate("/rooms", { replace: true });
      setStatusText("已退出房間，準備登入 Google");
      startGoogleLogin();
    });
  }, [currentRoom, handleLeaveRoom, navigate, setStatusText, startGoogleLogin]);

  const handleNavigateRequest = useCallback(
    (target: NavigationTarget) => {
      const path = target === "rooms" ? "/rooms" : "/collections";
      if (!currentRoom) {
        navigate(path);
        return;
      }
      setNavigationConfirmTarget(target);
    },
    [currentRoom, navigate],
  );

  const navigationConfirmText = useMemo(() => {
    if (!navigationConfirmTarget) return null;
    const targetLabel =
      navigationConfirmTarget === "rooms" ? "房間列表" : "收藏庫";
    if (gameState?.status === "playing") {
      return {
        title: `放棄本局並前往${targetLabel}？`,
        description: `目前正在遊戲中。若繼續，會先退出房間並放棄本局遊戲，再跳轉到${targetLabel}。`,
      };
    }
    return {
      title: `退出房間並前往${targetLabel}？`,
      description: `你目前在房間內。若繼續，會先退出房間，再跳轉到${targetLabel}。`,
    };
  }, [gameState?.status, navigationConfirmTarget]);

  const handleConfirmNavigation = useCallback(() => {
    const target = navigationConfirmTarget;
    setNavigationConfirmTarget(null);
    if (!target) return;
    const path = target === "rooms" ? "/rooms" : "/collections";
    if (!currentRoom) {
      navigate(path);
      return;
    }
    handleLeaveRoom(() => {
      navigate(path, { replace: target === "rooms" });
      setStatusText(
        target === "rooms"
          ? "已退出房間，返回房間列表"
          : "已退出房間，前往收藏庫",
      );
    });
  }, [
    currentRoom,
    handleLeaveRoom,
    navigate,
    navigationConfirmTarget,
    setStatusText,
  ]);

  return (
    <div className="flex min-h-screen bg-[var(--mc-bg)] text-[var(--mc-text)] justify-center items-start p-4">
      <div className="flex flex-col w-95/100 space-y-4">
        <HeaderSection
          displayUsername={displayUsername}
          authUser={authUser}
          authLoading={authLoading}
          onLogin={handleLoginRequest}
          onLogout={logout}
          onEditProfile={openProfileEditor}
          onNavigateRooms={() => handleNavigateRequest("rooms")}
          onNavigateCollections={() => handleNavigateRequest("collections")}
        />

        {!authLoading && !username && !authUser && (
          <LoginPage
            usernameInput={usernameInput}
            onInputChange={setUsernameInput}
            onConfirm={handleSetUsername}
            onGoogleLogin={handleLoginRequest}
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
        <ConfirmDialog
          open={loginConfirmOpen}
          title={loginConfirmText.title}
          description={loginConfirmText.description}
          confirmLabel="退出並登入"
          cancelLabel="取消"
          onConfirm={handleConfirmLogin}
          onCancel={() => setLoginConfirmOpen(false)}
        />
        <ConfirmDialog
          open={Boolean(navigationConfirmTarget)}
          title={navigationConfirmText?.title ?? ""}
          description={navigationConfirmText?.description ?? ""}
          confirmLabel="退出並前往"
          cancelLabel="取消"
          onConfirm={handleConfirmNavigation}
          onCancel={() => setNavigationConfirmTarget(null)}
        />
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
