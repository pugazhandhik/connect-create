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
  const localStreamRef = useRef<MediaStream | null>(null);

  const participantId = participantIdRef.current;

  // Send signaling data
  const sendSignal = useCallback(async (targetId: string | null, signalType: string, signalData: any) => {
    await supabase.from('signaling').insert({
      room_id: roomId,
      sender_id: participantId,
      target_id: targetId,
      signal_type: signalType,
      signal_data: signalData,
    });
  }, [roomId, participantId]);

  // Create peer connection for a remote participant
  const createPeerForParticipant = useCallback(async (remoteParticipantId: string, remoteDisplayName: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(remoteParticipantId)) {
      return peerConnectionsRef.current.get(remoteParticipantId);
    }

    const pc = createPeerConnection();
    peerConnectionsRef.current.set(remoteParticipantId, pc);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev => prev.map(p => 
        p.id === remoteParticipantId ? { ...p, stream: remoteStream } : p
      ));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteParticipantId, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteParticipantId}:`, pc.connectionState);
    };

    // If we are the initiator, create and send offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(remoteParticipantId, 'offer', {
        sdp: pc.localDescription?.toJSON(),
      });
    }

    return pc;
  }, [sendSignal]);

  // Handle incoming signaling messages
  const handleSignal = useCallback(async (signal: any) => {
    const { sender_id, signal_type, signal_data } = signal;

    if (sender_id === participantId) return;

    let pc = peerConnectionsRef.current.get(sender_id);

    if (signal_type === 'offer') {
      // Create peer connection if doesn't exist
      if (!pc) {
        pc = await createPeerForParticipant(sender_id, 'Participant', false);
      }
      
      if (pc && signal_data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal_data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(sender_id, 'answer', {
          sdp: pc.localDescription?.toJSON(),
        });
      }
    } else if (signal_type === 'answer') {
      if (pc && signal_data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal_data.sdp));
      }
    } else if (signal_type === 'ice-candidate') {
      if (pc && signal_data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal_data.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    }
  }, [participantId, createPeerForParticipant, sendSignal]);

  // Initialize local stream and join room
  useEffect(() => {
    let mounted = true;

    const initRoom = async () => {
      try {
        // Get local media stream
        const stream = await getLocalStream();
        if (!mounted) return;
        
        localStreamRef.current = stream;
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
            { event: 'INSERT', schema: 'public', table: 'signaling', filter: `room_id=eq.${roomId}` },
            (payload) => {
              const signal = payload.new as any;
              // Only process signals meant for us or broadcast signals
              if (signal.target_id === participantId || signal.target_id === null) {
                handleSignal(signal);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            async (payload) => {
              const newParticipant = payload.new as any;
              if (newParticipant.participant_id !== participantId) {
                // Add to participants list
                setParticipants(prev => {
                  if (prev.find(p => p.id === newParticipant.participant_id)) return prev;
                  return [...prev, {
                    id: newParticipant.participant_id,
                    displayName: newParticipant.display_name,
                  }];
                });
                
                // Initiate peer connection with new participant
                await createPeerForParticipant(
                  newParticipant.participant_id, 
                  newParticipant.display_name, 
                  true
                );
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
            (payload) => {
              const removed = payload.old as any;
              setParticipants(prev => prev.filter(p => p.id !== removed.participant_id));
              
              // Close peer connection
              const pc = peerConnectionsRef.current.get(removed.participant_id);
              if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(removed.participant_id);
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
        setIsConnected(true);

        // Load existing participants and initiate connections
        const { data: existingParticipants } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomId);

        if (existingParticipants) {
          for (const p of existingParticipants) {
            if (p.participant_id !== participantId) {
              setParticipants(prev => {
                if (prev.find(part => part.id === p.participant_id)) return prev;
                return [...prev, {
                  id: p.participant_id,
                  displayName: p.display_name,
                }];
              });
              
              // Initiate peer connection with existing participant
              await createPeerForParticipant(p.participant_id, p.display_name, true);
            }
          }
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
  }, [roomId, displayName, participantId, handleSignal, createPeerForParticipant]);

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
