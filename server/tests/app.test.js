const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  verifyCredentials,
  generateAdminToken,
  verifyAdminToken
} = require('../auth');

const {
  createRoom,
  joinRoom,
  updateRoomCapacity,
  leaveRoom,
  clearAllRooms
} = require('../roomManager');

describe('server/auth.js - Admin Authentication & Token Verification', () => {
  test('verifyCredentials validates valid and invalid admin credentials', () => {
    assert.equal(verifyCredentials('hoabs04', 'hoabs123'), true);
    assert.equal(verifyCredentials('  hoabs04  ', 'hoabs123'), true);
    assert.equal(verifyCredentials('nhuquynh', 'quyncute'), true);
    assert.equal(verifyCredentials('hoabs04', 'wrongpass'), false);
    assert.equal(verifyCredentials('nhuquynh', 'hoabs123'), false);
    assert.equal(verifyCredentials('wronguser', 'hoabs123'), false);
    assert.equal(verifyCredentials(null, 'hoabs123'), false);
    assert.equal(verifyCredentials('hoabs04', undefined), false);
  });

  test('generateAdminToken and verifyAdminToken pass valid tokens and reject tampered tokens', () => {
    const token = generateAdminToken('admin');
    assert.equal(typeof token, 'string');
    assert.ok(token.includes('.'));

    const payload = verifyAdminToken(token);
    assert.ok(payload);
    assert.equal(payload.username, 'admin');
    assert.equal(payload.role, 'admin');

    // Tampered signature
    const [payloadB64, sig] = token.split('.');
    const tamperedSig = sig.slice(0, -2) + (sig.endsWith('aa') ? 'bb' : 'aa');
    assert.equal(verifyAdminToken(`${payloadB64}.${tamperedSig}`), null);

    // Tampered payload
    const fakePayload = Buffer.from(JSON.stringify({ username: 'hacker', role: 'admin', exp: Date.now() + 60000 })).toString('base64url');
    assert.equal(verifyAdminToken(`${fakePayload}.${sig}`), null);

    // Invalid formats
    assert.equal(verifyAdminToken(''), null);
    assert.equal(verifyAdminToken(null), null);
    assert.equal(verifyAdminToken('not-a-valid-token'), null);
  });
});

