const ALLOWED_CAPACITIES = [4, 6, 8, 10, 15, 20];
const DEFAULT_CAPACITY = 4;
const MAX_SIMULTANEOUS_MICS = 6;

const rooms = new Map();
const socketToRoom = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  do {
    result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(result));
  return result;
}

function sanitizeName(name, fallback = 'Khán giả') {
  if (typeof name !== 'string') return fallback;
  const cleaned = name.trim().slice(0, 24);
  return cleaned || fallback;
}

function getEstimatedCurrentTime(room) {
  if (!room || !room.videoState) return 0;
  const { isPlaying, currentTime, updatedAt, type } = room.videoState;
  if (isPlaying && type !== 'iframe') {
    const elapsedSec = Math.max(0, (Date.now() - updatedAt) / 1000);
    return currentTime + elapsedSec;
  }
  return currentTime || 0;
}

function serializeRoom(room) {
  if (!room) return null;
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    maxUsers: room.maxUsers,
    allowAllControl: room.allowAllControl,
    allowAllAddVideo: room.allowAllAddVideo,
    users: room.users,
    videoState: {
      ...room.videoState,
      currentTime: getEstimatedCurrentTime(room)
    },
    playlist: room.playlist || [],
    activePoll: room.activePoll || null,
    messages: room.messages.slice(-50)
  };
}

function createRoom({ hostSocketId, hostName, maxUsers = DEFAULT_CAPACITY, isAdmin = false }) {
  const requestedCap = Number(maxUsers);
  let validMaxUsers = DEFAULT_CAPACITY;

  if (requestedCap > DEFAULT_CAPACITY) {
    if (!isAdmin) {
      return { error: 'Chỉ tài khoản Admin mới có thể tạo phòng trên 4 người!' };
    }
    if (!ALLOWED_CAPACITIES.includes(requestedCap)) {
      return { error: `Sức chứa không hợp lệ. Chọn một trong các mốc: ${ALLOWED_CAPACITIES.join(', ')}` };
    }
    validMaxUsers = requestedCap;
  }

  const roomId = generateRoomId();
  const cleanName = sanitizeName(hostName, 'Chủ rạp');

  const room = {
    roomId,
    hostId: hostSocketId,
    maxUsers: validMaxUsers,
    allowAllControl: false,
    allowAllAddVideo: false,
    createdAt: Date.now(),
    users: [
      {
        id: hostSocketId,
        name: cleanName,
        isMuted: true,
        isSpeaking: false,
        isAdmin: Boolean(isAdmin)
      }
    ],
    videoState: {
      url: '',
      type: 'youtube',
      videoId: '',
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now()
    },
    playlist: [],
    activePoll: null,
    messages: [
      {
        id: `sys-${Date.now()}`,
        type: 'system',
        text: `🎬 ${cleanName} đã khởi tạo rạp chiếu (${validMaxUsers} ghế).`,
        createdAt: Date.now()
      }
    ]
  };

  rooms.set(roomId, room);
  socketToRoom.set(hostSocketId, roomId);
  return { room };
}

function joinRoom({ roomId, socketId, userName, isAdmin = false }) {
  if (!roomId || typeof roomId !== 'string') {
    return { error: 'Vui lòng nhập mã phòng hợp lệ!' };
  }
  const normalizedId = roomId.trim().toUpperCase();
  const room = rooms.get(normalizedId);

  if (!room) {
    return { error: `Không tìm thấy phòng "${normalizedId}"!` };
  }

  const existingUser = room.users.find((u) => u.id === socketId);
  if (existingUser) {
    return { room };
  }

  if (room.users.length >= room.maxUsers) {
    return {
      error: `Phòng đã đầy (${room.users.length}/${room.maxUsers} người). Hãy nhờ Admin nâng cấp thêm ghế!`
    };
  }

  const cleanName = sanitizeName(userName, 'Khán giả');
  const newUser = {
    id: socketId,
    name: cleanName,
    isMuted: true,
    isSpeaking: false,
    isAdmin: Boolean(isAdmin)
  };

  room.users.push(newUser);
  socketToRoom.set(socketId, normalizedId);

  const joinMsg = {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'system',
    text: `👋 ${cleanName} đã vào rạp (${room.users.length}/${room.maxUsers}).`,
    createdAt: Date.now()
  };
  room.messages.push(joinMsg);

  return { room, user: newUser, systemMessage: joinMsg };
}

