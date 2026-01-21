import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWaitingRoom } from '@/hooks/useWaitingRoom';
import { supabase } from '@/integrations/supabase/client';

const WaitingRoom = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const displayName = searchParams.get('name') || 'Guest';
  const roomId = searchParams.get('roomId') || '';

  // Generate a unique participant ID for this session
  const participantId = useMemo(() => {
    const stored = sessionStorage.getItem(`participant-${roomId}`);
    if (stored) return stored;
    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(`participant-${roomId}`, newId);
    return newId;
  }, [roomId]);

  const {
    participants,
    timeRemaining,
    isReady,
    leaveWaitingRoom,
  } = useWaitingRoom(roomId, displayName, participantId);

  // Format time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  // Auto-navigate to GD room when timer ends
  useEffect(() => {
    if (isReady) {
      const moveToGDRoom = async () => {
        // Clean up waiting room entry
        await leaveWaitingRoom();

        // Update session status to active
        await supabase
          .from('gd_sessions')
          .update({ status: 'active' })
          .eq('room_id', roomId);

        // Navigate to the actual room
        navigate(`/room/${roomCode}?name=${encodeURIComponent(displayName)}&roomId=${roomId}`);
      };

      moveToGDRoom();
    }
  }, [isReady, roomCode, roomId, displayName, navigate, leaveWaitingRoom]);

  // Redirect if missing required params
  useEffect(() => {
    if (!roomCode || !roomId) {
      navigate('/');
    }
  }, [roomCode, roomId, navigate]);

  const handleLeave = async () => {
    await leaveWaitingRoom();
    navigate('/');
  };

  if (!roomCode) return null;

  return (
    <div className="min-h-screen gd-gradient-bg relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="gd-blob absolute -top-32 -left-32 w-96 h-96" />
      <div className="gd-blob absolute -bottom-32 -right-32 w-96 h-96" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="gd-card p-8 w-full max-w-lg text-center">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-card-foreground">Waiting Room</h1>
              <p className="text-sm text-muted-foreground">Room: {roomCode}</p>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-muted/50 rounded-2xl p-8 mb-6">
            <p className="text-sm text-muted-foreground mb-2">GD starts in</p>
            <div className="text-6xl font-bold text-primary font-mono">
              {formattedTime}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Please wait for other participants to join
            </p>
          </div>

          {/* Participants */}
          <div className="bg-muted/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''} waiting</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {participants.map((participant) => (
                <div
                  key={participant.participant_id}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    participant.participant_id === participantId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {participant.display_name}
                  {participant.participant_id === participantId && ' (You)'}
                </div>
              ))}
            </div>
          </div>

          {/* Leave Button */}
          <Button
            variant="outline"
            onClick={handleLeave}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Waiting Room
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
