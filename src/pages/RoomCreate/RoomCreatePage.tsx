import { useEffect } from "react";
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
    setRoomNameInput,
    setRoomPasswordInput,
    setJoinPasswordInput,
    setPlaylistUrl,
    updateQuestionCount,
    handleFetchPlaylist,
    handleResetPlaylist,
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

  return (
    <div className="flex gap-4 flex-row justify-center">
      {!currentRoom?.id && username && (
        <div className="w-full md:w-full lg:w-3/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg text-slate-100 font-semibold">建立房間</h2>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate("/rooms", { replace: true })}
            >
              返回列表
            </Button>
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
            onRoomNameChange={setRoomNameInput}
            onRoomPasswordChange={setRoomPasswordInput}
            onJoinPasswordChange={setJoinPasswordInput}
            onPlaylistUrlChange={setPlaylistUrl}
            onFetchPlaylist={handleFetchPlaylist}
            onResetPlaylist={handleResetPlaylist}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            showRoomList={false}
          />
        </div>
      )}
    </div>
  );
};

export default RoomCreatePage;
