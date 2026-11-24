import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * WebRTC Screen/Tab Share hook (video + tab audio) for watching Netflix,
 * restricted web movies, or private Facebook videos together.
 */
export function useScreenShare({ socket, roomId, currentUserId, users = [] }) {
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [sharerInfo, setSharerInfo] = useState(null); // { sharerId, sharerName }
  const [screenError, setScreenError] = useState('');

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const isSharingRef = useRef(false);

  const closeAllPeers = useCallback(() => {
    Object.values(peersRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    peersRef.current = {};
  }, []);

  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalScreenStream(null);
    isSharingRef.current = false;
    setIsSharingScreen(false);
    closeAllPeers();
    if (socket && roomId) {
      socket.emit('screen-share-state', { isSharing: false });
    }
  }, [socket, roomId, closeAllPeers]);

  const createPeerForViewer = useCallback(
    async (targetId, stream) => {
      if (!socket || !targetId || !stream) return;
      if (peersRef.current[targetId]) {
        try {
          peersRef.current[targetId].close();
        } catch {
          // ignore
        }
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[targetId] = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-signal', {
            targetId,
            signalData: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('screen-signal', {
          targetId,
          signalData: { type: 'sdp', sdp: pc.localDescription },
        });
      } catch {
        // ignore offer error
      }
    },
    [socket]
  );

  const startScreenShare = useCallback(async () => {
    setScreenError('');
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError(
        'Trình duyệt trên thiết bị này không hỗ trợ chia sẻ màn hình!'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalScreenStream(stream);
      isSharingRef.current = true;
      setIsSharingScreen(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      if (socket && roomId) {
        socket.emit('screen-share-state', { isSharing: true });
      }

      // Connect to all existing peers in the room
      const others = users.filter((u) => u.id && u.id !== currentUserId);
      for (const peer of others) {
        await createPeerForViewer(peer.id, stream);
      }
    } catch (err) {
      if (err?.name !== 'NotAllowedError') {
        setScreenError('Không thể bắt đầu chia sẻ màn hình. Vui lòng thử lại!');
      }
    }
  }, [socket, roomId, users, currentUserId, createPeerForViewer, stopScreenShare]);

  // If a new user joins while we are actively sharing screen, send them the stream
  useEffect(() => {
    if (!isSharingRef.current || !localStreamRef.current) return;
    const others = users.filter((u) => u.id && u.id !== currentUserId);
    others.forEach((peer) => {
      if (!peersRef.current[peer.id]) {
        createPeerForViewer(peer.id, localStreamRef.current);
      }
    });
  }, [users, currentUserId, createPeerForViewer]);

  // Listen for remote screen signaling and share state updates
  useEffect(() => {
    if (!socket) return;

    const handleScreenShareUpdated = ({ sharerId, sharerName, isSharing } = {}) => {
      if (!isSharing) {
        if (sharerId !== currentUserId) {
          setRemoteScreenStream(null);
          setSharerInfo(null);
          closeAllPeers();
        }
      } else if (sharerId && sharerId !== currentUserId) {
        setSharerInfo({ sharerId, sharerName: sharerName || 'Thành viên' });
      }
    };

    const handleScreenSignal = async ({ fromId, signalData } = {}) => {
      if (!fromId || !signalData) return;

      try {
        if (signalData.type === 'sdp' && signalData.sdp?.type === 'offer') {
          if (peersRef.current[fromId]) {
            try {
              peersRef.current[fromId].close();
            } catch {
              // ignore
            }
          }
          const pc = new RTCPeerConnection(ICE_SERVERS);
          peersRef.current[fromId] = pc;

          pc.ontrack = (event) => {
            const incomingStream =
              (event.streams && event.streams[0]) ||
              new MediaStream([event.track]);
            setRemoteScreenStream(incomingStream);
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('screen-signal', {
                targetId: fromId,
                signalData: { type: 'candidate', candidate: event.candidate },
              });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('screen-signal', {
            targetId: fromId,
            signalData: { type: 'sdp', sdp: pc.localDescription },
          });
        } else if (signalData.type === 'sdp' && signalData.sdp?.type === 'answer') {
          const pc = peersRef.current[fromId];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          }
        } else if (signalData.type === 'candidate' && signalData.candidate) {
          const pc = peersRef.current[fromId];
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch {
        // Ignore transient WebRTC negotiation errors
      }
    };

    const handlePeerLeft = ({ peerId } = {}) => {
      if (peerId && peersRef.current[peerId]) {
        try {
          peersRef.current[peerId].close();
        } catch {
          // ignore
        }
        delete peersRef.current[peerId];
      }
      if (sharerInfo?.sharerId === peerId) {
        setRemoteScreenStream(null);
        setSharerInfo(null);
      }
    };

    socket.on('screen-share-updated', handleScreenShareUpdated);
    socket.on('screen-signal', handleScreenSignal);
    socket.on('peer-left', handlePeerLeft);

    return () => {
      socket.off('screen-share-updated', handleScreenShareUpdated);
      socket.off('screen-signal', handleScreenSignal);
      socket.off('peer-left', handlePeerLeft);
    };
  }, [socket, currentUserId, sharerInfo, closeAllPeers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      closeAllPeers();
    };
  }, [closeAllPeers]);

  return {
    isSharingScreen,
    localScreenStream,
    remoteScreenStream,
    sharerInfo,
    screenError,
    startScreenShare,
    stopScreenShare,
  };
}

export default useScreenShare;
