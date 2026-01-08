import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import VideoTile from '@/components/VideoTile';
import ChatPanel from '@/components/ChatPanel';
import ControlBar from '@/components/ControlBar';
import RoomHeader from '@/components/RoomHeader';

const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const displayName = searchParams.get('name') || 'Guest';
  const roomId = searchParams.get('roomId') || '';

  const {
    participants,
    messages,
    localStream,
    isConnected,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    sendMessage,
    leaveRoom,
  } = useRoom(roomId, displayName);

  const handleEndCall = () => {
    leaveRoom();
    navigate('/');
  };

  useEffect(() => {
    if (!roomCode || !roomId) {
      navigate('/');
    }
  }, [roomCode, roomId, navigate]);

  if (!roomCode) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <RoomHeader roomCode={roomCode} participantCount={participants.length} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 flex flex-col">
          <div className={`flex-1 grid gap-4 ${
            participants.length === 1 ? 'grid-cols-1' :
            participants.length <= 4 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
            {participants.map((participant) => (
              <VideoTile
                key={participant.id}
                stream={participant.stream}
                displayName={participant.displayName}
                isLocal={participant.isLocal}
              />
            ))}
          </div>

          {/* Control Bar */}
          <div className="flex justify-center pt-4">
            <ControlBar
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onEndCall={handleEndCall}
            />
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 hidden lg:block">
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            currentUserName={displayName}
          />
        </div>
      </div>
    </div>
  );
};

export default Room;