describe('server/roomManager.js - Room Capacity, Admin Controls & Host Transfer', () => {
  beforeEach(() => {
    clearAllRooms();
  });

  test('Normal user creating a room defaults to maxUsers = 4 and rejects maxUsers > 4', () => {
    const resDefault = createRoom({ hostSocketId: 'host-1', hostName: 'Hòa', isAdmin: false });
    assert.ok(resDefault.room);
    assert.equal(resDefault.room.maxUsers, 4);

    const resOver = createRoom({ hostSocketId: 'host-2', hostName: 'Hòa', maxUsers: 6, isAdmin: false });
    assert.ok(resOver.error);
    assert.match(resOver.error, /Admin/);
  });

  test('Normal room rejects the 5th user with a clear error message', () => {
    const { room } = createRoom({ hostSocketId: 'u1', hostName: 'User 1' });
    assert.ok(joinRoom({ roomId: room.roomId, socketId: 'u2', userName: 'User 2' }).room);
    assert.ok(joinRoom({ roomId: room.roomId, socketId: 'u3', userName: 'User 3' }).room);
    assert.ok(joinRoom({ roomId: room.roomId, socketId: 'u4', userName: 'User 4' }).room);

    const fifthJoin = joinRoom({ roomId: room.roomId, socketId: 'u5', userName: 'User 5' });
    assert.ok(fifthJoin.error);
    assert.match(fifthJoin.error, /Phòng đã đầy/);
  });

  test('Admin user can create rooms with capacities 6, 8, 10, 15, 20 and rejects invalid capacities like 7 or 25', () => {
    for (const cap of [6, 8, 10, 15, 20]) {
      const res = createRoom({
        hostSocketId: `admin-${cap}`,
        hostName: 'Admin Hòa',
        maxUsers: cap,
        isAdmin: true
      });
      assert.ok(res.room, `Should allow capacity ${cap}`);
      assert.equal(res.room.maxUsers, cap);
    }

    for (const invalidCap of [7, 25]) {
      const res = createRoom({
        hostSocketId: `admin-inv-${invalidCap}`,
        hostName: 'Admin Hòa',
        maxUsers: invalidCap,
        isAdmin: true
      });
      assert.ok(res.error, `Should reject invalid capacity ${invalidCap}`);
    }
  });

  test('updateRoomCapacity upgrades an existing 4-person room to 10 or 20 when called by Admin, and rejects non-admin', () => {
    const { room } = createRoom({ hostSocketId: 'host-1', hostName: 'Host', isAdmin: false });
    assert.equal(room.maxUsers, 4);

    // Non-admin attempt fails
    const nonAdminRes = updateRoomCapacity({
      roomId: room.roomId,
      socketId: 'host-1',
      newMaxUsers: 10,
      isAdmin: false
    });
    assert.ok(nonAdminRes.error);

    // Admin upgrade to 10 succeeds
    const adminRes10 = updateRoomCapacity({
      roomId: room.roomId,
      socketId: 'host-1',
      newMaxUsers: 10,
      isAdmin: true
    });
    assert.ok(adminRes10.room);
    assert.equal(adminRes10.room.maxUsers, 10);

    // Admin upgrade to 20 succeeds
    const adminRes20 = updateRoomCapacity({
      roomId: room.roomId,
      socketId: 'host-1',
      newMaxUsers: 20,
      isAdmin: true
    });
    assert.ok(adminRes20.room);
    assert.equal(adminRes20.room.maxUsers, 20);
  });

  test('Host transfer works automatically when the current host leaves the room', () => {
    const { room } = createRoom({ hostSocketId: 'host-1', hostName: 'Host 1' });
    joinRoom({ roomId: room.roomId, socketId: 'user-2', userName: 'User 2' });
    joinRoom({ roomId: room.roomId, socketId: 'user-3', userName: 'User 3' });

    const leaveRes = leaveRoom('host-1');
    assert.ok(leaveRes);
    assert.equal(leaveRes.roomDeleted, false);
    assert.equal(leaveRes.room.hostId, 'user-2');
    assert.equal(leaveRes.newHost.id, 'user-2');
  });
});

describe('client/src/utils/videoParser.js - Video URL Parsing', () => {
  test('Parses YouTube watch, youtu.be, shorts, .mp4, .m3u8, and iframe fallback cleanly', async () => {
    const parserPath = path.resolve(__dirname, '../../client/src/utils/videoParser.js');
    const { parseVideoUrl } = await import(pathToFileURL(parserPath).href);

    // YouTube watch
    const ytWatch = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.deepEqual(ytWatch, {
      type: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });

    // youtu.be
    const ytShortLink = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=10');
    assert.equal(ytShortLink.type, 'youtube');
    assert.equal(ytShortLink.videoId, 'dQw4w9WgXcQ');

    // YouTube shorts
    const ytShorts = parseVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    assert.equal(ytShorts.type, 'youtube');
    assert.equal(ytShorts.videoId, 'dQw4w9WgXcQ');

    // Direct .mp4
    const mp4 = parseVideoUrl('https://cdn.example.com/movies/sample.mp4?token=123');
    assert.deepEqual(mp4, {
      type: 'video',
      videoId: '',
      url: 'https://cdn.example.com/movies/sample.mp4?token=123'
    });

    // HLS .m3u8
    const hls = parseVideoUrl('https://stream.example.com/live/playlist.m3u8');
    assert.deepEqual(hls, {
      type: 'hls',
      videoId: '',
      url: 'https://stream.example.com/live/playlist.m3u8'
    });

    // Generic iframe fallback
    const iframe = parseVideoUrl('https://player.vimeo.com/video/76979871');
    assert.deepEqual(iframe, {
      type: 'iframe',
      videoId: '',
      url: 'https://player.vimeo.com/video/76979871'
    });

    // Invalid input
    assert.equal(parseVideoUrl(''), null);
    assert.equal(parseVideoUrl('not-a-url'), null);
  });
});
