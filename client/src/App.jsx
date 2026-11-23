import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';
import AdminModal from './components/AdminModal.jsx';

const STORAGE_NAME_KEY = 'cinema_watch_party_username';
const STORAGE_ADMIN_KEY = 'cinema_watch_party_admin_auth';
const STORAGE_LIVE_BG_KEY = 'cinema_watch_party_live_bg';
const SESSION_ROOM_KEY = 'cinema_watch_party_last_room';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [userName, setUserNameState] = useState(() => {
    return localStorage.getItem(STORAGE_NAME_KEY) || '';
  });
  const [adminAuth, setAdminAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ADMIN_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [room, setRoom] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase().trim();
  });
  const [liveBgEnabled, setLiveBgEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_LIVE_BG_KEY);
    return saved === null ? true : saved === 'true';
  });
  const [theatreMode, setTheatreMode] = useState(false);

  const toggleLiveBg = useCallback(() => {
    setLiveBgEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_LIVE_BG_KEY, String(next));
      return next;
    });
  }, []);

  const setUserName = useCallback((name) => {
    setUserNameState(name);
    if (typeof name === 'string') {
      localStorage.setItem(STORAGE_NAME_KEY, name.trim());
    }
  }, []);

  const updateUrlRoomParam = useCallback((roomId) => {
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Verify persisted admin token on load
  useEffect(() => {
    if (!adminAuth?.token) return;

    fetch('/api/admin/verify', {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : { valid: false }))
      .then((data) => {
        if (!data || !data.valid) {
          localStorage.removeItem(STORAGE_ADMIN_KEY);
          setAdminAuth(null);
        }
      })
      .catch(() => {
        // Keep token on transient network error
      });
  }, []);

  // Connect Socket.IO and bind room state events
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    // Auto-rejoin previous room on F5 / reconnect if session was active
    newSocket.on('connect', () => {
      const savedRoomId = sessionStorage.getItem(SESSION_ROOM_KEY);
      const savedName = (localStorage.getItem(STORAGE_NAME_KEY) || '').trim();
      if (savedRoomId && savedName) {
        let savedToken = null;
        try {
          const rawAuth = localStorage.getItem(STORAGE_ADMIN_KEY);
          savedToken = rawAuth ? JSON.parse(rawAuth)?.token : null;
        } catch {
          savedToken = null;
        }
        newSocket.emit(
          'join-room',
          {
            roomId: savedRoomId,
            userName: savedName,
            adminToken: savedToken,
          },
          (res) => {
            if (res?.room) {
              setRoom(res.room);
              setInitialRoomCode(res.room.roomId);
              updateUrlRoomParam(res.room.roomId);
            } else {
              sessionStorage.removeItem(SESSION_ROOM_KEY);
            }
          }
        );
      }
    });

    newSocket.on('room-updated', (updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    });

    newSocket.on('video-changed', ({ videoState } = {}) => {
      if (!videoState) return;
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              videoState,
            }
          : prev
      );
    });

    newSocket.on('user-voice-updated', ({ userId, isMuted, isSpeaking } = {}) => {
      if (!userId) return;
      setRoom((prev) => {
        if (!prev || !Array.isArray(prev.users)) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  isMuted: typeof isMuted === 'boolean' ? isMuted : u.isMuted,
                  isSpeaking:
                    typeof isSpeaking === 'boolean' ? isSpeaking : u.isSpeaking,
                }
              : u
          ),
        };
      });
    });

    newSocket.on('kicked-from-room', ({ byName, reason } = {}) => {
      sessionStorage.removeItem(SESSION_ROOM_KEY);
      setRoom(null);
      setTheatreMode(false);
      const kickMessage =
        reason ||
        `Bạn đã bị ${byName || 'Chủ phòng / Admin'} mời ra khỏi phòng chiếu.`;
      setErrorMsg(kickMessage);
      updateUrlRoomParam(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [updateUrlRoomParam]);

  // Supports both onCreateRoom(maxUsers) and onCreateRoom({ maxUsers, userName })
  const handleCreateRoom = useCallback(
    (arg = {}) => {
      if (!socket) return;
      const isObj = typeof arg === 'object' && arg !== null;
      const maxUsers = isObj ? arg.maxUsers ?? 4 : Number(arg) || 4;
      const customName = isObj ? arg.userName : undefined;

      const finalUserName = (customName ?? userName ?? '').trim();
      if (!finalUserName) {
        setErrorMsg('Vui lòng nhập tên hiển thị của bạn trước khi vào rạp!');
        return;
      }

      setUserName(finalUserName);
      setErrorMsg('');
      setIsLoading(true);

      socket.emit(
        'create-room',
        {
          userName: finalUserName,
          maxUsers: Number(maxUsers) || 4,
          adminToken: adminAuth?.token || null,
        },
        (res) => {
          setIsLoading(false);
          if (res?.error) {
            setErrorMsg(res.error);
            return;
          }
          if (res?.room) {
            sessionStorage.setItem(SESSION_ROOM_KEY, res.room.roomId);
            setRoom(res.room);
            setInitialRoomCode(res.room.roomId);
            updateUrlRoomParam(res.room.roomId);
          }
        }
      );
    },
    [socket, userName, adminAuth, setUserName, updateUrlRoomParam]
  );

  // Supports both onJoinRoom(roomCode) and onJoinRoom({ roomId, roomCode, userName })
  const handleJoinRoom = useCallback(
    (arg = {}) => {
      if (!socket) return;
      const isObj = typeof arg === 'object' && arg !== null;
      const rawCode = isObj
        ? arg.roomId || arg.roomCode || initialRoomCode
        : typeof arg === 'string'
        ? arg
        : initialRoomCode;

      const targetRoomId = (rawCode || '').toUpperCase().trim();
      if (!targetRoomId) {
        setErrorMsg('Vui lòng nhập mã phòng chiếu!');
        return;
      }

      const customName = isObj ? arg.userName : undefined;
      const finalUserName = (customName ?? userName ?? '').trim();
      if (!finalUserName) {
        setErrorMsg('Vui lòng nhập tên hiển thị của bạn trước khi vào rạp!');
        return;
      }

      setUserName(finalUserName);
      setErrorMsg('');
      setIsLoading(true);

      socket.emit(
        'join-room',
        {
          roomId: targetRoomId,
          userName: finalUserName,
          adminToken: adminAuth?.token || null,
        },
        (res) => {
          setIsLoading(false);
          if (res?.error) {
            setErrorMsg(res.error);
            return;
          }
          if (res?.room) {
            sessionStorage.setItem(SESSION_ROOM_KEY, res.room.roomId);
            setRoom(res.room);
            setInitialRoomCode(res.room.roomId);
            updateUrlRoomParam(res.room.roomId);
          }
        }
      );
    },
    [socket, userName, initialRoomCode, adminAuth, setUserName, updateUrlRoomParam]
  );

  const handleLeaveRoom = useCallback(() => {
    sessionStorage.removeItem(SESSION_ROOM_KEY);
    setTheatreMode(false);
    if (socket && room) {
      socket.emit('leave-room');
    }
    setRoom(null);
    setErrorMsg('');
    updateUrlRoomParam(null);
  }, [socket, room, updateUrlRoomParam]);

  const handleAdminLoginSuccess = useCallback(
    (authData) => {
      if (!authData?.token) return;
      const savedAuth = {
        token: authData.token,
        username: authData.username || 'admin',
      };
      setAdminAuth(savedAuth);
      localStorage.setItem(STORAGE_ADMIN_KEY, JSON.stringify(savedAuth));
      setIsAdminModalOpen(false);

      // Elevate privileges immediately if already inside a room
      if (socket && room) {
        socket.emit('elevate-admin', { adminToken: savedAuth.token }, (res) => {
          if (res?.room) {
            setRoom(res.room);
          }
        });
      }
    },
    [socket, room]
  );

  const handleAdminLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_ADMIN_KEY);
    setAdminAuth(null);
    setIsAdminModalOpen(false);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#111c1e] text-white flex flex-col">
      {/* Live Animated Video Wallpaper */}
      {liveBgEnabled ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/bg-cinema.jpg"
          className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0"
        >
          <source src="/bg-cinema.mp4" type="video/mp4" />
        </video>
      ) : (
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none z-0"
          style={{ backgroundImage: "url('/bg-cinema.jpg')" }}
        />
      )}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
          theatreMode
            ? 'bg-slate-950/85 backdrop-blur-xs'
            : 'bg-gradient-to-br from-teal-950/30 via-slate-950/20 to-emerald-950/30'
        }`}
      />

      <div className="relative z-10 flex-1 flex flex-col">
        {!room ? (
          <Lobby
            userName={userName}
            setUserName={setUserName}
            initialRoomCode={initialRoomCode}
            adminAuth={adminAuth}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            errorMsg={errorMsg}
            isLoading={isLoading}
          />
        ) : (
          <Room
            socket={socket}
            room={room}
            currentUserId={socket?.id}
            adminAuth={adminAuth}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onLeaveRoom={handleLeaveRoom}
            liveBgEnabled={liveBgEnabled}
            onToggleLiveBg={toggleLiveBg}
            theatreMode={theatreMode}
            onToggleTheatreMode={() => setTheatreMode((prev) => !prev)}
          />
        )}

        <AdminModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          adminAuth={adminAuth}
          onLoginSuccess={handleAdminLoginSuccess}
          onLogout={handleAdminLogout}
        />
      </div>
    </div>
  );
}
