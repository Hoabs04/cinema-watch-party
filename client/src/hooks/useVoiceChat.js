import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * WebRTC P2P Audio Mesh hook with voice activity detection (VAD) and remote moderation support.
 */
export function useVoiceChat({ socket, roomId, currentUserId, users = [] }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micError, setMicError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection
  const audioElementsRef = useRef({}); // peerId -> HTMLAudioElement
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const isMutedRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const isDeafenedRef = useRef(false);

  const emitMicState = useCallback(
    (muted, speaking) => {
      if (!socket || !roomId) return;
      socket.emit('mic-state', { isMuted: muted, isSpeaking: speaking }, (res) => {
        if (res && res.error) {
          setMicError(res.error);
          // Re-mute locally if server rejected unmuting
          isMutedRef.current = true;
          setIsMuted(true);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
          }
        }
      });
    },
    [socket, roomId]
  );

  // Attach remote stream to hidden <audio> element
  const attachRemoteAudio = useCallback((peerId, stream) => {
    let audioEl = audioElementsRef.current[peerId];
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementsRef.current[peerId] = audioEl;
    }
    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }
    audioEl.muted = isDeafenedRef.current;
    audioEl.play().catch(() => {
      // Autoplay fallback handled when user interacts with page
    });
  }, []);

  // Remove and clean up a single peer connection
  const removePeer = useCallback((peerId) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      } catch {
        // ignore close errors
      }
      delete peersRef.current[peerId];
    }
    const audioEl = audioElementsRef.current[peerId];
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {
        // ignore cleanup errors
      }
      delete audioElementsRef.current[peerId];
    }
  }, []);

  // Create or get RTCPeerConnection for a target peer
  const getOrCreatePeer = useCallback(
    (peerId, isInitiator = false) => {
      if (peersRef.current[peerId]) {
        return peersRef.current[peerId];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[peerId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc-signal', {
            targetId: peerId,
            signalData: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          attachRemoteAudio(peerId, remoteStream);
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          removePeer(peerId);
        }
      };

      if (isInitiator) {
        pc.createOffer({
          offerToReceiveAudio: true,
        })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (socket && pc.localDescription) {
              socket.emit('webrtc-signal', {
                targetId: peerId,
                signalData: { type: 'offer', sdp: pc.localDescription },
              });
            }
          })
          .catch(() => {});
      }

      return pc;
    },
    [socket, attachRemoteAudio, removePeer]
  );

  // Setup Voice Activity Detection (VAD) on local stream
  const startVad = useCallback(
    (stream) => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = setInterval(() => {
          if (isMutedRef.current) {
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              emitMicState(true, false);
            }
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const speakingNow = avg > 18;

          if (speakingNow !== isSpeakingRef.current) {
            isSpeakingRef.current = speakingNow;
            setIsSpeaking(speakingNow);
            emitMicState(false, speakingNow);
          }
        }, 180);
      } catch {
        // Fallback if AudioContext fails
      }
    },
    [emitMicState]
  );

  // Ensure local microphone stream exists and add tracks to existing peers
  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Trình duyệt không hỗ trợ thu âm giọng nói (WebRTC).');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localStreamRef.current = stream;
    startVad(stream);

    // Add tracks to any already-connected peers and renegotiate
    Object.entries(peersRef.current).forEach(([peerId, pc]) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const alreadySent = senders.some((s) => s.track === track);
        if (!alreadySent) {
          pc.addTrack(track, stream);
        }
      });

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socket && pc.localDescription) {
            socket.emit('webrtc-signal', {
              targetId: peerId,
              signalData: { type: 'offer', sdp: pc.localDescription },
            });
          }
        })
        .catch(() => {});
    });

    return stream;
  }, [socket, startVad]);

  // Toggle Microphone On/Off
  const toggleMic = useCallback(async () => {
    setMicError(null);

    if (isMutedRef.current) {
      // Unmuting
      try {
        const stream = await ensureLocalStream();
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        isMutedRef.current = false;
        setIsMuted(false);

        // If user was deafened, undeafen when unmuting mic
        if (isDeafenedRef.current) {
          isDeafenedRef.current = false;
          setIsDeafened(false);
          Object.values(audioElementsRef.current).forEach((el) => {
            el.muted = false;
          });
        }

        emitMicState(false, false);

        // Ensure peer connections exist with all room users
        users.forEach((u) => {
          if (u.id && u.id !== currentUserId && !peersRef.current[u.id]) {
            getOrCreatePeer(u.id, true);
          }
        });
      } catch (err) {
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Bạn đã từ chối quyền truy cập Micro.'
            : err?.message || 'Không thể bật Micro.';
        setMicError(msg);
        isMutedRef.current = true;
        setIsMuted(true);
      }
    } else {
      // Muting
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      isMutedRef.current = true;
      setIsMuted(true);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      emitMicState(true, false);
    }
  }, [ensureLocalStream, emitMicState, users, currentUserId, getOrCreatePeer]);

  // Toggle Deafen (mute all incoming audio)
  const toggleDeafen = useCallback(() => {
    const nextDeafened = !isDeafenedRef.current;
    isDeafenedRef.current = nextDeafened;
    setIsDeafened(nextDeafened);

    Object.values(audioElementsRef.current).forEach((el) => {
      el.muted = nextDeafened;
    });
  }, []);

  // Connect with peers in the room deterministically
  useEffect(() => {
    if (!socket || !roomId || !currentUserId) return;

    users.forEach((user) => {
      if (!user.id || user.id === currentUserId) return;
      if (!peersRef.current[user.id]) {
        // Initiate offer if our socket ID is lexicographically smaller or if we have active stream
        const shouldInitiate =
          String(currentUserId) < String(user.id) || !isMutedRef.current;
        if (shouldInitiate) {
          getOrCreatePeer(user.id, true);
        }
      }
    });
  }, [users, socket, roomId, currentUserId, getOrCreatePeer]);

  // Listen to WebRTC signaling, peer-left, and force-muted events
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({ fromId, signalData }) => {
      if (!fromId || !signalData) return;
      try {
        const pc = getOrCreatePeer(fromId, false);

        if (signalData.type === 'offer' && signalData.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-signal', {
            targetId: fromId,
            signalData: { type: 'answer', sdp: pc.localDescription },
          });
        } else if (signalData.type === 'answer' && signalData.sdp) {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signalData.sdp)
            );
          }
        } else if (signalData.type === 'candidate' && signalData.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch {
        // Ignore transient signaling glare errors
      }
    };

    const handlePeerLeft = ({ peerId }) => {
      if (peerId) {
        removePeer(peerId);
      }
    };

    const handleForceMuted = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      isMutedRef.current = true;
      setIsMuted(true);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setMicError('Micro của bạn đã bị Quản trị viên tắt.');
    };

    socket.on('webrtc-signal', handleSignal);
    socket.on('peer-left', handlePeerLeft);
    socket.on('force-muted', handleForceMuted);

    return () => {
      socket.off('webrtc-signal', handleSignal);
      socket.off('peer-left', handlePeerLeft);
      socket.off('force-muted', handleForceMuted);
    };
  }, [socket, getOrCreatePeer, removePeer]);

  // Full cleanup on unmount or room leave
  useEffect(() => {
    return () => {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      Object.keys(peersRef.current).forEach((peerId) => {
        removePeer(peerId);
      });
    };
  }, [removePeer]);

  return {
    isMuted,
    isSpeaking,
    isDeafened,
    micError,
    toggleMic,
    toggleDeafen,
  };
}

export default useVoiceChat;
