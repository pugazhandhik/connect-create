import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ControlBarProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onShareScreen?: () => void;
}

const ControlBar = ({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  onShareScreen,
}: ControlBarProps) => {
  return (
    <div className="gd-control-bar flex items-center gap-3">
      {/* Mute/Unmute */}
      <Button
        variant={isAudioEnabled ? 'secondary' : 'outline'}
        size="lg"
        onClick={onToggleAudio}
        className="gap-2 rounded-full"
      >
        {isAudioEnabled ? (
          <>
            <Mic className="w-5 h-5" />
            <span>Mute</span>
          </>
        ) : (
          <>
            <MicOff className="w-5 h-5" />
            <span>Unmute</span>
          </>
        )}
      </Button>

      {/* Video On/Off */}
      <Button
        variant={isVideoEnabled ? 'secondary' : 'outline'}
        size="lg"
        onClick={onToggleVideo}
        className="gap-2 rounded-full"
      >
        {isVideoEnabled ? (
          <>
            <Video className="w-5 h-5" />
            <span>Stop Video</span>
          </>
        ) : (
          <>
            <VideoOff className="w-5 h-5" />
            <span>Start Video</span>
          </>
        )}
      </Button>

      {/* Screen Share */}
      {onShareScreen && (
        <Button
          variant="secondary"
          size="lg"
          onClick={onShareScreen}
          className="gap-2 rounded-full"
        >
          <Monitor className="w-5 h-5" />
          <span>Share</span>
        </Button>
      )}

      {/* End Call */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onEndCall}
        className="gap-2 rounded-full"
      >
        <PhoneOff className="w-5 h-5" />
        <span>End</span>
      </Button>
    </div>
  );
};

export default ControlBar;
