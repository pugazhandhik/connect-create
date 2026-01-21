import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WaitingParticipant {
  id: string;
  participant_id: string;
  display_name: string;
  joined_at: string;
}

interface UseWaitingRoomReturn {
  participants: WaitingParticipant[];
  timeRemaining: number;
  isReady: boolean;
  sessionStartedAt: Date | null;
  leaveWaitingRoom: () => Promise<void>;
}

const WAITING_DURATION_SECONDS = 120; // 2 minutes

export const useWaitingRoom = (
  roomId: string,
  displayName: string,
  participantId: string
): UseWaitingRoomReturn => {
  const [participants, setParticipants] = useState<WaitingParticipant[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(WAITING_DURATION_SECONDS);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const leaveWaitingRoom = useCallback(async () => {
    // Remove from waiting_room
    await supabase
      .from('waiting_room')
      .delete()
      .eq('room_id', roomId)
      .eq('participant_id', participantId);

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
  }, [roomId, participantId]);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const initWaitingRoom = async () => {
      // Check if a GD session exists for this room
      const { data: existingSession } = await supabase
        .from('gd_sessions')
        .select('*')
        .eq('room_id', roomId)
        .single();

      let sessionStart: Date;

      if (existingSession) {
        // Use existing session start time
        sessionStart = new Date(existingSession.started_at);
        setSessionStartedAt(sessionStart);
      } else {
        // Create new session - first person in the room
        sessionStart = new Date();
        const { error } = await supabase
          .from('gd_sessions')
          .insert({
            room_id: roomId,
            started_at: sessionStart.toISOString(),
            status: 'waiting',
          });

        if (error && error.code !== '23505') {
          // 23505 is unique violation - another user created it first
          console.error('Error creating session:', error);
        }

        // Re-fetch to get the actual session (in case of race condition)
        const { data: session } = await supabase
          .from('gd_sessions')
          .select('*')
          .eq('room_id', roomId)
          .single();

        if (session) {
          sessionStart = new Date(session.started_at);
          setSessionStartedAt(sessionStart);
        }
      }

      // Add self to waiting room
      await supabase
        .from('waiting_room')
        .upsert({
          room_id: roomId,
          participant_id: participantId,
          display_name: displayName,
        });

      // Fetch existing participants
      const { data: existingParticipants } = await supabase
        .from('waiting_room')
        .select('*')
        .eq('room_id', roomId);

      if (existingParticipants) {
        setParticipants(existingParticipants);
      }

      // Subscribe to waiting room changes
      channelRef.current = supabase
        .channel(`waiting-room-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waiting_room',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const newParticipant = payload.new as WaitingParticipant;
            setParticipants((prev) => {
              if (prev.some((p) => p.participant_id === newParticipant.participant_id)) {
                return prev;
              }
              return [...prev, newParticipant];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'waiting_room',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const oldParticipant = payload.old as WaitingParticipant;
            setParticipants((prev) =>
              prev.filter((p) => p.participant_id !== oldParticipant.participant_id)
            );
          }
        )
        .subscribe();
    };

    initWaitingRoom();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, displayName, participantId]);

  // Timer effect
  useEffect(() => {
    if (!sessionStartedAt) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - sessionStartedAt.getTime()) / 1000);
      const remaining = Math.max(0, WAITING_DURATION_SECONDS - elapsed);
      return remaining;
    };

    // Initial calculation
    const initialRemaining = calculateTimeRemaining();
    setTimeRemaining(initialRemaining);

    if (initialRemaining === 0) {
      setIsReady(true);
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setIsReady(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  return {
    participants,
    timeRemaining,
    isReady,
    sessionStartedAt,
    leaveWaitingRoom,
  };
};
