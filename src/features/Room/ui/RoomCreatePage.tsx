import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { type RoomCreateSourceMode } from "../model/RoomContext";
import { PLAYER_MAX, PLAYER_MIN } from "../model/roomConstants";
import { useRoom } from "../model/useRoom";
import RoomCreationSection from "./components/RoomCreationSection";

const sourceModeLabels: Record<RoomCreateSourceMode, string> = {
  link: "YouTube 連結",
  youtube: "我的播放清單",
  publicCollection: "公開收藏庫",
  privateCollection: "私人收藏庫",
};

const RoomCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    username,
    currentRoom,
    roomNameInput,
    roomVisibilityInput,
    roomCreateSourceMode,
    roomPasswordInput,
    roomMaxPlayersInput,
    playlistUrl,
    playlistItems,
    playlistError,
    playlistLoading,
    playlistStage,
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
    collectionScope,
    collectionsLastFetchedAt,
    selectedCollectionId,
    collectionItemsLoading,
    collectionItemsError,
    authUser,
    loginWithGoogle,
    setRoomNameInput,
    setRoomVisibilityInput,
    setRoomCreateSourceMode,
    setRoomPasswordInput,
    setRoomMaxPlayersInput,
    setJoinPasswordInput,
    setPlaylistUrl,
    updateQuestionCount,
    handleFetchPlaylist,
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

  const safeQuestionMin = questionMin ?? 1;
  const safeQuestionMax = questionMaxLimit ?? 100;
  const sourceModeLabel = sourceModeLabels[roomCreateSourceMode];

  const playlistSummary = useMemo(() => {
    if (playlistLoading) return "載入中";
    if (playlistItems.length === 0) return "尚未載入";
    return `已載入 ${playlistItems.length} 首`;
  }, [playlistItems.length, playlistLoading]);

  const sourceSummary = useMemo(() => {
    if (playlistItems.length > 0) {
      if (selectedCollectionId) return `收藏庫匯入（${sourceModeLabel}）`;
      if (roomCreateSourceMode === "youtube") return "我的 YouTube 播放清單";
      if (roomCreateSourceMode === "link") return "YouTube 連結匯入";
      return `${sourceModeLabel}匯入`;
    }

    switch (roomCreateSourceMode) {
      case "youtube":
        return authUser ? "等待選取播放清單" : "需先登入 Google";
      case "publicCollection":
        return "等待選取公開收藏庫";
      case "privateCollection":
        return authUser ? "等待選取私人收藏庫" : "需先登入 Google";
      default:
        return playlistUrl.trim() ? "待載入連結" : "待輸入連結";
    }
  }, [
    authUser,
    playlistItems.length,
    playlistUrl,
    roomCreateSourceMode,
    selectedCollectionId,
    sourceModeLabel,
  ]);

  const privacyLabel = roomVisibilityInput === "private" ? "私人房間" : "公開房間";
  const maxPlayersSummary = roomMaxPlayersInput.trim()
    ? `${roomMaxPlayersInput.trim()} 人`
    : "不限制";
  const collectionScopeLabel =
    collectionScope === "owner"
      ? "私人收藏庫"
      : collectionScope === "public"
        ? "公開收藏庫"
        : "尚未同步";

  const collectionsSyncTime = useMemo(() => {
    if (!collectionsLastFetchedAt) return "尚未同步";
    return new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(collectionsLastFetchedAt);
  }, [collectionsLastFetchedAt]);

  const setupChecklist = useMemo(
    () => [
      { key: "name", label: "房間名稱", done: roomNameInput.trim().length > 0 },
      { key: "playlist", label: "歌曲清單", done: playlistItems.length > 0 },
      {
        key: "question",
        label: "題數設定",
        done: questionCount >= safeQuestionMin && questionCount <= safeQuestionMax,
      },
    ],
    [
      playlistItems.length,
      questionCount,
      roomNameInput,
      safeQuestionMin,
      safeQuestionMax,
    ],
  );

  const workflowSteps = useMemo(
    () => [
      {
        id: "base",
        label: "基本設定",
        hint: "名稱、權限、題數",
        ready: setupChecklist[0]?.done ?? false,
      },
      {
        id: "playlist",
        label: "匯入歌曲",
        hint: "連結、YouTube 或收藏庫",
        ready: setupChecklist[1]?.done ?? false,
      },
      {
        id: "review",
        label: "確認預覽",
        hint: "建立後可分享邀請連結",
        ready: setupChecklist.every((item) => item.done),
      },
    ],
    [setupChecklist],
  );

  const completedCount = setupChecklist.filter((item) => item.done).length;
  const completionRate = Math.round((completedCount / setupChecklist.length) * 100);
  const setupComplete = completedCount === setupChecklist.length;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 pb-10 pt-6 text-[var(--mc-text)] sm:px-4">
      {!currentRoom?.id && username && (
        <section className="room-create-studio relative overflow-hidden rounded-[36px] border border-[var(--mc-border)] bg-[var(--mc-surface)]/88 p-5 shadow-[0_40px_90px_-46px_rgba(2,6,23,0.95)] sm:p-6 xl:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-[var(--mc-accent)]/18 blur-[130px]" />
            <div className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[var(--mc-accent-2)]/18 blur-[150px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(14,165,233,0.14),transparent_42%),radial-gradient(circle_at_82%_0%,rgba(34,197,94,0.14),transparent_36%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_22%,rgba(255,255,255,0.04)_82%,rgba(255,255,255,0))]" />
          </div>

          <div className="relative grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/72 p-5 shadow-[0_20px_55px_-34px_rgba(2,6,23,0.88)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[var(--mc-text-muted)]">
                  Room Studio
                </div>
                <h2 className="room-create-display mt-3 text-[2.15rem] leading-[1.08] text-[var(--mc-text)]">
                  創建你的
                  <br />
                  音樂對戰房
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--mc-text-muted)]">
                  以三步驟完成建房。左側固定摘要資訊，右側專注操作流程，減少視線切換與重複操作。
                </p>
                <button
                  type="button"
                  className="mt-5 inline-flex items-center rounded-full border border-[var(--mc-border)] bg-[var(--mc-surface-strong)]/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-text)] transition hover:border-slate-500/80 hover:bg-[var(--mc-surface-strong)]"
                  onClick={() => navigate("/rooms", { replace: true })}
                >
                  返回房間列表
                </button>
              </div>

              <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/72 p-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--mc-text-muted)]">
                  <span>完成度</span>
                  <span>{completedCount}/3</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/80">
                  <div
                    className="room-create-pulse h-full rounded-full bg-gradient-to-r from-amber-400/90 to-emerald-300/90 transition-[width] duration-300"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
                <ul className="mt-4 space-y-2.5">
                  {setupChecklist.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between rounded-xl border border-[var(--mc-border)]/80 bg-[var(--mc-surface-strong)]/35 px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--mc-text-muted)]">{item.label}</span>
                      <span
                        className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                          item.done ? "text-emerald-300" : "text-slate-400"
                        }`}
                      >
                        {item.done ? "Ready" : "Pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/72 p-5">
                <div className="text-xs uppercase tracking-[0.26em] text-[var(--mc-text-muted)]">
                  Session Snapshot
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>播放清單</span>
                    <span className="font-semibold text-[var(--mc-text)]">{playlistSummary}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>來源狀態</span>
                    <span className="font-semibold text-[var(--mc-text)]">{sourceSummary}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>來源模式</span>
                    <span className="font-semibold text-[var(--mc-accent-2)]">{sourceModeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>收藏庫同步</span>
                    <span className="font-semibold text-[var(--mc-text)]">{collectionScopeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>同步時間</span>
                    <span className="font-semibold text-[var(--mc-text)]">{collectionsSyncTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>題數範圍</span>
                    <span className="font-semibold text-[var(--mc-text)]">
                      {safeQuestionMin} - {safeQuestionMax}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>目前題數</span>
                    <span className="font-semibold text-[var(--mc-text)]">{questionCount} 題</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>房間權限</span>
                    <span className="font-semibold text-[var(--mc-accent-2)]">{privacyLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--mc-text-muted)]">
                    <span>人數限制</span>
                    <span className="font-semibold text-[var(--mc-text)]">{maxPlayersSummary}</span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-4">
              <div className="rounded-3xl border border-[var(--mc-border)] bg-[var(--mc-surface)]/58 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--mc-text-muted)]">
                    Build Workflow
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      setupComplete
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {setupComplete ? "準備完成" : "持續設定中"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--mc-text-muted)] sm:grid-cols-3">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="rounded-xl border border-[var(--mc-border)]/70 bg-[var(--mc-surface-strong)]/35 px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--mc-text-muted)]">
                        {`0${index + 1}`}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 font-semibold text-[var(--mc-text)]">
                        <span>{step.label}</span>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            step.ready ? "bg-emerald-300" : "bg-slate-500"
                          }`}
                        />
                      </div>
                      <div className="mt-1 text-xs">{step.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[var(--mc-border)] bg-[var(--mc-surface)]/72 p-4 shadow-[0_24px_64px_-36px_rgba(2,6,23,0.9)] sm:p-5">
                <RoomCreationSection
                  roomName={roomNameInput}
                  roomVisibility={roomVisibilityInput}
                  sourceMode={roomCreateSourceMode}
                  roomPassword={roomPasswordInput}
                  roomMaxPlayers={roomMaxPlayersInput}
                  playlistUrl={playlistUrl}
                  playlistItems={playlistItems}
                  playlistError={playlistError}
                  playlistLoading={playlistLoading}
                  playlistStage={playlistStage}
                  rooms={[]}
                  username={username}
                  currentRoomId={currentRoom?.id ?? null}
                  joinPassword={joinPasswordInput}
                  playlistProgress={playlistProgress}
                  questionCount={questionCount}
                  onQuestionCountChange={updateQuestionCount}
                  questionMin={safeQuestionMin}
                  questionMax={safeQuestionMax}
                  questionStep={questionStep}
                  questionControlsEnabled
                  youtubePlaylists={youtubePlaylists}
                  youtubePlaylistsLoading={youtubePlaylistsLoading}
                  youtubePlaylistsError={youtubePlaylistsError}
                  collections={collections}
                  collectionsLoading={collectionsLoading}
                  collectionsError={collectionsError}
                  collectionScope={collectionScope}
                  selectedCollectionId={selectedCollectionId}
                  collectionItemsLoading={collectionItemsLoading}
                  collectionItemsError={collectionItemsError}
                  isGoogleAuthed={Boolean(authUser)}
                  onGoogleLogin={loginWithGoogle}
                  onRoomNameChange={setRoomNameInput}
                  onRoomVisibilityChange={setRoomVisibilityInput}
                  onSourceModeChange={setRoomCreateSourceMode}
                  onRoomPasswordChange={setRoomPasswordInput}
                  onRoomMaxPlayersChange={setRoomMaxPlayersInput}
                  onJoinPasswordChange={setJoinPasswordInput}
                  onPlaylistUrlChange={setPlaylistUrl}
                  onFetchPlaylist={handleFetchPlaylist}
                  onFetchYoutubePlaylists={fetchYoutubePlaylists}
                  onImportYoutubePlaylist={importYoutubePlaylist}
                  onFetchCollections={fetchCollections}
                  onSelectCollection={selectCollection}
                  onLoadCollectionItems={loadCollectionItems}
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinRoom}
                  showRoomList={false}
                  playerMin={PLAYER_MIN}
                  playerMax={PLAYER_MAX}
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default RoomCreatePage;
