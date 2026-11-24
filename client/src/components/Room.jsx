import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Copy,
  Check,
  Users,
  ShieldCheck,
  Crown,
  Lock,
  Unlock,
  LogOut,
  Play,
  Link2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  UserX,
  Send,
  MessageSquare,
  Sparkles,
  AlertCircle,
  ListPlus,
  SkipForward,
  Trash2,
  Moon,
  Sun,
  Bell,
  BellOff,
  BarChart2,
  Timer,
  X,
  MonitorUp,
  MonitorOff,
  Search,
  Share2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import ChibiMascot from './ChibiMascot';
import RoamingChibis from './RoamingChibis';
import { parseVideoUrl } from '../utils/videoParser';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useScreenShare } from '../hooks/useScreenShare';
import { playChimeSound } from '../utils/soundFx';

const CAPACITIES = [4, 6, 8, 10, 15, 20];
const REACTION_EMOJIS = ['❤️', '😂', '😮', '🔥', '👏', '🍿'];

const SAMPLE_VIDEOS = [
  {
    label: '🎬 Phim mẫu MP4 (Big Buck Bunny)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    label: '🚀 Phim mẫu MP4 (Tears of Steel)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    label: '▶️ YouTube Mẫu (Lofi Chill)',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    label: '📡 HLS Stream (.m3u8)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
];

export default function Room({
  socket,
  room,
  currentUserId,
  adminAuth,
  onOpenAdminModal,
  onLeaveRoom,
  liveBgEnabled = true,
  onToggleLiveBg,
  theatreMode = false,
  onToggleTheatreMode,
}) {
  const [urlInput, setUrlInput] = useState(room?.videoState?.url || '');
  const [urlError, setUrlError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [capacityMsg, setCapacityMsg] = useState('');
  const [messages, setMessages] = useState(() => room?.messages || []);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState([]);
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'chat' : 'all'
  ); // 'all' | 'voice' | 'chat' for mobile convenience
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chibiBubbles, setChibiBubbles] = useState({});
  const [highFiveActive, setHighFiveActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showYtSearch, setShowYtSearch] = useState(false);
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytSearchError, setYtSearchError] = useState('');
  const [showMobileControls, setShowMobileControls] = useState(
    () => !room?.videoState?.url
  );

  const chatEndRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const users = room?.users || [];
  const currentUser = users.find((u) => u.id === currentUserId);
  const isHost = room?.hostId === currentUserId;
  const isAdmin = Boolean(adminAuth?.token || currentUser?.isAdmin);
  const canModerate = isHost || isAdmin;
  const canControl = Boolean(room?.allowAllControl || isHost || isAdmin);
  const canAddVideo = Boolean(room?.allowAllAddVideo || isHost || isAdmin);

  // Initialize WebRTC Voice Chat Hook
  const {
    isMuted,
    isSpeaking,
    isDeafened,
    micError,
    toggleMic,
    toggleDeafen,
  } = useVoiceChat({
    socket,
    roomId: room?.roomId,
    currentUserId,
    users,
  });

  // Initialize WebRTC Screen/Tab Share Hook
  const {
    isSharingScreen,
    localScreenStream,
    remoteScreenStream,
    sharerInfo,
    screenError,
    startScreenShare,
    stopScreenShare,
  } = useScreenShare({
    socket,
    roomId: room?.roomId,
    currentUserId,
    users,
  });

  // Sync URL input when room video url changes
  useEffect(() => {
    if (room?.videoState?.url !== undefined) {
      setUrlInput(room.videoState.url || '');
    }
  }, [room?.videoState?.url]);

  // Seed messages when room changes
  useEffect(() => {
    if (Array.isArray(room?.messages)) {
      setMessages(room.messages);
    }
  }, [room?.roomId]);

  // Listen to real-time chat messages & reactions
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg) => {
      if (!msg) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-99), msg];
      });
      if (soundEnabledRef.current) {
        if (msg.type === 'system' && msg.text?.includes('đã vào rạp')) {
          playChimeSound('join');
        } else if (msg.type === 'user' && msg.senderId !== currentUserId) {
          playChimeSound('message');
        }
      }
      if (msg.type === 'user' && msg.senderId) {
        setChibiBubbles((prev) => ({
          ...prev,
          [msg.senderId]: msg.text,
        }));
        setTimeout(() => {
          setChibiBubbles((prev) => {
            if (prev[msg.senderId] !== msg.text) return prev;
            const copy = { ...prev };
            delete copy[msg.senderId];
            return copy;
          });
        }, 3500);
      }
    };

    const handleCountdownStarted = () => {
      setCountdownValue(3);
      if (soundEnabledRef.current) playChimeSound('countdown');
      setTimeout(() => {
        setCountdownValue(2);
        if (soundEnabledRef.current) playChimeSound('countdown');
      }, 1000);
      setTimeout(() => {
        setCountdownValue(1);
        if (soundEnabledRef.current) playChimeSound('countdown');
      }, 2000);
      setTimeout(() => {
        setCountdownValue(0);
        if (soundEnabledRef.current) playChimeSound('highfive');
      }, 3000);
      setTimeout(() => {
        setCountdownValue(null);
      }, 4200);
    };

    const handleHighFiveReceived = () => {
      setHighFiveActive(true);
      if (soundEnabledRef.current) playChimeSound('highfive');
      setTimeout(() => {
        setHighFiveActive(false);
      }, 3000);
    };

    const handleReactionReceived = (reaction) => {
      if (!reaction) return;
      const item = {
        id:
          reaction.id ||
          `react-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emoji: reaction.emoji || '❤️',
        senderName: reaction.senderName || 'Khán giả',
      };
      setReactions((prev) => [...prev.slice(-24), item]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== item.id));
      }, 3200);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('reaction-received', handleReactionReceived);
    socket.on('countdown-started', handleCountdownStarted);
    socket.on('chibi-highfive-received', handleHighFiveReceived);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('reaction-received', handleReactionReceived);
      socket.off('countdown-started', handleCountdownStarted);
      socket.off('chibi-highfive-received', handleHighFiveReceived);
    };
  }, [socket, currentUserId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyInviteLink = async () => {
    if (!room?.roomId) return;
    const inviteUrl = `${window.location.origin}?room=${room.roomId}`;

    // Use native Share Sheet on mobile (Zalo, Messenger, Telegram...) if available
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({
          title: 'Rạp Phim Online - Xem phim cùng mình!',
          text: `Vào phòng chiếu ${room.roomId} xem phim cùng mình nhé! 🎬🍿`,
          url: inviteUrl,
        });
        return;
      } catch {
        // User cancelled or fallback to clipboard
      }
    }

    navigator.clipboard
      ?.writeText(inviteUrl)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      })
      .catch(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
  };

  const handleCapacityChange = (e) => {
    const newMaxUsers = Number(e.target.value);
    if (!socket || !newMaxUsers) return;
    setCapacityMsg('');

    socket.emit(
      'update-room-capacity',
      {
        newMaxUsers,
        adminToken: adminAuth?.token || null,
      },
      (res) => {
        if (res?.error) {
          setCapacityMsg(res.error);
          setTimeout(() => setCapacityMsg(''), 4000);
        } else {
          setCapacityMsg(`Đã mở rộng ${newMaxUsers} ghế!`);
          setTimeout(() => setCapacityMsg(''), 2500);
        }
      }
    );
  };

  const handleToggleControlPermission = () => {
    if (!socket || !canModerate) return;
    socket.emit('toggle-control-permission', {
      allowAllControl: !room.allowAllControl,
    });
  };

  const handleToggleAddVideoPermission = () => {
    if (!socket || !canModerate) return;
    socket.emit('toggle-add-video-permission', {
      allowAllAddVideo: !room.allowAllAddVideo,
    });
  };

  const applyVideoUrl = async (rawUrl) => {
    setUrlError('');
    if (!canAddVideo) {
      setUrlError('Chỉ chủ phòng (hoặc khi được cấp quyền) mới được thêm link phim lúc này!');
      return;
    }

    let urlToParse = (rawUrl || '').trim();
    if (
      /facebook\.com\/share\/|fb\.watch\/|vt\.tiktok\.com\/|vm\.tiktok\.com\//i.test(
        urlToParse
      )
    ) {
      try {
        const res = await fetch(
          `/api/resolve-url?url=${encodeURIComponent(urlToParse)}`
        );
        const data = await res.json();
        if (data?.resolvedUrl) {
          urlToParse = data.resolvedUrl;
        }
      } catch {
        // Fallback to original URL
      }
    }

    const parsed = parseVideoUrl(urlToParse);
    if (!parsed) {
      setUrlError(
        'Đường dẫn không hợp lệ! Hãy dán link YouTube, Facebook, Google Drive, TikTok, .mp4, .m3u8 hoặc mã <iframe>'
      );
      return;
    }

    socket?.emit('change-video', parsed, (res) => {
      if (res?.error) {
        setUrlError(res.error);
      }
    });
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    applyVideoUrl(urlInput);
  };

  const handleSelectSample = (sampleUrl) => {
    setUrlInput(sampleUrl);
    applyVideoUrl(sampleUrl);
  };

  const handleAddToPlaylist = () => {
    setUrlError('');
    if (!canAddVideo) {
      setUrlError('Chỉ chủ phòng (hoặc khi được cấp quyền) mới được thêm vào hàng đợi!');
      return;
    }
    const parsed = parseVideoUrl(urlInput);
    if (!parsed) {
      setUrlError(
        'Đường dẫn không hợp lệ! Hãy dán link YouTube, .mp4, .m3u8 hoặc link web https://'
      );
      return;
    }
    socket?.emit('add-to-playlist', parsed, (res) => {
      if (res?.error) {
        setUrlError(res.error);
      } else {
        setUrlInput('');
        setShowPlaylist(true);
      }
    });
  };

  const handlePlayNext = (itemId) => {
    socket?.emit('play-next-video', itemId ? { itemId } : {});
  };

  const handleRemovePlaylistItem = (itemId) => {
    socket?.emit('remove-from-playlist', { itemId });
  };

  const handleStartCountdown = () => {
    socket?.emit('start-countdown');
  };

  const handleChibiHighFive = () => {
    socket?.emit('chibi-highfive');
  };

  const handleCreatePoll = (e) => {
    e.preventDefault();
    socket?.emit(
      'create-poll',
      { question: pollQuestion, options: pollOptions },
      (res) => {
        if (res?.ok) {
          setShowPollForm(false);
          setPollQuestion('');
          setPollOptions(['', '']);
        }
      }
    );
  };

  const handleSearchYouTube = async (e) => {
    e.preventDefault();
    const q = ytQuery.trim();
    if (!q) return;
    setYtSearching(true);
    setYtSearchError('');
    try {
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setYtSearchError(data.error || 'Không tìm thấy kết quả!');
        setYtResults([]);
      } else {
        setYtResults(data.results || []);
        if ((data.results || []).length === 0) {
          setYtSearchError('Không tìm thấy video phù hợp. Hãy thử từ khóa khác!');
        }
      }
    } catch {
      setYtSearchError('Lỗi kết nối khi tìm YouTube!');
    } finally {
      setYtSearching(false);
    }
  };

  const handleSendReaction = (emoji) => {
    if (!socket) return;
    socket.emit('send-reaction', { emoji });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socket) return;
    socket.emit('chat-message', { text });
    setChatInput('');
  };

  const handleAdminMuteUser = (targetId) => {
    if (!socket || !canModerate) return;
    socket.emit('admin-mute-user', { targetId });
  };

  const handleAdminKickUser = (targetId, targetName) => {
    if (!socket || !canModerate) return;
    if (
      window.confirm(
        `Bạn có chắc muốn mời "${targetName}" ra khỏi phòng chiếu không?`
      )
    ) {
      socket.emit('admin-kick-user', { targetId });
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-[100dvh] lg:h-screen flex flex-col cinema-bg-pastel text-white overflow-hidden">
      {/* Top Cinema Header (1-row horizontal scroll on mobile, wrapped on desktop) */}
      <header className="shrink-0 border-b border-white/20 bg-white/10 backdrop-blur-xl px-2.5 sm:px-5 py-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:justify-between">
          {/* Left: Brand + Room Code + Copy Invite Link + Member Count */}
          <div className="flex items-center gap-2 shrink-0 lg:flex-wrap sm:gap-3">
            <div className="flex items-center gap-2 pr-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400/90 to-emerald-500/90 border border-white/35 flex items-center justify-center shadow-[0_3px_0_rgba(17,94,89,0.6),0_6px_12px_rgba(20,184,166,0.3)]">
                <Film className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <span className="font-black text-sm tracking-tight text-white hidden sm:inline">
                RẠP PHIM
              </span>
            </div>

            {/* Room Code Badge */}
            <div className="flex items-center gap-1.5 bg-white/12 border border-white/25 backdrop-blur-md rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-200">
                Mã phòng:
              </span>
              <span className="font-mono font-black text-sm tracking-widest text-white">
                {room?.roomId}
              </span>
            </div>

            {/* Copy Invite Link Button */}
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 shadow-[0_3px_0_rgba(6,95,70,0.45)]'
                  : 'btn-3d-soft text-white'
              }`}
              title="Sao chép đường dẫn mời bạn bè vào thẳng phòng này"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Đã copy link mời!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-teal-200 sm:hidden" />
                  <Copy className="w-3.5 h-3.5 text-teal-200 hidden sm:block" />
                  <span className="sm:hidden">Mời bạn</span>
                  <span className="hidden sm:inline">Copy Link Mời</span>
                </>
              )}
            </button>

            {/* Member Count Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md ${
                users.length >= (room?.maxUsers || 4)
                  ? 'bg-rose-500/25 border-rose-300/40 text-rose-100'
                  : 'bg-white/12 border-white/25 text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-teal-200" />
              <span>
                {users.length}/{room?.maxUsers || 4} người
              </span>
            </div>
          </div>

          {/* Right: Capacity Upgrade + Control Permission Toggle + Leave Room */}
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap lg:flex-wrap">
            {capacityMsg && (
              <span className="text-xs font-bold text-white bg-teal-500/30 border border-teal-300/40 px-2.5 py-1 rounded-lg backdrop-blur-md">
                {capacityMsg}
              </span>
            )}

            {/* Mở rộng phòng (Capacity Upgrade) */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5 bg-emerald-400/20 border border-emerald-300/35 rounded-xl px-2.5 py-1 backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="text-xs font-bold text-emerald-100">
                  Mở rộng phòng:
                </span>
                <select
                  value={room?.maxUsers || 4}
                  onChange={handleCapacityChange}
                  className="bg-slate-900/80 border border-emerald-300/40 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                >
                  {CAPACITIES.map((cap) => (
                    <option
                      key={cap}
                      value={cap}
                      disabled={cap < users.length}
                    >
                      {cap} người
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-3d-soft text-teal-100 text-xs font-bold cursor-pointer"
                title="Đăng nhập Admin để nâng cấp phòng lên 6, 8, 10, 15 hoặc 20 người"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                <span>Mở rộng phòng (Admin)</span>
              </button>
            )}

            {/* Quyền điều khiển phim & thêm link toggle (Host or Admin) */}
            {canModerate && (
              <>
                <button
                  type="button"
                  onClick={handleToggleControlPermission}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    room?.allowAllControl
                      ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-100 shadow-[0_3px_0_rgba(6,95,70,0.45)]'
                      : 'btn-3d-soft text-white'
                  }`}
                  title="Bật/tắt quyền cho mọi người bấm Play/Pause/Tua phim"
                >
                  {room?.allowAllControl ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Mọi người điều khiển</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-teal-200" />
                      <span>Chỉ chủ phòng điều khiển</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleAddVideoPermission}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    room?.allowAllAddVideo
                      ? 'bg-sky-400/20 border-sky-300/40 text-sky-100 shadow-[0_3px_0_rgba(3,105,161,0.45)]'
                      : 'btn-3d-soft text-white'
                  }`}
                  title="Bật/tắt quyền cho phép người xem dán thêm link phim mới"
                >
                  <Link2 className={`w-3.5 h-3.5 ${room?.allowAllAddVideo ? 'text-sky-300' : 'text-teal-200'}`} />
                  <span>
                    {room?.allowAllAddVideo
                      ? 'Người xem được thêm link'
                      : 'Khóa thêm link phim'}
                  </span>
                </button>
              </>
            )}

            {/* Leave Room Button */}
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-2 rounded-xl btn-3d-soft text-white cursor-pointer"
              title={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
            >
              {soundEnabled ? (
                <Bell className="w-3.5 h-3.5 text-teal-200" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>

            {onToggleLiveBg && (
              <button
                type="button"
                onClick={onToggleLiveBg}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl btn-3d-soft text-xs font-bold text-white cursor-pointer"
                title={liveBgEnabled ? 'Tắt nền động để tiết kiệm pin' : 'Bật nền động'}
              >
                <Sparkles className={`w-3.5 h-3.5 ${liveBgEnabled ? 'text-teal-200' : 'text-white/40'}`} />
                <span>{liveBgEnabled ? 'Nền động' : 'Nền tĩnh'}</span>
              </button>
            )}

            {onToggleTheatreMode && (
              <button
                type="button"
                onClick={onToggleTheatreMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  theatreMode
                    ? 'bg-amber-400/25 border-amber-300/45 text-amber-100'
                    : 'btn-3d-soft text-white'
                }`}
                title="Bật/tắt chế độ Đèn Rạp tối (phóng to màn hình + chat nổi)"
              >
                {theatreMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-200" />
                    <span>Bật đèn</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-teal-200" />
                    <span>Đèn rạp</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-300/40 text-white text-xs font-bold shadow-[0_3px_0_rgba(136,19,55,0.5)] active:translate-y-0.5 transition-all cursor-pointer backdrop-blur-md"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Left Cinema Stage + Right Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Main Cinema Stage (sticky/fixed top on mobile) */}
        <div className="shrink-0 lg:flex-1 flex flex-col min-w-0 p-2 sm:p-4 gap-2 sm:gap-3 lg:overflow-y-auto">
          {/* Mobile Quick Toggle Bar for URL / Search Controls */}
          <div className="flex lg:hidden items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowMobileControls((s) => !s)}
              className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-2xl cinema-card-3d text-xs font-bold text-teal-100 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-teal-200" />
                <span>Dán link phim / Tìm YouTube</span>
              </span>
              {showMobileControls ? (
                <ChevronUp className="w-4 h-4 text-teal-200" />
              ) : (
                <ChevronDown className="w-4 h-4 text-teal-200" />
              )}
            </button>
          </div>

          {/* URL Input Bar + Sample Quick Buttons */}
          <div
            className={`${
              showMobileControls ? 'block' : 'hidden lg:block'
            } rounded-3xl cinema-card-3d p-2.5 sm:p-3 space-y-2.5 shrink-0`}
          >
            <form
              onSubmit={handleUrlSubmit}
              className="flex flex-wrap items-center gap-2"
            >
              <div className="relative flex-1 min-w-[220px]">
                <Link2 className="w-4 h-4 text-teal-200/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={!canAddVideo}
                  placeholder={
                    canAddVideo
                      ? 'Dán link YouTube, Facebook, Google Drive, TikTok, .mp4, .m3u8 hoặc mã <iframe>...'
                      : 'Chỉ chủ phòng (hoặc khi được cấp quyền) mới được thêm link phim...'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl input-3d focus:outline-none text-xs sm:text-sm font-medium text-white placeholder-white/45 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={!canAddVideo}
                className="px-5 py-2.5 rounded-2xl btn-3d-pink disabled:opacity-50 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Chiếu Phim</span>
              </button>

              <button
                type="button"
                disabled={!canAddVideo}
                onClick={handleAddToPlaylist}
                className="px-3.5 py-2.5 rounded-2xl btn-3d-soft disabled:opacity-50 font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                title="Thêm link vào danh sách phát tiếp theo"
              >
                <ListPlus className="w-4 h-4 text-teal-200" />
                <span>+ Hàng đợi</span>
              </button>

              {canAddVideo && (
                <button
                  type="button"
                  onClick={() => setShowYtSearch((s) => !s)}
                  className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                    showYtSearch
                      ? 'bg-teal-400/30 border border-teal-300/50 text-white'
                      : 'btn-3d-soft text-teal-100'
                  }`}
                  title="Tìm video YouTube trực tiếp ngay trong rạp (rất tiện trên điện thoại)"
                >
                  <Search className="w-4 h-4 text-teal-200" />
                  <span>Tìm YouTube</span>
                </button>
              )}

              {(canControl || canAddVideo) && (
                <button
                  type="button"
                  onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                  className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                    isSharingScreen
                      ? 'bg-rose-500/35 border border-rose-300/45 text-white'
                      : 'btn-3d-soft text-teal-100'
                  }`}
                  title="Chiếu trực tiếp Tab Netflix, Facebook, hoặc Web phim bất kỳ kèm âm thanh"
                >
                  {isSharingScreen ? (
                    <>
                      <MonitorOff className="w-4 h-4 text-rose-200" />
                      <span className="hidden sm:inline">Dừng chiếu</span>
                    </>
                  ) : (
                    <>
                      <MonitorUp className="w-4 h-4 text-emerald-300" />
                      <span className="hidden sm:inline">Chiếu Tab/Màn hình</span>
                    </>
                  )}
                </button>
              )}
            </form>

            {/* Quick Sample Video Links + Playlist Drawer Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-teal-200 mr-1">
                  Phim thử nhanh 1-click:
                </span>
                {SAMPLE_VIDEOS.map((sample) => (
                  <button
                    key={sample.url}
                    type="button"
                    disabled={!canAddVideo}
                    onClick={() => handleSelectSample(sample.url)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-white/12 hover:bg-white/22 border border-white/20 text-white disabled:opacity-50 transition-colors cursor-pointer backdrop-blur-md"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowPlaylist((s) => !s)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-teal-400/20 hover:bg-teal-400/30 border border-teal-300/35 text-teal-100 flex items-center gap-1.5 cursor-pointer"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Hàng đợi ({(room?.playlist || []).length})</span>
              </button>
            </div>

            {/* In-App YouTube Search Drawer */}
            {showYtSearch && canAddVideo && (
              <div className="rounded-2xl bg-slate-950/45 border border-white/20 p-2.5 space-y-2">
                <form onSubmit={handleSearchYouTube} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ytQuery}
                    onChange={(e) => setYtQuery(e.target.value)}
                    placeholder="Gõ tên phim, tập phim, bài hát cần tìm trên YouTube..."
                    className="flex-1 px-3 py-2 rounded-xl input-3d text-xs text-white placeholder-white/45 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={ytSearching}
                    className="px-3.5 py-2 rounded-xl btn-3d-pink text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {ytSearching ? 'Đang tìm...' : 'Tìm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowYtSearch(false)}
                    className="p-1.5 text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>

                {ytSearchError && (
                  <p className="text-[11px] text-rose-200 font-semibold">{ytSearchError}</p>
                )}

                {ytResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {ytResults.map((item) => (
                      <div
                        key={item.videoId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/15 p-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="w-16 h-10 rounded-lg object-cover shrink-0 bg-black"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{item.title}</div>
                            <div className="text-[10px] text-teal-200/80 truncate">
                              {item.channel} {item.duration ? `• ${item.duration}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setUrlInput(item.url);
                              applyVideoUrl(item.url);
                              setShowYtSearch(false);
                            }}
                            className="px-2.5 py-1.5 rounded-lg btn-3d-pink text-[11px] font-bold cursor-pointer"
                          >
                            Chiếu
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              socket?.emit('add-to-playlist', {
                                url: item.url,
                                type: 'youtube',
                                videoId: item.videoId,
                                title: item.title,
                              });
                              setShowPlaylist(true);
                            }}
                            className="px-2 py-1.5 rounded-lg btn-3d-soft text-[11px] font-bold text-white cursor-pointer"
                            title="Thêm vào hàng đợi"
                          >
                            + Chờ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showPlaylist && (
              <div className="rounded-2xl bg-slate-950/35 border border-white/15 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-teal-100">
                  <span>Danh sách phim chờ phát ({(room?.playlist || []).length})</span>
                  {(room?.playlist || []).length > 0 && (canControl || canAddVideo) && (
                    <button
                      type="button"
                      onClick={() => handlePlayNext()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg btn-3d-pink text-[11px] font-bold cursor-pointer"
                    >
                      <SkipForward className="w-3 h-3" />
                      Phát tiếp theo
                    </button>
                  )}
                </div>

                {(room?.playlist || []).length === 0 ? (
                  <p className="text-[11px] text-white/55">
                    Chưa có phim nào trong hàng đợi. Dán link ở trên rồi bấm "+ Hàng đợi"!
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1.5">
                    {(room?.playlist || []).map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white truncate">
                            {idx + 1}. {item.title}
                          </div>
                          <div className="text-[10px] text-teal-200/75">
                            Thêm bởi {item.addedBy} ({item.type})
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(canControl || canAddVideo) && (
                            <button
                              type="button"
                              onClick={() => handlePlayNext(item.id)}
                              className="p-1.5 rounded-lg bg-teal-500/25 hover:bg-teal-500/40 text-teal-100 cursor-pointer"
                              title="Phát phim này ngay"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}
                          {canAddVideo && (
                            <button
                              type="button"
                              onClick={() => handleRemovePlaylistItem(item.id)}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 cursor-pointer"
                              title="Xóa khỏi hàng đợi"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(urlError || screenError) && (
              <div className="rounded-xl bg-rose-500/25 border border-rose-300/40 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-white">
                <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
                <span>{urlError || screenError}</span>
              </div>
            )}
          </div>

          {/* Video Player Container */}
          <div
            className={`w-full mx-auto shrink-0 flex flex-col ${
              theatreMode
                ? 'lg:max-w-[min(100%,calc((100vh-220px)*16/9))]'
                : 'lg:max-w-[min(100%,calc((100vh-260px)*16/9))]'
            }`}
          >
            <VideoPlayer
              socket={socket}
              videoState={room?.videoState}
              canControl={canControl}
              onVideoAction={(action, currentTime) =>
                socket?.emit('video-action', { action, currentTime })
              }
              onVideoEnded={() => {
                if ((room?.playlist || []).length > 0) {
                  handlePlayNext();
                }
              }}
              reactions={reactions}
              countdownValue={countdownValue}
              overlayMessages={messages.filter((m) => m.type === 'user')}
              theatreMode={theatreMode}
              screenStream={localScreenStream || remoteScreenStream}
              isLocalScreen={isSharingScreen}
              sharerName={sharerInfo?.sharerName}
              onStartScreenShare={startScreenShare}
              onStopScreenShare={stopScreenShare}
            />
          </div>

          {/* Floating Reaction Bar + High-Five + Countdown */}
          <div className="rounded-2xl sm:rounded-3xl cinema-card-3d px-3 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-teal-100 shrink-0">
              <span className="hidden sm:inline">Thả cảm xúc:</span>
              {users.length >= 2 && (
                <button
                  type="button"
                  onClick={handleChibiHighFive}
                  className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/35 text-amber-100 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                  title="Gọi 2 bé Chibi chạy lại cụng ly trong khung chat!"
                >
                  🥂 Cụng ly
                </button>
              )}
              {canControl && (
                <button
                  type="button"
                  onClick={handleStartCountdown}
                  className="px-2.5 py-1 rounded-xl bg-teal-400/20 hover:bg-teal-400/30 border border-teal-300/35 text-teal-100 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  title="Đếm ngược 3-2-1 đồng bộ cả phòng (rất tiện khi xem Iframe)"
                >
                  <Timer className="w-3.5 h-3.5" />
                  3-2-1
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSendReaction(emoji)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl btn-3d-soft flex items-center justify-center text-base sm:text-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title={`Thả ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Voice Chat + Members & Room Chat) */}
        {!theatreMode && (
        <aside className="flex-1 min-h-0 lg:flex-none w-full lg:w-96 xl:w-[410px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/20 bg-white/10 backdrop-blur-xl flex flex-col lg:h-full">
          {/* Mobile Tab Switcher with Quick Mic Button */}
          <div className="flex lg:hidden items-center border-b border-white/15 bg-white/10 p-1.5 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'chat' || activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60'
              }`}
            >
              Chat ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'voice'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60'
              }`}
            >
              Thành viên ({users.length}/{room?.maxUsers || 4})
            </button>
            <button
              type="button"
              onClick={toggleMic}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                isMuted
                  ? 'bg-white/10 text-white/80'
                  : 'bg-emerald-500/80 text-white'
              }`}
              title={isMuted ? 'Bật Mic' : 'Tắt Mic'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-300" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Mic' : 'Đang bật'}</span>
            </button>
          </div>

          {/* SECTION 1: Voice Chat & Thành Viên */}
          <div
            className={`flex flex-col border-b border-white/15 ${
              activeTab === 'voice'
                ? 'flex-1 min-h-0 lg:flex-none lg:h-[46%]'
                : 'hidden lg:flex lg:h-[46%]'
            }`}
          >
            {/* Voice Controls Header */}
            <div className="p-3 border-b border-white/15 bg-white/5 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-200" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Voice Chat &amp; Thành Viên ({users.length}/{room?.maxUsers || 4})
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-teal-200">
                  {isMuted ? 'Mic đang tắt' : isSpeaking ? '🟢 Đang nói...' : '🎙️ Mic đang bật'}
                </span>
              </div>

              {/* Big Clear Buttons for Bật/Tắt Mic & Tắt/Bật Loa */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isMuted
                      ? 'btn-3d-soft text-white'
                      : 'bg-emerald-500/85 text-white border border-emerald-300/50 shadow-[0_4px_0_rgba(6,95,70,0.75),0_8px_16px_rgba(16,185,129,0.3)] active:translate-y-1'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-4 h-4 text-teal-200" />
                      <span>Bật Mic</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-white animate-pulse" />
                      <span>Tắt Mic</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleDeafen}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDeafened
                      ? 'bg-rose-500/25 border border-rose-300/40 text-rose-100 shadow-[0_3px_0_rgba(136,19,55,0.45)]'
                      : 'btn-3d-soft text-white'
                  }`}
                >
                  {isDeafened ? (
                    <>
                      <VolumeX className="w-4 h-4 text-rose-200" />
                      <span>Bật Loa</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-teal-200" />
                      <span>Tắt Loa</span>
                    </>
                  )}
                </button>
              </div>

              {micError && (
                <div className="rounded-lg bg-rose-500/25 border border-rose-300/40 px-2.5 py-1.5 text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-200 shrink-0" />
                  <span>{micError}</span>
                </div>
              )}
            </div>

            {/* Scrollable Member List (up to 20 users) */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {users.map((u, idx) => {
                const isMe = u.id === currentUserId;
                const isUserHost = u.id === room?.hostId;
                const userSpeaking = isMe ? isSpeaking : Boolean(u.isSpeaking);
                const userMuted = isMe ? isMuted : Boolean(u.isMuted);

                return (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border backdrop-blur-md transition-all ${
                      userSpeaking
                        ? 'bg-emerald-400/20 border-emerald-300/45 shadow-sm'
                        : 'bg-white/10 border-white/18'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Chibi Mascot Avatar with speaking green ring */}
                      <div
                        className={`rounded-full p-0.5 shrink-0 transition-all ${
                          userSpeaking
                            ? 'ring-2 ring-emerald-300 bg-emerald-400/20 scale-105'
                            : 'bg-white/10'
                        }`}
                      >
                        <ChibiMascot index={idx} size={34} isSpeaking={userSpeaking} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[120px]">
                            {u.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/15 text-teal-100 border border-white/25 font-bold">
                              Bạn
                            </span>
                          )}
                          {isUserHost && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-100 border border-amber-300/35 font-bold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5 text-amber-200" />
                              Chủ phòng
                            </span>
                          )}
                          {u.isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/35 font-bold flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right icons: mic status + Host/Admin moderation actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {userMuted ? (
                        <span
                          className="p-1.5 rounded-lg bg-white/10 text-white/50"
                          title="Đang tắt mic"
                        >
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span
                          className={`p-1.5 rounded-lg ${
                            userSpeaking
                              ? 'bg-emerald-400/25 text-emerald-200'
                              : 'bg-white/10 text-emerald-300'
                          }`}
                          title="Đang bật mic"
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                      )}

                      {canModerate && !isMe && (
                        <>
                          {!userMuted && (
                            <button
                              type="button"
                              onClick={() => handleAdminMuteUser(u.id)}
                              className="p-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 transition-colors cursor-pointer"
                              title="Tắt mic thành viên này"
                            >
                              <MicOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAdminKickUser(u.id, u.name)}
                            className="p-1.5 rounded-lg bg-rose-400/20 hover:bg-rose-400/30 text-rose-100 transition-colors cursor-pointer"
                            title="Mời thành viên này rời phòng"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Phòng Chat */}
          <div
            className={`flex-1 flex flex-col min-h-0 ${
              activeTab === 'voice' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Chat Header */}
            <div className="px-3.5 py-2.5 border-b border-white/15 bg-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-200" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Phòng Chat Trực Tiếp
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPollForm((s) => !s)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-teal-100 flex items-center gap-1 cursor-pointer"
                  title="Tạo bình chọn nhanh cho cả phòng"
                >
                  <BarChart2 className="w-3 h-3" />
                  <span>Bình chọn</span>
                </button>
                <span className="text-[11px] font-bold text-teal-200/80">
                  {messages.length}
                </span>
              </div>
            </div>

            {/* Quick Poll Creator Form */}
            {showPollForm && (
              <form
                onSubmit={handleCreatePoll}
                className="p-2.5 border-b border-white/15 bg-slate-950/35 space-y-2 shrink-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-200">
                    Tạo bình chọn nhanh
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPollForm(false)}
                    className="text-white/60 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Câu hỏi (vd: Tối nay xem phim gì?)..."
                  className="w-full px-2.5 py-1.5 rounded-lg input-3d text-xs text-white placeholder-white/45 focus:outline-none"
                />
                {pollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[idx] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Lựa chọn ${idx + 1}...`}
                    className="w-full px-2.5 py-1.5 rounded-lg input-3d text-xs text-white placeholder-white/45 focus:outline-none"
                  />
                ))}
                <div className="flex items-center justify-between gap-2">
                  {pollOptions.length < 4 ? (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="text-[11px] font-bold text-teal-200 hover:text-white cursor-pointer"
                    >
                      + Thêm lựa chọn
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg btn-3d-pink text-xs font-bold cursor-pointer"
                  >
                    Gửi bình chọn
                  </button>
                </div>
              </form>
            )}

            {/* Active Poll Card */}
            {room?.activePoll && (
              <div className="p-2.5 border-b border-white/15 bg-teal-500/15 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white">
                    📊 {room.activePoll.question}
                  </span>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => socket?.emit('close-poll')}
                      className="text-[10px] text-white/60 hover:text-white cursor-pointer"
                      title="Đóng bình chọn"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {room.activePoll.options.map((opt) => {
                    const totalVotes = room.activePoll.options.reduce(
                      (sum, o) => sum + (o.voters?.length || 0),
                      0
                    );
                    const count = opt.voters?.length || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const voted = opt.voters?.includes(currentUserId);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => socket?.emit('vote-poll', { optionId: opt.id })}
                        className={`relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-all cursor-pointer ${
                          voted
                            ? 'border-teal-300/70 bg-teal-400/25 text-white'
                            : 'border-white/20 bg-white/10 text-white/90 hover:bg-white/15'
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-teal-400/30 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative z-10 flex items-center justify-between">
                          <span>{opt.text}</span>
                          <span className="font-bold text-teal-100">
                            {count} ({pct}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Feed with Roaming Chibi Mascots inside */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <RoamingChibis
                users={users}
                hostId={room?.hostId}
                currentUserId={currentUserId}
                isSpeaking={isSpeaking}
                chibiBubbles={chibiBubbles}
                highFiveActive={highFiveActive}
              />
              <div className="relative z-10 h-full overflow-y-auto p-3 space-y-2.5">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-xs font-medium text-white/55 px-4">
                  Chưa có tin nhắn nào. Hãy gửi lời chào tới mọi người trong rạp nhé! 🍿
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.type === 'system') {
                    return (
                      <div
                        key={msg.id}
                        className="text-center my-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-medium text-teal-100/90"
                      >
                        <span>{msg.text}</span>
                      </div>
                    );
                  }

                  const isOwn = msg.senderId === currentUserId;
                  const senderIndex = Math.max(
                    0,
                    users.findIndex((u) => u.id === msg.senderId)
                  );
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${
                        isOwn ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <ChibiMascot index={senderIndex} size={26} />
                      <div
                        className={`flex flex-col max-w-[82%] ${
                          isOwn ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className="text-[11px] font-bold text-teal-100">
                            {isOwn ? 'Bạn' : msg.senderName}
                          </span>
                          {msg.isHost && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-100 border border-amber-300/35 font-bold">
                              Chủ phòng
                            </span>
                          )}
                          {msg.isAdmin && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/35 font-bold">
                              Admin
                            </span>
                          )}
                          <span className="text-[10px] text-white/45">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        <div
                          className={`rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed break-words backdrop-blur-md ${
                            isOwn
                              ? 'bg-teal-500/75 border border-white/25 text-white rounded-br-xs'
                              : 'bg-white/15 text-white border border-white/20 rounded-bl-xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
              </div>
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSendChat}
              className="p-2.5 border-t border-white/15 bg-white/10 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn trò chuyện..."
                maxLength={500}
                className="flex-1 px-3.5 py-2 rounded-xl input-3d focus:outline-none text-xs font-medium text-white placeholder-white/45"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 rounded-xl btn-3d-pink disabled:opacity-40 cursor-pointer"
                title="Gửi tin nhắn"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
