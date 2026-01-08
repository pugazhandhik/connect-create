import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createPeerConnection, getLocalStream, generateParticipantId } from '@/lib/webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Participant {
  id: string;
  displayName: string;
  stream?: MediaStream;
  isLocal?: boolean;
}

interface Message {
  id: string;
  senderName: string;
  content: string;
  createdAt: Date;
}

interface UseRoomReturn {
  participants: Participant[];
  messages: Message[];
  localStream: MediaStream | null;
  isConnected: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  sendMessage: (content: string) => Promise<void>;
  leaveRoom: () => void;
  participantId: string;
  displayName: string;
}

export const useRoom = (roomId: string, displayName: string): UseRoomReturn => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const participantIdRef = useRef(generateParticipantId());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const participantId = participantIdRef.current;

  // Initialize local stream and join room
  useEffect(() => {
    let mounted = true;

    const initRoom = async () => {
      try {
        // Get local media stream
        const stream = await getLocalStream();
        if (!mounted) return;
        
        setLocalStream(stream);
        setParticipants([{
          id: participantId,
          displayName,
          stream,
          isLocal: true,
        }]);

        // Register participant in database
        await supabase.from('participants').upsert({
          room_id: roomId,
          participant_id: participantId,
          display_name: displayName,
        });

        // Load existing messages
        const { data: existingMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (existingMessages) {
          setMessages(existingMessages.map(m => ({
            id: m.id,
            senderName: m.sender_name,
            content: m.content,
            createdAt: new Date(m.created_at),
          })));
        }

        // Subscribe to realtime updates
        const channel = supabase
          .channel(`room:${roomId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
            (payload) => {
              const newMessage = payload.new as any;
              setMessages(prev => [...prev, {
                id: newMessage.id,
                senderName: newMessage.sender_name,
                content: newMessage.content,
                createdAt: new Date(newMessage.created_at),
              }]);
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            (payload) => {
              const newParticipant = payload.new as any;
              if (newParticipant.participant_id !== participantId) {
                setParticipants(prev => {
                  if (prev.find(p => p.id === newParticipant.participant_id)) return prev;
                  return [...prev, {
                    id: newParticipant.participant_id,
                    displayName: newParticipant.display_name,
                  }];
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            (payload) => {
              const removed = payload.old as any;
              setParticipants(prev => prev.filter(p => p.id !== removed.participant_id));
            }
          )
          .subscribe();

        channelRef.current = channel;
        setIsConnected(true);

        // Load existing participants
        const { data: existingParticipants } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomId);

        if (existingParticipants) {
          setParticipants(prev => {
            const existing = new Set(prev.map(p => p.id));
            const newParticipants = existingParticipants
              .filter(p => !existing.has(p.participant_id))
              .map(p => ({
                id: p.participant_id,
                displayName: p.display_name,
              }));
            return [...prev, ...newParticipants];
          });
        }
      } catch (error) {
        console.error('Error initializing room:', error);
      }
    };

    initRoom();

    return () => {
      mounted = false;
      // Cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [roomId, displayName, participantId]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(prev => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(prev => !prev);
    }
  }, [localStream]);

  const sendMessage = useCallback(async (content: string) => {
    await supabase.from('messages').insert({
      room_id: roomId,
      sender_name: displayName,
      content,
    });
  }, [roomId, displayName]);

  const leaveRoom = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Remove participant from database
    supabase.from('participants')
      .delete()
      .eq('room_id', roomId)
      .eq('participant_id', participantId)
      .then(() => {});

    // Cleanup channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Close peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    setIsConnected(false);
  }, [localStream, roomId, participantId]);

  return {
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
    participantId,
    displayName,
  };
};
