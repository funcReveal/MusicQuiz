import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useRoom } from "../model/useRoom";
import RoomCreationSection from "./components/RoomCreationSection";

const RoomCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    username,
    currentRoom,
    roomNameInput,
    roomPasswordInput,
    playlistUrl,
    playlistItems,
    playlistError,
    playlistLoading,
    playlistStage,
    playlistLocked,
    joinPasswordInput,
    playlistProgress,
    questionCount,
    questionMin,
    questionMaxLimit,
    questionStep,
    youtubePlaylists,
    youtubePlaylistsLoading,
    youtubePlaylistsError,
    collections,
    collectionsLoading,
    collectionsError,
    selectedCollectionId,
    collectionItemsLoading,
    collectionItemsError,
    authUser,
    loginWithGoogle,
    setRoomNameInput,
    setRoomPasswordInput,
    setJoinPasswordInput,
    setPlaylistUrl,
    updateQuestionCount,
    handleFetchPlaylist,
    handleResetPlaylist,
    fetchYoutubePlaylists,
    importYoutubePlaylist,
    fetchCollections,
    selectCollection,
    loadCollectionItems,
    handleCreateRoom,
    handleJoinRoom,
    resetCreateState,
  } = useRoom();

  useEffect(() => {
    resetCreateState();
  }, [resetCreateState]);

  useEffect(() => {
    if (currentRoom?.id) {
      navigate(`/rooms/${currentRoom.id}`, { replace: true });
    }
  }, [currentRoom?.id, navigate]);

  const playlistSummary = useMemo(() => {
    if (playlistItems.length === 0) return "尚未載入";
    return `已載入 ${playlistItems.length} 首曲目`;
  }, [playlistItems.length]);

  const privacyLabel = roomPasswordInput.trim() ? "私密房間" : "公開房間";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 text-[var(--mc-text)]">
      {!currentRoom?.id && username && (
        <section className="room-create-surface relative overflow-hidden rounded-[32px] border border-[var(--mc-border)] bg-[var(--mc-surface)]/80 p-6 shadow-[0_40px_80px_-40px_rgba(2,6,23,0.85)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 top-6 h-72 w-72 rounded-full bg-[var(--mc-accent)]/15 blur-[140px]" />
            <div className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[var(--mc-accent-2)]/15 blur-[160px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.85),transparent_55%)]" />
          </div>

          <div className="relative space-y-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.4em] text-[var(--mc-text-muted)]">
                  Room Builder
                </div>
                <h2 className="room-create-title mt-3 text-3xl font-semibold text-[var(--mc-text)] lg:text-4xl">
                  打造你的音樂房間
                </h2>
                <p className="mt-2 max-w-xl text-sm text-[var(--mc-text-muted)]">
                  選擇題庫、設定題數與房間權限，打造最適合的聆聽挑戰。
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-text)] transition hover:border-slate-500/80 hover:bg-[var(--mc-surface-strong)]/90"
                onClick={() => navigate("/rooms", { replace: true })}
              >
                返回房間列表
              </button>
            </header>

            <div className="grid gap-6 lg:grid-cols-[0.9fr,1.4fr]">
              <aside className="space-y-6">
                <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 p-5 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.8)]">
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
                    Session Stats
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                      <span>播放清單</span>
                      <span className="font-semibold text-[var(--mc-text)]">
                        {playlistSummary}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                      <span>題目數量</span>
                      <span className="font-semibold text-[var(--mc-text)]">
                        {questionCount} 題
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                      <span>房間權限</span>
                      <span className="font-semibold text-[var(--mc-accent-2)]">
                        {privacyLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 p-5">
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--mc-text-muted)]">
                    建立流程
                  </div>
                  <div className="mt-4 space-y-4 text-sm text-[var(--mc-text-muted)]">
                    <div className="flex gap-3">
                      <span className="text-xs font-semibold text-[var(--mc-text-muted)]">
                        01
                      </span>
                      <p>輸入房間名稱與權限，先完成房間基本設定。</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-xs font-semibold text-[var(--mc-text-muted)]">
                        02
                      </span>
                      <p>連結 YouTube 或收藏庫，匯入你想要的歌單。</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-xs font-semibold text-[var(--mc-text-muted)]">
                        03
                      </span>
                      <p>調整題數後立即啟動房間，邀請朋友加入。</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--mc-text-muted)]">
                  <span>Playlist</span>
                  <span className="text-[var(--mc-accent-2)]">
                    {playlistLocked ? "已鎖定" : "尚未鎖定"}
                  </span>
                </div>
              </aside>

              <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/70 p-5 shadow-[0_20px_60px_-30px_rgba(2,6,23,0.8)]">
                <RoomCreationSection
                  roomName={roomNameInput}
                  roomPassword={roomPasswordInput}
                  playlistUrl={playlistUrl}
                  playlistItems={playlistItems}
                  playlistError={playlistError}
                  playlistLoading={playlistLoading}
                  playlistStage={playlistStage}
                  playlistLocked={playlistLocked}
                  rooms={[]}
                  username={username}
                  currentRoomId={currentRoom?.id ?? null}
                  joinPassword={joinPasswordInput}
                  playlistProgress={playlistProgress}
                  questionCount={questionCount}
                  onQuestionCountChange={updateQuestionCount}
                  questionMin={questionMin}
                  questionMax={questionMaxLimit}
                  questionStep={questionStep}
                  questionControlsEnabled={playlistItems.length > 0}
                  youtubePlaylists={youtubePlaylists}
                  youtubePlaylistsLoading={youtubePlaylistsLoading}
                  youtubePlaylistsError={youtubePlaylistsError}
                  collections={collections}
                  collectionsLoading={collectionsLoading}
                  collectionsError={collectionsError}
                  selectedCollectionId={selectedCollectionId}
                  collectionItemsLoading={collectionItemsLoading}
                  collectionItemsError={collectionItemsError}
                  isGoogleAuthed={Boolean(authUser)}
                  onGoogleLogin={loginWithGoogle}
                  onRoomNameChange={setRoomNameInput}
                  onRoomPasswordChange={setRoomPasswordInput}
                  onJoinPasswordChange={setJoinPasswordInput}
                  onPlaylistUrlChange={setPlaylistUrl}
                  onFetchPlaylist={handleFetchPlaylist}
                  onResetPlaylist={handleResetPlaylist}
                  onFetchYoutubePlaylists={fetchYoutubePlaylists}
                  onImportYoutubePlaylist={importYoutubePlaylist}
                  onFetchCollections={fetchCollections}
                  onSelectCollection={selectCollection}
                  onLoadCollectionItems={loadCollectionItems}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  showRoomList={false}
                />
              </div>
            </div>
          </div>

          <style>
            {`
              @import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Sora:wght@400;500;600&display=swap");

              .room-create-surface {
                font-family: "Sora", "Noto Sans TC", sans-serif;
              }

              .room-create-title {
                font-family: "Fraunces", "Noto Serif TC", serif;
              }
            `}
          </style>
        </section>
      )}
    </div>
  );
};

export default RoomCreatePage;
