import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRoom } from "../../features/Room/useRoom";
import Invited from "../../features/Invited/Invited";
import type { RoomSummary } from "../../features/Room/types";

const InvitedPage: React.FC = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const {
    username,
    rooms,
    currentRoom,
    joinPasswordInput,
    inviteNotFound,
    setJoinPasswordInput,
    setInviteRoomId,
    fetchRoomById,
    handleJoinRoom,
  } = useRoom();

  const [inviteRoomApi, setInviteRoomApi] = useState<{
    roomId: string;
    room: RoomSummary | null;
  } | null>(null);

  useEffect(() => {
    setInviteRoomId(roomId ?? null);
    return () => setInviteRoomId(null);
  }, [roomId, setInviteRoomId]);

  useEffect(() => {
    let active = true;
    if (!roomId) return;
    void fetchRoomById(roomId).then((room) => {
      if (!active) return;
      setInviteRoomApi({ roomId, room });
    });
    return () => {
      active = false;
    };
  }, [roomId, fetchRoomById]);

  useEffect(() => {
    if (currentRoom?.id) {
      navigate(`/rooms/${currentRoom.id}`, { replace: true });
    }
  }, [currentRoom?.id, navigate]);

  const inviteRoom = useMemo(() => {
    const apiRoom =
      inviteRoomApi && inviteRoomApi.roomId === roomId
        ? inviteRoomApi.room
        : null;
    if (apiRoom) return apiRoom;
    return roomId ? (rooms.find((room) => room.id === roomId) ?? null) : null;
  }, [inviteRoomApi, roomId, rooms]);

  return (
    <div className="flex gap-4 flex-row justify-center">
      {!currentRoom?.id && username && (
        <Invited
          joinPassword={joinPasswordInput}
          inviteRoom={inviteRoom}
          inviteRoomId={roomId ?? null}
          inviteNotFound={inviteNotFound}
          onJoinPasswordChange={setJoinPasswordInput}
          onJoinRoom={handleJoinRoom}
        />
      )}
    </div>
  );
};

export default InvitedPage;
