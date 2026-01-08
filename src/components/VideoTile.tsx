import { useEffect, useRef } from 'react';
import { User } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream;
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
}

const VideoTile = ({ stream, displayName, isLocal = false, isMuted = false }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="gd-video-tile group">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primary">
          <div className="text-center">
            <User className="w-16 h-16 text-primary-foreground/50 mx-auto mb-2" />
            <p className="text-primary-foreground/70">Connecting...</p>
          </div>
        </div>
      )}
      
      {/* Name badge */}
      <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur-sm px-3 py-1 rounded-lg">
        <span className="text-sm font-medium text-card-foreground">
          {isLocal ? 'You' : displayName}
        </span>
      </div>
    </div>
  );
};

export default VideoTile;
