import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RoomHeaderProps {
  roomCode: string;
  participantCount: number;
}

const RoomHeader = ({ roomCode, participantCount }: RoomHeaderProps) => {
  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">GD</span>
        </div>
        <div>
          <h1 className="font-semibold text-card-foreground">GD Platform</h1>
          <p className="text-xs text-muted-foreground">Group Discussion Rooms</p>
        </div>
      </div>

      {/* Room Info */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-sm px-3 py-1">
          ROOM: {roomCode}
        </Badge>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm">{participantCount} participant(s)</span>
        </div>
      </div>
    </header>
  );
};

export default RoomHeader;
