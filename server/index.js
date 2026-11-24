const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const {
  verifyCredentials,
  generateAdminToken,
  verifyAdminToken
} = require('./auth');

const {
  ALLOWED_CAPACITIES,
  MAX_SIMULTANEOUS_MICS,
  createRoom,
  joinRoom,
  updateRoomCapacity,
  canControlVideo,
  canAddVideo,
  leaveRoom,
  getRoomBySocket,
  getRoom,
  serializeRoom
} = require('./roomManager');

const app = express();
app.use(cors());
app.use(express.json());

// Health check & info endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    allowedCapacities: ALLOWED_CAPACITIES,
    maxSimultaneousMics: MAX_SIMULTANEOUS_MICS,
    timestamp: Date.now()
  });
});

// Resolve shortened social video links (e.g. facebook.com/share/v/..., fb.watch, vt.tiktok.com)
app.get('/api/resolve-url', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = ['facebook.com', 'fb.watch', 'tiktok.com'];
    const isAllowed = allowedHosts.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );
    if (!isAllowed) {
      return res.json({ resolvedUrl: rawUrl.trim() });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    return res.json({ resolvedUrl: response.url || rawUrl.trim() });
  } catch {
    return res.json({ resolvedUrl: rawUrl.trim() });
  }
});

// Admin Login API
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!verifyCredentials(username, password)) {
    return res.status(401).json({
      error: 'Sai tài khoản hoặc mật khẩu Admin!'
    });
  }
  const token = generateAdminToken(username.trim());
  return res.json({
    token,
    username: username.trim(),
    allowedCapacities: ALLOWED_CAPACITIES
  });
});