function updateRoomCapacity({ roomId, socketId, newMaxUsers, isAdmin = false }) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Không tìm thấy phòng!' };

  const user = room.users.find((u) => u.id === socketId);
  const hasAdminRight = Boolean(isAdmin || (user && user.isAdmin));

  if (!hasAdminRight) {
    return { error: 'Chỉ tài khoản Admin mới có quyền mở rộng sức chứa phòng!' };
  }

  const targetCap = Number(newMaxUsers);
  if (!ALLOWED_CAPACITIES.includes(targetCap)) {
    return { error: `Sức chứa phải thuộc các mốc: ${ALLOWED_CAPACITIES.join(', ')}` };
  }

  if (targetCap < room.users.length) {
    return {
      error: `Hiện đang có ${room.users.length} người trong phòng, không thể giảm xuống ${targetCap} ghế!`
    };
  }

  if (user && isAdmin) {
    user.isAdmin = true;
  }

  room.maxUsers = targetCap;
  const sysMsg = {
    id: `sys-${Date.now()}`,
    type: 'system',
    text: `✨ Admin ${user ? user.name : ''} đã nâng cấp sức chứa phòng lên ${targetCap} người!`,
    createdAt: Date.now()
  };
  room.messages.push(sysMsg);

  return { room, systemMessage: sysMsg };
}

function canControlVideo(room, socketId) {
  if (!room) return false;
  if (room.allowAllControl) return true;
  if (room.hostId === socketId) return true;
  const user = room.users.find((u) => u.id === socketId);
  return Boolean(user && user.isAdmin);
}

function canAddVideo(room, socketId) {
  if (!room) return false;
  if (room.allowAllAddVideo) return true;
  if (room.hostId === socketId) return true;
  const user = room.users.find((u) => u.id === socketId);
  return Boolean(user && user.isAdmin);
}

function leaveRoom(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;

  socketToRoom.delete(socketId);
  const room = rooms.get(roomId);
  if (!room) return null;

  const userIndex = room.users.findIndex((u) => u.id === socketId);
  if (userIndex === -1) return null;

  const [removedUser] = room.users.splice(userIndex, 1);

  if (room.users.length === 0) {
    rooms.delete(roomId);
    return { roomId, removedUser, roomDeleted: true };
  }

  let newHost = null;
  if (room.hostId === socketId) {
    room.hostId = room.users[0].id;
    newHost = room.users[0];
  }

  const sysMsg = {
    id: `sys-${Date.now()}`,
    type: 'system',
    text: newHost
      ? `🚪 ${removedUser.name} đã rời rạp. 👑 ${newHost.name} là chủ phòng mới.`
      : `🚪 ${removedUser.name} đã rời rạp (${room.users.length}/${room.maxUsers}).`,
    createdAt: Date.now()
  };
  room.messages.push(sysMsg);

  return { roomId, room, removedUser, newHost, systemMessage: sysMsg, roomDeleted: false };
}

function getRoomBySocket(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) || null;
}

function getRoom(roomId) {
  if (!roomId) return null;
  return rooms.get(roomId.trim().toUpperCase()) || null;
}

function clearAllRooms() {
  rooms.clear();
  socketToRoom.clear();
}

module.exports = {
  ALLOWED_CAPACITIES,
  DEFAULT_CAPACITY,
  MAX_SIMULTANEOUS_MICS,
  createRoom,
  joinRoom,
  updateRoomCapacity,
  canControlVideo,
  canAddVideo,
  leaveRoom,
  getRoomBySocket,
  getRoom,
  getEstimatedCurrentTime,
  serializeRoom,
  clearAllRooms
};
