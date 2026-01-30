import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";

import { useRoom } from "../../features/Room/useRoom";
import RoomCreationSection from "../../features/Room/components/RoomCreationSection";

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
    return `已載入 ${playlistItems.length} 首`;
  }, [playlistItems.length]);

  const privacyLabel = roomPasswordInput.trim() ? "需密碼" : "公開房間";

  return (
    <div className="flex gap-4 flex-row justify-center">
      {!currentRoom?.id && username && (
        <div className="w-full md:w-full lg:w-full room-create-page">
          <div className="room-create-disc" aria-hidden />
          <div className="room-create-header">
            <div>
              <p className="room-create-kicker">Studio Session</p>
              <h2 className="room-create-title">建立房間</h2>
              <p className="room-create-subtitle">
                用一份歌單啟動對戰，把朋友拖進同一張唱片裡。
              </p>
            </div>
            <Button
              variant="outlined"
              size="small"
              className="room-create-ghost"
              onClick={() => navigate("/rooms", { replace: true })}
            >
              返回房間列表
            </Button>
          </div>

          <div className="room-create-grid">
            <div className="room-create-side">
              <div className="room-create-stats">
                <div className="room-create-stat">
                  <span>播放清單</span>
                  <div>{playlistSummary}</div>
                </div>
                <div className="room-create-stat">
                  <span>題數設定</span>
                  <div>{questionCount} 題</div>
                </div>
                <div className="room-create-stat">
                  <span>隱私</span>
                  <div>{privacyLabel}</div>
                </div>
              </div>

              <div className="room-create-steps">
                <div className="room-create-step">
                  <strong>01</strong>
                  <div>輸入房間名稱，設定需要密碼的話用英數。</div>
                </div>
                <div className="room-create-step">
                  <strong>02</strong>
                  <div>匯入 YouTube 播放清單，載入後可調整題數。</div>
                </div>
                <div className="room-create-step">
                  <strong>03</strong>
                  <div>確認清單後點擊建立，房間立即開場。</div>
                </div>
              </div>

              <div className="room-create-badge">
                {playlistLocked ? "清單鎖定中" : "清單可編輯"}
              </div>
            </div>

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
      )}
    </div>
  );
};

export default RoomCreatePage;
