import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  X,
  LogOut,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function AdminModal({
  isOpen,
  onClose,
  adminAuth,
  onLoginSuccess,
  onLogout,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoggedIn = Boolean(adminAuth?.token);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu Admin!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: cleanUser,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Đăng nhập Admin thất bại!');
        setIsSubmitting(false);
        return;
      }

      setPassword('');
      setIsSubmitting(false);
      if (onLoginSuccess) {
        onLoginSuccess({
          token: data.token,
          username: data.username || cleanUser,
        });
      }
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại!');
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md">
      <div
        className="relative w-full max-w-md rounded-3xl cinema-card-3d overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-rose-400 to-fuchsia-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400/90 to-emerald-500/90 shadow-lg shadow-pink-500/30 border border-white/30 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">
                Quản Trị Viên Rạp Phim
              </h3>
              <p className="text-xs font-medium text-teal-200/85">
                Mở khóa phòng chiếu lớn 6 – 20 người
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Explanation Box */}
          <div className="rounded-2xl bg-white/10 border border-white/20 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5 text-xs text-teal-50/90 leading-relaxed">
              <Users className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">
                  Khán giả thông thường không cần tài khoản!
                </span>{' '}
                Mọi người có thể tự tạo phòng <strong>4 người</strong> hoặc vào bất kỳ phòng nào chỉ bằng Tên hiển thị.
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-teal-50/90 leading-relaxed">
              <Sparkles className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
              <div>
                Tài khoản <span className="text-teal-300 font-bold">Admin</span> dùng để tạo mới hoặc nâng cấp trực tiếp phòng đang xem lên{' '}
                <strong className="text-white">6, 8, 10, 15 hoặc 20 ghế</strong>.
              </div>
            </div>
          </div>

          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-400/15 border border-emerald-300/35 p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-200">
                    Đã kích hoạt quyền Admin
                  </div>
                  <div className="text-xs text-white/80 truncate">
                    Tài khoản đang đăng nhập:{' '}
                    <span className="font-mono font-bold text-white">
                      {adminAuth.username || 'admin'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-teal-100/80 leading-relaxed">
                Bạn hiện có thể tạo phòng chiếu lên tới <strong>20 người</strong> tại trang chủ hoặc nâng cấp số ghế trực tiếp ngay bên trong phòng chiếu.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl btn-3d-soft text-white text-sm font-bold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-3d-pink text-sm font-bold cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất Admin
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl bg-rose-500/25 border border-rose-300/40 px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-rose-100">
                  <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-teal-100 mb-1.5">
                  Tài khoản Admin
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-teal-200/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tài khoản Admin..."
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl input-3d focus:outline-none text-sm text-white placeholder-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-100 mb-1.5">
                  Mật khẩu Admin
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-teal-200/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    autoComplete="current-password"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl input-3d focus:outline-none text-sm text-white placeholder-white/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl btn-3d-soft text-white/90 text-sm font-bold cursor-pointer"
                >
                  Để sau
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-3d-pink disabled:opacity-50 font-bold text-sm cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập Admin'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
