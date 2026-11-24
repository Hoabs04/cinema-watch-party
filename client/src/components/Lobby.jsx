import React, { useState, useEffect } from 'react';
import {
  Film,
  Sparkles,
  Users,
  Lock,
  ShieldCheck,
  Play,
  LogIn,
  Mic,
  Tv,
  MessageSquareHeart,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  KeyRound,
} from 'lucide-react';

const CAPACITIES = [4, 6, 8, 10, 15, 20];

export default function Lobby({
  userName,
  setUserName,
  initialRoomCode,
  adminAuth,
  onOpenAdminModal,
  onCreateRoom,
  onJoinRoom,
  errorMsg,
  isLoading,
}) {
  const [selectedCapacity, setSelectedCapacity] = useState(4);
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode || '');

  const isAdmin = Boolean(adminAuth?.token);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (!isAdmin && selectedCapacity > 4) {
      setSelectedCapacity(4);
    }
  }, [isAdmin, selectedCapacity]);

  const handleCapacityClick = (cap) => {
    if (cap === 4 || isAdmin) {
      setSelectedCapacity(cap);
    } else {
      onOpenAdminModal();
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    onCreateRoom({
      userName,
      maxUsers: isAdmin ? selectedCapacity : 4,
    });
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    onJoinRoom({
      userName,
      roomCode: roomCodeInput.trim().toUpperCase(),
    });
  };

  return (
    <div className="min-h-screen flex flex-col cinema-bg-pastel text-white relative overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-white/20 bg-white/10 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400/90 to-emerald-500/90 border border-white/40 flex items-center justify-center shadow-[0_4px_0_rgba(17,94,89,0.6),0_10px_20px_rgba(20,184,166,0.35)]">
              <Film className="w-5 h-5 text-white stroke-[2.4]" />
            </div>
            <div>
              <span className="font-black text-base sm:text-lg tracking-tight text-white drop-shadow whitespace-nowrap">
                RẠP PHIM ONLINE
              </span>
              <span className="hidden sm:inline-block ml-2.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-teal-100 border border-white/25 backdrop-blur-md">
                Cinema Watch Party
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAdminModal}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              isAdmin
                ? 'bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 shadow-[0_3px_0_rgba(6,95,70,0.45)]'
                : 'btn-3d-soft text-white'
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Admin: {adminAuth.username || 'admin'}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-teal-200" />
                <span>Đăng nhập Admin</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col justify-center">
        {/* Hero Headline */}
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-teal-100 text-xs font-bold shadow-sm">
            <UserCheck className="w-3.5 h-3.5 text-teal-200" />
            <span>
              Không cần tạo tài khoản — Chỉ cần nhập tên hiển thị để vào rạp!
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            Xem Phim Cùng Nhau,{' '}
            <span className="bg-gradient-to-r from-teal-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              Trò Chuyện Thời Gian Thực
            </span>
          </h1>

          <p className="text-sm sm:text-base text-teal-100/85 font-medium drop-shadow">
            Đồng bộ Play/Pause/Tua cho YouTube, link phim MP4, HLS (.m3u8) &amp;
            Web Embed. Hỗ trợ Voice Chat trực tiếp, chat phòng và thả cảm xúc!
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-xl mx-auto w-full mb-6 rounded-2xl bg-rose-500/25 backdrop-blur-md border border-rose-300/40 px-4 py-3 flex items-center gap-3 text-sm font-semibold text-white shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Display Name Bar */}
        <div className="max-w-xl mx-auto w-full mb-8">
          <div className="rounded-3xl cinema-card-3d p-5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-teal-200 mb-2">
              Bước 1: Nhập Tên Hiển Thị Của Bạn (Không Cần Đăng Ký)
            </label>
            <div className="relative">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ví dụ: Minh, Lan, Hoàng..."
                maxLength={24}
                className="w-full px-4 py-3 rounded-2xl input-3d focus:outline-none text-base font-bold text-white placeholder-white/45"
              />
              {userName?.trim() && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-emerald-200 flex items-center gap-1 font-bold bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-300/35">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sẵn sàng
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Two 3D Frosted Glass Cards - Create Room & Join Room */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Tạo Phòng Chiếu Mới */}
          <form
            onSubmit={handleCreateSubmit}
            className="rounded-3xl cinema-card-3d cinema-card-3d-hover p-6 flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400/90 to-emerald-500/90 border border-white/35 shadow-[0_4px_0_rgba(17,94,89,0.6),0_8px_16px_rgba(20,184,166,0.3)] flex items-center justify-center text-white">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white">
                      Tạo Phòng Chiếu Mới
                    </h2>
                    <p className="text-xs font-medium text-teal-100/75">
                      Khởi tạo rạp riêng và gửi mã mời bạn bè
                    </p>
                  </div>
                </div>
              </div>

              {/* Capacity Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-100 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-200" />
                    Số lượng ghế tối đa:
                  </span>
                  <span className="text-xs font-extrabold text-white bg-white/15 px-2.5 py-0.5 rounded-full border border-white/25">
                    {selectedCapacity === 4
                      ? '4 người (Mặc định)'
                      : `${selectedCapacity} người (Admin)`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {CAPACITIES.map((cap) => {
                    const isLocked = cap > 4 && !isAdmin;
                    const isSelected = selectedCapacity === cap;
                    return (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => handleCapacityClick(cap)}
                        className={`relative min-h-[42px] px-2 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          isSelected
                            ? 'btn-3d-pink'
                            : isLocked
                            ? 'bg-white/5 border border-white/15 text-white/55 hover:border-teal-300/50 hover:text-teal-100'
                            : 'btn-3d-soft text-white'
                        }`}
                      >
                        <span>{cap} người</span>
                        {cap === 4 && (
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-teal-100' : 'text-white/60'}`}>
                            (Free)
                          </span>
                        )}
                        {isLocked && (
                          <Lock className="w-3.5 h-3.5 text-teal-200/80 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {!isAdmin ? (
                  <button
                    type="button"
                    onClick={onOpenAdminModal}
                    className="w-full mt-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/18 border border-white/20 text-teal-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-teal-200" />
                    <span>
                      Đăng nhập Admin để mở rộng 6 – 20 ghế (hoặc nâng cấp sau trong phòng)
                    </span>
                  </button>
                ) : (
                  <div className="text-xs font-bold text-emerald-100 bg-emerald-400/15 border border-emerald-300/30 rounded-xl px-3 py-2 flex items-center gap-1.5 pt-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>
                      Quyền Admin đang bật: Bạn có thể tạo phòng từ 4 đến 20 người.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full py-3.5 px-5 rounded-2xl btn-3d-pink disabled:opacity-50 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'Đang khởi tạo rạp...'
                  : `Tạo Phòng Ngay (${selectedCapacity} ghế)`}
              </span>
            </button>
          </form>

          {/* Card 2: Vào Phòng Bằng Mã */}
          <form
            onSubmit={handleJoinSubmit}
            className="rounded-3xl cinema-card-3d cinema-card-3d-hover p-6 flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/90 to-teal-500/90 border border-white/35 shadow-[0_4px_0_rgba(14,116,144,0.6),0_8px_16px_rgba(6,182,212,0.3)] flex items-center justify-center text-white">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Vào Phòng Bằng Mã
                  </h2>
                  <p className="text-xs font-medium text-teal-100/75">
                    Nhập mã phòng 6 ký tự từ bạn bè để vào xem ngay
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-teal-100">
                  Mã Phòng Chiếu:
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) =>
                    setRoomCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="VD: AB12CD"
                  maxLength={10}
                  className="w-full px-4 py-3.5 rounded-2xl input-3d focus:outline-none text-center font-mono text-xl tracking-[0.25em] uppercase font-black text-white placeholder-white/40"
                />
                <p className="text-xs text-teal-100/75 leading-relaxed pt-1">
                  💡 Nếu bạn mở bằng đường link mời có sẵn mã phòng, mã đã được tự động điền ở trên!
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full py-3.5 px-5 rounded-2xl bg-gradient-to-b from-cyan-400/85 to-teal-500/85 backdrop-blur-md text-white border border-white/35 shadow-[0_4px_0_rgba(14,116,144,0.75),0_10px_22px_-4px_rgba(6,182,212,0.4),inset_0_1px_2px_rgba(255,255,255,0.45)] hover:brightness-105 active:translate-y-1 active:shadow-[0_1px_0_rgba(14,116,144,0.75)] disabled:opacity-50 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>
                {isLoading ? 'Đang kết nối...' : 'Vào Phòng Chiếu'}
              </span>
            </button>
          </form>
        </div>

        {/* Feature Highlights Footer */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-teal-100/80">
          <div className="rounded-2xl cinema-card-3d p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-teal-200 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">
                Đa nguồn phát đồng bộ
              </div>
              <div>YouTube, MP4/WebM, HLS (.m3u8) &amp; Web Embed</div>
            </div>
          </div>

          <div className="rounded-2xl cinema-card-3d p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-emerald-200 shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">
                Voice Chat WebRTC P2P
              </div>
              <div>Đàm thoại trực tiếp không độ trễ, tự nhận diện giọng nói</div>
            </div>
          </div>

          <div className="rounded-2xl cinema-card-3d p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-cyan-200 shrink-0">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">
                4 – 20 người cùng xem
              </div>
              <div>Mặc định 4 ghế miễn phí, Admin mở rộng tức thì tới 20 ghế</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
