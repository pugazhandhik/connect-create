import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Shield, Users, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { generateRoomCode } from '@/lib/webrtc';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinRoom = async () => {
    if (!roomName.trim()) {
      toast({
        title: 'Room name required',
        description: 'Please enter a room name to join or create.',
        variant: 'destructive',
      });
      return;
    }

    if (!displayName.trim()) {
      toast({
        title: 'Display name required',
        description: 'Please enter your name to join the room.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if room exists
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomName.toUpperCase())
        .single();

      let roomId: string;
      let roomCode: string;

      if (existingRoom) {
        roomId = existingRoom.id;
        roomCode = existingRoom.room_code;
      } else {
        // Create new room
        roomCode = roomName.toUpperCase() || generateRoomCode();
        const { data: newRoom, error } = await supabase
          .from('rooms')
          .insert({
            room_code: roomCode,
            name: roomName,
          })
          .select()
          .single();

        if (error) throw error;
        roomId = newRoom.id;
      }

      navigate(`/waiting/${roomCode}?name=${encodeURIComponent(displayName)}&roomId=${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: 'Error',
        description: 'Failed to join room. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gd-gradient-bg relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="gd-blob absolute -top-32 -left-32 w-96 h-96" />
      <div className="gd-blob absolute -bottom-32 -right-32 w-96 h-96" />
      <div className="gd-blob absolute top-1/3 -right-48 w-80 h-80" />
      <div className="gd-blob absolute bottom-1/3 -left-48 w-80 h-80" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="gd-card p-8 w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">GD</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">GD Platform</h1>
              <p className="text-sm text-muted-foreground">
                Natural, calm, and collaborative group discussions.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4 mt-8">
            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">
                Your name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="bg-background border-border"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-card-foreground mb-2 block">
                Room name
              </label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter or create a room"
                className="bg-background border-border"
              />
            </div>

            <Button
              onClick={handleJoinRoom}
              disabled={isLoading}
              className="w-full gd-btn-primary gap-2"
            >
              <ArrowDown className="w-4 h-4" />
              {isLoading ? 'Joining...' : 'Join Room'}
            </Button>
          </div>

          {/* Features */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Shield className="w-3 h-3" />
              SECURE
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Users className="w-3 h-3" />
              PEER TO PEER
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Zap className="w-3 h-3" />
              REAL-TIME
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