// Verify Admin Token API
app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.token;
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ valid: false });
  }
  return res.json({
    valid: true,
    username: payload.username,
    allowedCapacities: ALLOWED_CAPACITIES
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  // 1. Tạo phòng mới
  socket.on('create-room', (payload = {}, callback) => {
    const { userName, maxUsers, adminToken } = payload;
    const isAdmin = Boolean(verifyAdminToken(adminToken));

    // Nếu đang ở phòng cũ thì rời trước
    const prev = leaveRoom(socket.id);
    if (prev && prev.roomId) {
      socket.leave(prev.roomId);
      if (!prev.roomDeleted) {
        io.to(prev.roomId).emit('room-updated', serializeRoom(prev.room));
      }
    }

    const result = createRoom({
      hostSocketId: socket.id,
      hostName: userName,
      maxUsers,
      isAdmin
    });

    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    const { room } = result;
    socket.join(room.roomId);
    const serialized = serializeRoom(room);
    if (typeof callback === 'function') {
      callback({ room: serialized });
    }
  });

  // 2. Tham gia phòng
  socket.on('join-room', (payload = {}, callback) => {
    const { roomId, userName, adminToken } = payload;
    const isAdmin = Boolean(verifyAdminToken(adminToken));

    const prev = leaveRoom(socket.id);
    if (prev && prev.roomId && prev.roomId !== (roomId || '').trim().toUpperCase()) {
      socket.leave(prev.roomId);
      if (!prev.roomDeleted) {
        io.to(prev.roomId).emit('room-updated', serializeRoom(prev.room));
      }
    }

    const result = joinRoom({
      roomId,
      socketId: socket.id,
      userName,
      isAdmin
    });

    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    const { room, systemMessage } = result;
    socket.join(room.roomId);

    const serialized = serializeRoom(room);
    if (typeof callback === 'function') {
      callback({ room: serialized });
    }

    socket.to(room.roomId).emit('room-updated', serialized);
    if (systemMessage) {
      socket.to(room.roomId).emit('chat-message', systemMessage);
    }
  });

  // 3. Nâng cấp sức chứa phòng (Admin)
  socket.on('update-room-capacity', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Bạn chưa ở trong phòng nào!' });
      return;
    }

    const { newMaxUsers, adminToken } = payload;
    const isAdmin = Boolean(verifyAdminToken(adminToken));

    const result = updateRoomCapacity({
      roomId: room.roomId,
      socketId: socket.id,
      newMaxUsers,
      isAdmin
    });

    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    const serialized = serializeRoom(result.room);
    io.to(room.roomId).emit('room-updated', serialized);
    if (result.systemMessage) {
      io.to(room.roomId).emit('chat-message', result.systemMessage);
    }
    if (typeof callback === 'function') {
      callback({ room: serialized });
    }
  });

  // 4. Kích hoạt quyền Admin ngay trong phòng
  socket.on('elevate-admin', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const isAdmin = Boolean(verifyAdminToken(payload.adminToken));
    if (!isAdmin) {
      if (typeof callback === 'function') callback({ error: 'Token Admin không hợp lệ!' });
      return;
    }
    const user = room.users.find((u) => u.id === socket.id);
    if (user) {
      user.isAdmin = true;
      const serialized = serializeRoom(room);
      io.to(room.roomId).emit('room-updated', serialized);
      if (typeof callback === 'function') callback({ room: serialized });
    }
  });

  // 5. Bật/tắt quyền cho phép tất cả mọi người điều khiển video
  socket.on('toggle-control-permission', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (room.hostId !== socket.id && !(user && user.isAdmin)) {
      if (typeof callback === 'function') {
        callback({ error: 'Chỉ chủ phòng hoặc Admin mới được đổi cài đặt này!' });
      }
      return;
    }

    room.allowAllControl =
      typeof payload.allowAllControl === 'boolean'
        ? payload.allowAllControl
        : !room.allowAllControl;

    const sysMsg = {
      id: `sys-${Date.now()}`,
      type: 'system',
      text: room.allowAllControl
        ? '🔓 Chủ phòng đã bật chế độ: Mọi người đều có thể điều khiển phim.'
        : '🔒 Chủ phòng đã bật chế độ: Chỉ chủ phòng/Admin điều khiển phim.',
      createdAt: Date.now()
    };
    room.messages.push(sysMsg);

    const serialized = serializeRoom(room);
    io.to(room.roomId).emit('room-updated', serialized);
    io.to(room.roomId).emit('chat-message', sysMsg);
    if (typeof callback === 'function') callback({ room: serialized });
  });

  // 5b. Bật/tắt quyền cho phép người xem thêm/đổi link phim
  socket.on('toggle-add-video-permission', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (room.hostId !== socket.id && !(user && user.isAdmin)) {
      if (typeof callback === 'function') {
        callback({ error: 'Chỉ chủ phòng hoặc Admin mới được đổi cài đặt này!' });
      }
      return;
    }

    room.allowAllAddVideo =
      typeof payload.allowAllAddVideo === 'boolean'
        ? payload.allowAllAddVideo
        : !room.allowAllAddVideo;

    const sysMsg = {
      id: `sys-${Date.now()}`,
      type: 'system',
      text: room.allowAllAddVideo
        ? '🎬 Chủ phòng đã bật chế độ: Người xem có thể thêm/đổi link phim.'
        : '🚫 Chủ phòng đã tắt chế độ: Chỉ chủ phòng/Admin được thêm link phim.',
      createdAt: Date.now()
    };
    room.messages.push(sysMsg);

    const serialized = serializeRoom(room);
    io.to(room.roomId).emit('room-updated', serialized);
    io.to(room.roomId).emit('chat-message', sysMsg);
    if (typeof callback === 'function') callback({ room: serialized });
  });

  // 6. Đổi link phim
  socket.on('change-video', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    if (!canAddVideo(room, socket.id)) {
      if (typeof callback === 'function') {
        callback({ error: 'Chỉ chủ phòng (hoặc khi được cấp quyền) mới được thêm link phim!' });
      }
      return;
    }

    const { url, type, videoId } = payload;
    if (!url || typeof url !== 'string') return;

    const user = room.users.find((u) => u.id === socket.id);
    room.videoState = {
      url: url.trim(),
      type: type || 'youtube',
      videoId: videoId || '',
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now()
    };

    const typeLabel =
      type === 'youtube'
        ? 'YouTube'
        : type === 'hls'
        ? 'HLS Stream (.m3u8)'
        : type === 'video'
        ? 'Video trực tiếp'
        : 'Web Embed (Iframe)';

    const sysMsg = {
      id: `sys-${Date.now()}`,
      type: 'system',
      text: `🍿 ${user ? user.name : 'Thành viên'} đã chiếu phim mới (${typeLabel}).`,
      createdAt: Date.now()
    };
    room.messages.push(sysMsg);

    io.to(room.roomId).emit('video-changed', {
      videoState: room.videoState,
      changedBy: user ? user.name : 'Thành viên'
    });
    io.to(room.roomId).emit('chat-message', sysMsg);
    if (typeof callback === 'function') callback({ ok: true });
  });

  // 6b. Hàng đợi phát phim (Playlist / Up Next)
  socket.on('add-to-playlist', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!canAddVideo(room, socket.id)) {
      if (typeof callback === 'function') {
        callback({ error: 'Chỉ chủ phòng (hoặc khi được cấp quyền) mới được thêm vào hàng đợi!' });
      }
      return;
    }

    const { url, type, videoId, title } = payload;
    if (!url || typeof url !== 'string') return;

    const user = room.users.find((u) => u.id === socket.id);
    const item = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: url.trim(),
      type: type || 'youtube',
      videoId: videoId || '',
      title: (typeof title === 'string' && title.trim()) ? title.trim().slice(0, 80) : url.trim().slice(0, 60),
      addedBy: user ? user.name : 'Thành viên'
    };

    room.playlist = room.playlist || [];
    if (room.playlist.length >= 25) {
      if (typeof callback === 'function') callback({ error: 'Hàng đợi tối đa 25 phim!' });
      return;
    }
    room.playlist.push(item);

    const sysMsg = {
      id: `sys-${Date.now()}`,
      type: 'system',
      text: `📋 ${item.addedBy} đã thêm phim vào hàng đợi (${room.playlist.length} phim chờ).`,
      createdAt: Date.now()
    };
    room.messages.push(sysMsg);

    io.to(room.roomId).emit('room-updated', serializeRoom(room));
    io.to(room.roomId).emit('chat-message', sysMsg);
    if (typeof callback === 'function') callback({ ok: true, item });
  });

  socket.on('remove-from-playlist', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !canAddVideo(room, socket.id)) return;
    const { itemId } = payload;
    room.playlist = (room.playlist || []).filter((it) => it.id !== itemId);
    io.to(room.roomId).emit('room-updated', serializeRoom(room));
  });

  socket.on('play-next-video', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!canControlVideo(room, socket.id) && !canAddVideo(room, socket.id)) {
      if (typeof callback === 'function') callback({ error: 'Bạn không có quyền chuyển phim tiếp theo!' });
      return;
    }

    room.playlist = room.playlist || [];
    if (room.playlist.length === 0) {
      if (typeof callback === 'function') callback({ empty: true });
      return;
    }

    const targetId = payload.itemId;
    let nextIndex = 0;
    if (targetId) {
      const foundIdx = room.playlist.findIndex((it) => it.id === targetId);
      if (foundIdx !== -1) nextIndex = foundIdx;
    }

    const [nextItem] = room.playlist.splice(nextIndex, 1);
    const user = room.users.find((u) => u.id === socket.id);

    room.videoState = {
      url: nextItem.url,
      type: nextItem.type,
      videoId: nextItem.videoId || '',
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now()
    };

    const sysMsg = {
      id: `sys-${Date.now()}`,
      type: 'system',
      text: `⏭️ Đang phát tiếp từ hàng đợi: ${nextItem.title} (thêm bởi ${nextItem.addedBy}).`,
      createdAt: Date.now()
    };
    room.messages.push(sysMsg);

    io.to(room.roomId).emit('video-changed', {
      videoState: room.videoState,
      changedBy: user ? user.name : 'Hệ thống'
    });
    io.to(room.roomId).emit('room-updated', serializeRoom(room));
    io.to(room.roomId).emit('chat-message', sysMsg);
    if (typeof callback === 'function') callback({ ok: true });
  });

  // 6c. Đếm ngược 3-2-1 đồng bộ (hữu ích cho Iframe hoặc bắt đầu phim)
  socket.on('start-countdown', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!canControlVideo(room, socket.id)) return;
    const user = room.users.find((u) => u.id === socket.id);
    io.to(room.roomId).emit('countdown-started', {
      startedBy: user ? user.name : 'Chủ phòng',
      startedAt: Date.now()
    });
  });

  // 6d. Bình chọn nhanh (Quick Poll)
  socket.on('create-poll', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const question = typeof payload.question === 'string' ? payload.question.trim().slice(0, 120) : '';
    const rawOptions = Array.isArray(payload.options) ? payload.options : [];
    const cleanOptions = rawOptions
      .map((o) => (typeof o === 'string' ? o.trim().slice(0, 60) : ''))
      .filter(Boolean)
      .slice(0, 4);

    if (!question || cleanOptions.length < 2) {
      if (typeof callback === 'function') {
        callback({ error: 'Cần nhập câu hỏi và ít nhất 2 lựa chọn!' });
      }
      return;
    }

    const user = room.users.find((u) => u.id === socket.id);
    room.activePoll = {
      id: `poll-${Date.now()}`,
      question,
      createdBy: user ? user.name : 'Thành viên',
      options: cleanOptions.map((text, idx) => ({
        id: `opt-${idx}`,
        text,
        voters: []
      }))
    };

    io.to(room.roomId).emit('room-updated', serializeRoom(room));
    if (typeof callback === 'function') callback({ ok: true });
  });

  socket.on('vote-poll', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.activePoll) return;
    const { optionId } = payload;

    room.activePoll.options.forEach((opt) => {
      opt.voters = opt.voters.filter((uid) => uid !== socket.id);
      if (opt.id === optionId) {
        opt.voters.push(socket.id);
      }
    });

    io.to(room.roomId).emit('room-updated', serializeRoom(room));
  });

  socket.on('close-poll', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    room.activePoll = null;
    io.to(room.roomId).emit('room-updated', serializeRoom(room));
  });

  // 6e. Chibi cụng ly / đập tay
  socket.on('chibi-highfive', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const user = room.users.find((u) => u.id === socket.id);
    io.to(room.roomId).emit('chibi-highfive-received', {
      id: `hf-${Date.now()}`,
      byName: user ? user.name : 'Thành viên'
    });
  });

  // 7. Đồng bộ Play / Pause / Seek
  socket.on('video-action', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!canControlVideo(room, socket.id)) return;

    const { action, currentTime } = payload;
    const numericTime =
      typeof currentTime === 'number' && !Number.isNaN(currentTime) && currentTime >= 0
        ? currentTime
        : room.videoState.currentTime;

    if (action === 'play') {
      room.videoState.isPlaying = true;
      room.videoState.currentTime = numericTime;
      room.videoState.updatedAt = Date.now();
    } else if (action === 'pause') {
      room.videoState.isPlaying = false;
      room.videoState.currentTime = numericTime;
      room.videoState.updatedAt = Date.now();
    } else if (action === 'seek') {
      room.videoState.currentTime = numericTime;
      room.videoState.updatedAt = Date.now();
    } else {
      return;
    }

    const user = room.users.find((u) => u.id === socket.id);
    socket.to(room.roomId).emit('video-sync', {
      action,
      isPlaying: room.videoState.isPlaying,
      currentTime: room.videoState.currentTime,
      updatedAt: room.videoState.updatedAt,
      actorName: user ? user.name : 'Thành viên'
    });
  });

  // 8. Tin nhắn Chat
  socket.on('chat-message', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 500) : '';
    if (!text) return;

    const user = room.users.find((u) => u.id === socket.id);
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'user',
      senderId: socket.id,
      senderName: user ? user.name : 'Khán giả',
      isAdmin: Boolean(user && user.isAdmin),
      isHost: room.hostId === socket.id,
      text,
      createdAt: Date.now()
    };

    room.messages.push(msg);
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    io.to(room.roomId).emit('chat-message', msg);
  });

  // 9. Thả cảm xúc bay trên màn hình (Floating Reactions)
  socket.on('send-reaction', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const emoji = typeof payload.emoji === 'string' ? payload.emoji.slice(0, 8) : '❤️';
    const user = room.users.find((u) => u.id === socket.id);

    io.to(room.roomId).emit('reaction-received', {
      id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      senderName: user ? user.name : 'Khán giả'
    });
  });

  // 10. Trạng thái Mic & WebRTC Signaling
  socket.on('mic-state', (payload = {}, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (!user) return;

    const wantUnmute = payload.isMuted === false;
    if (wantUnmute && user.isMuted) {
      const activeMics = room.users.filter((u) => !u.isMuted && u.id !== socket.id).length;
      if (activeMics >= MAX_SIMULTANEOUS_MICS) {
        if (typeof callback === 'function') {
          callback({
            error: `Đang có tối đa ${MAX_SIMULTANEOUS_MICS} người bật mic cùng lúc để đảm bảo âm thanh mượt!`
          });
        }
        return;
      }
    }

    if (typeof payload.isMuted === 'boolean') {
      user.isMuted = payload.isMuted;
    }
    if (typeof payload.isSpeaking === 'boolean') {
      user.isSpeaking = user.isMuted ? false : payload.isSpeaking;
    }

    io.to(room.roomId).emit('user-voice-updated', {
      userId: socket.id,
      isMuted: user.isMuted,
      isSpeaking: user.isSpeaking
    });
    if (typeof callback === 'function') callback({ ok: true });
  });

  socket.on('webrtc-signal', (payload = {}) => {
    const { targetId, signalData } = payload;
    if (!targetId || !signalData) return;
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    // Chỉ cho phép gửi signal tới người trong cùng phòng
    const targetInRoom = room.users.some((u) => u.id === targetId);
    if (!targetInRoom) return;

    io.to(targetId).emit('webrtc-signal', {
      fromId: socket.id,
      signalData
    });
  });

  // 10b. Chia sẻ màn hình / Tab phim (Screen Share WebRTC cho Netflix, Web phim, FB...)
  socket.on('screen-share-state', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!canControlVideo(room, socket.id) && !canAddVideo(room, socket.id)) return;

    const user = room.users.find((u) => u.id === socket.id);
    const isSharing = Boolean(payload.isSharing);

    io.to(room.roomId).emit('screen-share-updated', {
      sharerId: isSharing ? socket.id : null,
      sharerName: isSharing && user ? user.name : null,
      isSharing
    });
  });

  socket.on('screen-signal', (payload = {}) => {
    const { targetId, signalData } = payload;
    if (!targetId || !signalData) return;
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const targetInRoom = room.users.some((u) => u.id === targetId);
    if (!targetInRoom) return;

    io.to(targetId).emit('screen-signal', {
      fromId: socket.id,
      signalData
    });
  });

  // 11. Admin tắt mic hoặc mời thành viên ra khỏi phòng
  socket.on('admin-mute-user', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const caller = room.users.find((u) => u.id === socket.id);
    if (room.hostId !== socket.id && !(caller && caller.isAdmin)) return;

    const target = room.users.find((u) => u.id === payload.targetId);
    if (!target) return;

    target.isMuted = true;
    target.isSpeaking = false;
    io.to(target.id).emit('force-muted', {
      byName: caller ? caller.name : 'Chủ phòng'
    });
    io.to(room.roomId).emit('user-voice-updated', {
      userId: target.id,
      isMuted: true,
      isSpeaking: false
    });
  });

  socket.on('admin-kick-user', (payload = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const caller = room.users.find((u) => u.id === socket.id);
    if (room.hostId !== socket.id && !(caller && caller.isAdmin)) return;

    const targetId = payload.targetId;
    if (!targetId || targetId === socket.id) return;

    const target = room.users.find((u) => u.id === targetId);
    if (!target) return;

    io.to(targetId).emit('kicked-from-room', {
      byName: caller ? caller.name : 'Admin'
    });

    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.leave(room.roomId);
    }

    const result = leaveRoom(targetId);
    if (result && !result.roomDeleted) {
      io.to(room.roomId).emit('room-updated', serializeRoom(result.room));
      if (result.systemMessage) {
        io.to(room.roomId).emit('chat-message', result.systemMessage);
      }
    }
  });

  // 12. Rời phòng chủ động hoặc ngắt kết nối
  const handleDisconnect = () => {
    const result = leaveRoom(socket.id);
    if (!result) return;
    socket.leave(result.roomId);
    if (!result.roomDeleted && result.room) {
      io.to(result.roomId).emit('room-updated', serializeRoom(result.room));
      io.to(result.roomId).emit('peer-left', { peerId: socket.id });
      if (result.systemMessage) {
        io.to(result.roomId).emit('chat-message', result.systemMessage);
      }
    }
  };

  socket.on('leave-room', handleDisconnect);
  socket.on('disconnect', handleDisconnect);
});

// Phục vụ Frontend tĩnh (client/dist) khi build production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🎬 Cinema Watch Party Server đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
