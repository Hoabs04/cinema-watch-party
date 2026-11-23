# 🎬 Rạp Phim Online — Cinema Watch Party

Ứng dụng web **Rạp Phim Trực Tuyến** cho phép bạn bè và người thân cùng xem phim đồng bộ thời gian thực, trò chuyện trực tiếp bằng **Voice Chat (WebRTC)**, nhắn tin kèm **Mascot Chibi** tương tác, thả cảm xúc và bình chọn phim.

---

## ✨ Tính năng nổi bật

- **🎟️ Vào xem không cần tài khoản**: Khán giả chỉ cần nhập **Tên hiển thị** là có thể tạo phòng mới (mặc định **4 ghế**) hoặc nhập mã/link mời để vào xem ngay.
- **👑 Tài khoản Admin mở rộng phòng (6 – 20 người)**: Đăng nhập quyền Admin để tạo mới hoặc nâng cấp sức chứa phòng lên **6, 8, 10, 15 hoặc 20 người**, kèm quyền quản lý nhanh (tắt mic / mời thành viên ra khỏi phòng).
- **📺 Hỗ trợ đa nguồn phát & Đồng bộ thời gian thực**:
  - **YouTube** (`youtube.com/watch?v=...`, `youtu.be/...`, `shorts/...`): Đồng bộ tự động Play / Pause / Tua giây.
  - **Video trực tiếp & HLS Stream** (`.mp4`, `.webm`, `.ogg`, `.m3u8`): Tích hợp `hls.js` đồng bộ mượt mà.
  - **Web Embed (`iframe`)**: Hỗ trợ dán link web phim kèm nút **Đếm ngược `3-2-1`** đồng bộ nhịp bấm Play.
- **🔐 Quyền điều khiển linh hoạt**: Chủ phòng có thể bật/tắt riêng quyền **Cho phép mọi người điều khiển phát** và quyền **Cho phép người xem thêm link phim**.
- **📋 Hàng đợi phát phim (Playlist)**: Xếp sẵn danh sách nhiều tập phim / MV, tự động chuyển bài tiếp theo khi kết thúc.
- **🎙️ Voice Chat WebRTC P2P**: Đàm thoại trực tiếp độ trễ thấp, lọc ồn/khử vọng, tự nhận diện người đang nói (Voice Activity Detection).
- **🐱🐰 Mascot Chibi & Tương tác phòng**:
  - Các bé **Chibi** tự do đi dạo trong khung chat, gắn vương miện Chủ phòng, tai nghe, sao lấp lánh, hiện bong bóng chat khi nhắn tin và có nút **🥂 Cụng ly Chibi**.
  - **Bình chọn nhanh (Poll)** ngay trong khung chat, **Thả cảm xúc bay** trên màn hình video, **Đèn rạp tối (Theatre Mode)** với chat nổi trong suốt, **Âm thanh thông báo nhẹ**, **Tự vào lại phòng khi lỡ F5**, và **Nền động / Nền tĩnh** tùy chọn.

---

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18, Vite 6, Tailwind CSS v4, Lucide Icons, `hls.js`, `socket.io-client`
- **Backend**: Node.js, Express, Socket.IO, HMAC-SHA256 Token Auth
- **Voice Chat**: WebRTC Peer-to-Peer Audio Mesh + Web Audio API

---

## 🚀 Hướng dẫn chạy trên máy (Local)

### Yêu cầu
- Node.js `>= 18.0.0`

### Cài đặt & Khởi chạy
```bash
# 1. Cài đặt dependencies & build giao diện
npm run build

# 2. Chạy server (mặc định tại http://localhost:3001)
npm start
```

### Chạy kiểm thử tự động
```bash
npm test
```

---

## ☁️ Hướng dẫn Deploy lên Render / Railway

Project đã có sẵn file `render.yaml` để triển khai chỉ với 1 dịch vụ Web Service thống nhất:

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Biến môi trường (Environment Variables)** khuyến nghị:
  - `NODE_ENV=production`
  - `ADMIN_USERNAME` *(tên tài khoản Admin tùy chọn)*
  - `ADMIN_PASSWORD` *(mật khẩu Admin tùy chọn)*
  - `ADMIN_SECRET` *(chuỗi bí mật ký token)*

> **Lưu ý**: Trình duyệt yêu cầu kết nối `https://` để bật Micro qua Internet. Khi deploy lên Render hoặc Railway, hệ thống mặc định có sẵn HTTPS.
