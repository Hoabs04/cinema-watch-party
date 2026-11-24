import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Film,
  RefreshCw,
  Lock,
  Unlock,
  ExternalLink,
  Info,
  Play,
  Pause,
  Radio,
  MonitorUp,
  MonitorOff
} from 'lucide-react';

// Global helper to load YouTube IFrame API once
let ytApiPromise = null;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve(window.YT);
    };

    // Fallback poll in case onYouTubeIframeAPIReady already fired
    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        resolve(window.YT);
      }
    }, 150);
  });

  return ytApiPromise;
}

export function VideoPlayer({
  socket,
  videoState,
  canControl,
  onVideoAction,
  onVideoEnded,
  reactions = [],
  countdownValue = null,
  overlayMessages = [],
  theatreMode = false,
  screenStream = null,
  isLocalScreen = false,
  sharerName = '',
  onStartScreenShare,
  onStopScreenShare
}) {
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const html5VideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const hlsInstanceRef = useRef(null);

  const isRemoteSyncRef = useRef(false);
  const remoteSyncTimerRef = useRef(null);
  const lastKnownTimeRef = useRef(0);

  const canControlRef = useRef(canControl);
  const onVideoActionRef = useRef(onVideoAction);
  const onVideoEndedRef = useRef(onVideoEnded);
  const latestVideoStateRef = useRef(videoState);

  useEffect(() => {
    canControlRef.current = canControl;
  }, [canControl]);

  useEffect(() => {
    onVideoEndedRef.current = onVideoEnded;
  }, [onVideoEnded]);

  useEffect(() => {
    const el = screenVideoRef.current;
    if (el && screenStream) {
      el.srcObject = screenStream;
      el.play().catch(() => {});
    } else if (el) {
      el.srcObject = null;
    }
  }, [screenStream]);

  useEffect(() => {
    onVideoActionRef.current = onVideoAction;
  }, [onVideoAction]);

  useEffect(() => {
    if (videoState) {
      latestVideoStateRef.current = videoState;
    }
  }, [videoState]);

  const [syncNotice, setSyncNotice] = useState('');
  const [ytReady, setYtReady] = useState(false);

  const markRemoteSync = useCallback((durationMs = 750) => {
    isRemoteSyncRef.current = true;
    if (remoteSyncTimerRef.current) {
      clearTimeout(remoteSyncTimerRef.current);
    }
    remoteSyncTimerRef.current = setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, durationMs);
  }, []);

  const showTempNotice = useCallback((text) => {
    setSyncNotice(text);
    setTimeout(() => {
      setSyncNotice((prev) => (prev === text ? '' : prev));
    }, 3000);
  }, []);

  // Calculate expected current playback time taking elapsed time into account
  const getTargetTime = useCallback((stateObj) => {
    if (!stateObj) return 0;
    const base = Number(stateObj.currentTime) || 0;
    if (stateObj.isPlaying && stateObj.updatedAt) {
      const elapsedSec = Math.max(0, (Date.now() - stateObj.updatedAt) / 1000);
      // Cap elapsed drift if updatedAt was just refreshed or reasonable
      return base + (elapsedSec < 36000 ? elapsedSec : 0);
    }
    return base;
  }, []);

  // Apply remote state to active player (YouTube or HTML5/HLS)
  const applyRemoteState = useCallback(
    ({ isPlaying, currentTime, actorName, forceSeek = false }) => {
      const type = latestVideoStateRef.current?.type;
      const numericTime = typeof currentTime === 'number' && !Number.isNaN(currentTime) ? currentTime : 0;

      if (type === 'youtube') {
        const player = ytPlayerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;

        markRemoteSync(850);
        try {
          const localTime = player.getCurrentTime() || 0;
          if (forceSeek || Math.abs(localTime - numericTime) > 1.5) {
            player.seekTo(numericTime, true);
            lastKnownTimeRef.current = numericTime;
          }
          const playerState =
            typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
          // 1 = PLAYING, 2 = PAUSED
          if (isPlaying && playerState !== 1) {
            player.playVideo();
          } else if (!isPlaying && playerState === 1) {
            player.pauseVideo();
          }
        } catch {
          // Ignore YT player transient errors before ready
        }
      } else if (type === 'video' || type === 'hls') {
        const videoEl = html5VideoRef.current;
        if (!videoEl) return;

        markRemoteSync(800);
        try {
          const localTime = videoEl.currentTime || 0;
          if (forceSeek || Math.abs(localTime - numericTime) > 1.5) {
            videoEl.currentTime = numericTime;
            lastKnownTimeRef.current = numericTime;
          }
          if (isPlaying && videoEl.paused) {
            videoEl.play().catch(() => {});
          } else if (!isPlaying && !videoEl.paused) {
            videoEl.pause();
          }
        } catch {
          // Ignore transient HTML5 media errors
        }
      }

      if (actorName) {
        showTempNotice(`Đồng bộ từ ${actorName}`);
      }
    },
    [markRemoteSync, showTempNotice]
  );

  // Manual Re-sync handler
  const handleManualResync = useCallback(() => {
    const state = latestVideoStateRef.current;
    if (!state || !state.url) return;

    const targetTime = getTargetTime(state);
    applyRemoteState({
      isPlaying: state.isPlaying,
      currentTime: targetTime,
      actorName: '',
      forceSeek: true
    });
    showTempNotice('Đã đồng bộ lại tiến độ phim!');

    // If current user can control, also broadcast current position to align room
    if (canControlRef.current && onVideoActionRef.current) {
      let currentLocalTime = targetTime;
      if (state.type === 'youtube' && ytPlayerRef.current?.getCurrentTime) {
        currentLocalTime = ytPlayerRef.current.getCurrentTime() || targetTime;
      } else if ((state.type === 'video' || state.type === 'hls') && html5VideoRef.current) {
        currentLocalTime = html5VideoRef.current.currentTime || targetTime;
      }
      onVideoActionRef.current('seek', currentLocalTime);
    }
  }, [applyRemoteState, getTargetTime, showTempNotice]);

  // Listen to socket video-sync and video-changed events
  useEffect(() => {
    if (!socket) return;

    const handleVideoSync = ({ action, isPlaying, currentTime, updatedAt, actorName }) => {
      latestVideoStateRef.current = {
        ...latestVideoStateRef.current,
        isPlaying,
        currentTime,
        updatedAt: updatedAt || Date.now()
      };
      applyRemoteState({
        isPlaying,
        currentTime,
        actorName,
        forceSeek: action === 'seek'
      });
    };

    const handleVideoChanged = ({ videoState: nextVideoState, changedBy }) => {
      if (nextVideoState) {
        latestVideoStateRef.current = nextVideoState;
        lastKnownTimeRef.current = nextVideoState.currentTime || 0;
        if (changedBy) {
          showTempNotice(`${changedBy} đã đổi phim mới`);
        }
      }
    };

    socket.on('video-sync', handleVideoSync);
    socket.on('video-changed', handleVideoChanged);

    return () => {
      socket.off('video-sync', handleVideoSync);
      socket.off('video-changed', handleVideoChanged);
    };
  }, [socket, applyRemoteState, showTempNotice]);

  // YouTube Player lifecycle & local seek detector
  useEffect(() => {
    if (videoState?.type !== 'youtube' || !videoState?.videoId) {
      setYtReady(false);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    let seekCheckInterval = null;

    loadYouTubeApi().then((YT) => {
      if (isCancelled || !YT || !ytContainerRef.current) return;

      // Destroy previous instance if any
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }

      // Create fresh child node for YT.Player to replace
      ytContainerRef.current.innerHTML = '';
      const mountEl = document.createElement('div');
      ytContainerRef.current.appendChild(mountEl);

      const initialTime = Math.floor(getTargetTime(latestVideoStateRef.current));
      lastKnownTimeRef.current = initialTime;

      const player = new YT.Player(mountEl, {
        width: '100%',
        height: '100%',
        videoId: videoState.videoId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          start: initialTime > 0 ? initialTime : 0
        },
        events: {
          onReady: (event) => {
            if (isCancelled) return;
            setYtReady(true);
            const st = latestVideoStateRef.current;
            const target = getTargetTime(st);
            markRemoteSync(900);
            if (target > 1) {
              event.target.seekTo(target, true);
              lastKnownTimeRef.current = target;
            }
            if (st?.isPlaying) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event) => {
            if (isCancelled) return;
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;

            const currentTime = event.target.getCurrentTime() || 0;

            if (isRemoteSyncRef.current) {
              lastKnownTimeRef.current = currentTime;
              return;
            }

            if (!canControlRef.current) {
              // Viewer without control permission: revert unauthorized local change
              const st = latestVideoStateRef.current;
              if (st) {
                const expectedTime = getTargetTime(st);
                if (event.data === YTState.PAUSED && st.isPlaying) {
                  markRemoteSync(600);
                  event.target.playVideo();
                } else if (event.data === YTState.PLAYING && !st.isPlaying) {
                  markRemoteSync(600);
                  event.target.pauseVideo();
                }
                if (Math.abs(currentTime - expectedTime) > 2.5) {
                  markRemoteSync(600);
                  event.target.seekTo(expectedTime, true);
                }
              }
              return;
            }

            // Detect local seek jump (> 2s difference from tracked time)
            if (Math.abs(currentTime - lastKnownTimeRef.current) > 2.0) {
              lastKnownTimeRef.current = currentTime;
              if (onVideoActionRef.current) {
                onVideoActionRef.current('seek', currentTime);
              }
            }

            if (event.data === YTState.PLAYING) {
              lastKnownTimeRef.current = currentTime;
              latestVideoStateRef.current = {
                ...latestVideoStateRef.current,
                isPlaying: true,
                currentTime,
                updatedAt: Date.now()
              };
              if (onVideoActionRef.current) {
                onVideoActionRef.current('play', currentTime);
              }
            } else if (event.data === YTState.PAUSED) {
              lastKnownTimeRef.current = currentTime;
              latestVideoStateRef.current = {
                ...latestVideoStateRef.current,
                isPlaying: false,
                currentTime,
                updatedAt: Date.now()
              };
              if (onVideoActionRef.current) {
                onVideoActionRef.current('pause', currentTime);
              }
            } else if (event.data === YTState.ENDED) {
              if (canControlRef.current && onVideoEndedRef.current) {
                onVideoEndedRef.current();
              }
            }
          }
        }
      });

      ytPlayerRef.current = player;

      // Poll every 1000ms to track normal playback progression and detect user scrubbing on YouTube timeline
      seekCheckInterval = setInterval(() => {
        if (!ytPlayerRef.current || typeof ytPlayerRef.current.getCurrentTime !== 'function') {
          return;
        }
        try {
          const pState = ytPlayerRef.current.getPlayerState?.();
          const nowTime = ytPlayerRef.current.getCurrentTime() || 0;
          const diff = Math.abs(nowTime - lastKnownTimeRef.current);

          if (!isRemoteSyncRef.current && canControlRef.current && diff > 2.5) {
            lastKnownTimeRef.current = nowTime;
            if (onVideoActionRef.current) {
              onVideoActionRef.current('seek', nowTime);
            }
          } else if (pState === 1) {
            // Normal playing progression
            lastKnownTimeRef.current = nowTime;
          }
        } catch {
          // ignore
        }
      }, 1000);
    });

    return () => {
      isCancelled = true;
      if (seekCheckInterval) clearInterval(seekCheckInterval);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [videoState?.type, videoState?.videoId, getTargetTime, markRemoteSync]);

  // HTML5 & HLS (.m3u8) lifecycle
  useEffect(() => {
    const isHtml5OrHls = videoState?.type === 'video' || videoState?.type === 'hls';
    const videoEl = html5VideoRef.current;

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    if (!isHtml5OrHls || !videoEl || !videoState?.url) {
      return;
    }

    const syncInitialPosition = () => {
      const st = latestVideoStateRef.current;
      const targetTime = getTargetTime(st);
      markRemoteSync(800);
      if (targetTime > 0.5) {
        try {
          videoEl.currentTime = targetTime;
          lastKnownTimeRef.current = targetTime;
        } catch {
          // ignore
        }
      }
      if (st?.isPlaying) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    };

    if (videoState.type === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(videoState.url);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          syncInitialPosition();
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari / iOS)
        videoEl.src = videoState.url;
        videoEl.addEventListener('loadedmetadata', syncInitialPosition, { once: true });
      } else {
        videoEl.src = videoState.url;
      }
    } else {
      videoEl.src = videoState.url;
      videoEl.addEventListener('loadedmetadata', syncInitialPosition, { once: true });
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [videoState?.type, videoState?.url, getTargetTime, markRemoteSync]);

  // HTML5 Video event handlers
  const handleHtml5Play = () => {
    const videoEl = html5VideoRef.current;
    if (!videoEl || isRemoteSyncRef.current) return;
    if (!canControlRef.current) {
      const st = latestVideoStateRef.current;
      if (st && !st.isPlaying) {
        markRemoteSync(500);
        videoEl.pause();
      }
      return;
    }
    const currentTime = videoEl.currentTime || 0;
    lastKnownTimeRef.current = currentTime;
    latestVideoStateRef.current = {
      ...latestVideoStateRef.current,
      isPlaying: true,
      currentTime,
      updatedAt: Date.now()
    };
    if (onVideoAction) {
      onVideoAction('play', currentTime);
    }
  };

  const handleHtml5Pause = () => {
    const videoEl = html5VideoRef.current;
    if (!videoEl || isRemoteSyncRef.current) return;
    // Ignore automatic pause at end of stream or seeking
    if (videoEl.seeking) return;
    if (!canControlRef.current) {
      const st = latestVideoStateRef.current;
      if (st && st.isPlaying) {
        markRemoteSync(500);
        videoEl.play().catch(() => {});
      }
      return;
    }
    const currentTime = videoEl.currentTime || 0;
    lastKnownTimeRef.current = currentTime;
    latestVideoStateRef.current = {
      ...latestVideoStateRef.current,
      isPlaying: false,
      currentTime,
      updatedAt: Date.now()
    };
    if (onVideoAction) {
      onVideoAction('pause', currentTime);
    }
  };

  const handleHtml5Seeked = () => {
    const videoEl = html5VideoRef.current;
    if (!videoEl || isRemoteSyncRef.current) return;
    if (!canControlRef.current) return;

    const currentTime = videoEl.currentTime || 0;
    if (Math.abs(currentTime - lastKnownTimeRef.current) > 1.2) {
      lastKnownTimeRef.current = currentTime;
      latestVideoStateRef.current = {
        ...latestVideoStateRef.current,
        currentTime,
        updatedAt: Date.now()
      };
      if (onVideoAction) {
        onVideoAction('seek', currentTime);
      }
    }
  };

  const hasVideo = Boolean(videoState?.url);

  return (
    <div className="relative w-full shrink-0 overflow-hidden rounded-3xl cinema-card-3d shadow-[0_24px_54px_-12px_rgba(10,6,24,0.55)]">
      {/* Top Cinema Control & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-white/10 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-bold text-teal-100 border border-white/25">
            <Radio className="h-3.5 w-3.5 animate-pulse text-teal-300" />
            {screenStream
              ? `🖥️ Chiếu Màn Hình (${isLocalScreen ? 'Bạn' : sharerName || 'Thành viên'})`
              : videoState?.type === 'youtube'
              ? 'YouTube Sync'
              : videoState?.type === 'hls'
              ? 'HLS Stream (.m3u8)'
              : videoState?.type === 'video'
              ? 'HTML5 Direct Video'
              : videoState?.type === 'drm_blocked'
              ? `${videoState.provider || 'DRM'} (Chặn nhúng)`
              : videoState?.type === 'iframe'
              ? `${videoState.provider || 'Web Embed'} (Iframe)`
              : 'Màn Hình Rạp Chiếu'}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold border ${
              canControl
                ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/35'
                : 'bg-white/10 text-teal-100/85 border-white/20'
            }`}
          >
            {canControl ? (
              <>
                <Unlock className="h-3.5 w-3.5 text-emerald-300" />
                Đang đồng bộ (Bạn có quyền điều khiển)
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-teal-200" />
                Chỉ chủ phòng điều khiển
              </>
            )}
          </span>

          {syncNotice && (
            <span className="rounded-full bg-teal-400/25 px-2.5 py-1 font-semibold text-white border border-teal-300/40 animate-fade-in">
              {syncNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLocalScreen && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/45 border border-rose-300/45 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              <MonitorOff className="h-3.5 w-3.5" />
              Dừng chiếu màn hình
            </button>
          )}

          {!screenStream && hasVideo && videoState?.type !== 'iframe' && videoState?.type !== 'drm_blocked' && (
            <button
              type="button"
              onClick={handleManualResync}
              title="Đồng bộ lại thời gian thực với phòng chiếu"
              className="inline-flex items-center gap-1.5 rounded-xl btn-3d-soft px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-teal-200" />
              Đồng bộ lại
            </button>
          )}

          {hasVideo && (
            <a
              href={videoState.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl btn-3d-soft px-2.5 py-1.5 text-xs font-bold text-white"
              title="Mở link gốc trong tab mới"
            >
              <ExternalLink className="h-3.5 w-3.5 text-teal-200" />
              <span className="hidden sm:inline">Link gốc</span>
            </a>
          )}
        </div>
      </div>

      {/* Main 16:9 Cinema Stage */}
      <div className="relative aspect-video w-full bg-black/55 select-none">
        {/* 0. Live WebRTC Screen / Tab Share Stream */}
        {screenStream ? (
          <div className="relative h-full w-full bg-black">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              controls
              muted={isLocalScreen}
              className="h-full w-full object-contain bg-black"
            />
          </div>
        ) : (
        <>
        {/* 1. Empty State */}
        {!hasVideo && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-white/5 backdrop-blur-md p-6 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-400/90 to-emerald-500/90 border border-white/35 text-white shadow-[0_6px_0_rgba(17,94,89,0.6),0_16px_30px_rgba(20,184,166,0.35)] animate-float-3d">
              <Film className="h-10 w-10" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white drop-shadow">
              Rạp Phim Sẵn Sàng Chiếu!
            </h3>
            <p className="mt-2 max-w-md text-xs sm:text-sm text-teal-100/85 font-medium leading-relaxed">
              Dán link <span className="text-teal-200 font-bold">YouTube, Facebook, Google Drive, TikTok, .mp4 / .m3u8</span> hoặc bấm <span className="text-emerald-200 font-bold">🖥️ Chiếu Tab / Màn hình</span> để xem Netflix &amp; mọi web phim trên Google!
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs font-bold text-white/90">
              <span className="rounded-xl bg-white/12 border border-white/25 px-3.5 py-2 backdrop-blur-md">
                🎬 Tự động đồng bộ Play / Pause / Tua phim
              </span>
              <span className="rounded-xl bg-white/12 border border-white/25 px-3.5 py-2 backdrop-blur-md">
                🖥️ Chiếu Tab Netflix / Web Phim
              </span>
            </div>
          </div>
        )}

        {/* 1b. DRM Blocked Platform Helper (Netflix, FPT Play, VieON...) */}
        {hasVideo && videoState.type === 'drm_blocked' && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950/75 backdrop-blur-md p-6 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-300/35 text-rose-200">
              <MonitorUp className="h-8 w-8" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              {videoState.provider || 'Trang này'} chặn nhúng trực tiếp do bảo mật DRM
            </h3>
            <p className="mt-2 max-w-md text-xs sm:text-sm text-teal-100/85 leading-relaxed">
              Các nền tảng như Netflix, FPT Play, VieON không cho phép nhúng link vào trang khác. Cách xem chung mượt nhất là mở phim ở 1 tab trình duyệt rồi bấm nút bên dưới để chiếu cho cả phòng!
            </p>
            {onStartScreenShare && (
              <button
                type="button"
                onClick={onStartScreenShare}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl btn-3d-pink px-5 py-2.5 text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                <MonitorUp className="h-4 w-4" />
                Chiếu Tab / Màn Hình Ngay (Có tiếng)
              </button>
            )}
          </div>
        )}

        {/* 2. YouTube Adapter */}
        {hasVideo && videoState.type === 'youtube' && (
          <div className="relative h-full w-full">
            <div ref={ytContainerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
            {!ytReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-slate-300">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400 mb-2" />
                <span className="text-xs">Đang tải trình phát YouTube...</span>
              </div>
            )}
          </div>
        )}

        {/* 3. HTML5 Video & HLS Adapter */}
        {hasVideo && (videoState.type === 'video' || videoState.type === 'hls') && (
          <div className="relative h-full w-full">
            <video
              ref={html5VideoRef}
              className="h-full w-full bg-black object-contain"
              controls={canControl}
              playsInline
              onPlay={handleHtml5Play}
              onPause={handleHtml5Pause}
              onSeeked={handleHtml5Seeked}
              onEnded={() => {
                if (canControlRef.current && onVideoEndedRef.current) {
                  onVideoEndedRef.current();
                }
              }}
            />
            {!canControl && (
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm border border-slate-800">
                {videoState.isPlaying ? (
                  <>
                    <Play className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Đang phát theo chủ phòng</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 text-amber-400" />
                    <span>Chủ phòng đang tạm dừng</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Web Iframe Embed Adapter */}
        {hasVideo && videoState.type === 'iframe' && (
          <div className="flex h-full w-full flex-col">
            <iframe
              src={videoState.url}
              title="Web Movie Embed"
              className="h-full w-full flex-1 border-0 bg-black"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        </>
        )}

        {/* 5. Floating Emoji Reactions Overlay */}
        {reactions.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-4 z-30 flex w-28 flex-col justify-end overflow-hidden pb-14">
            {reactions.map((item, idx) => {
              const horizontalOffset = ((idx * 17) % 40) - 20;
              return (
                <div
                  key={item.id || `${idx}-${item.emoji}`}
                  style={{
                    transform: `translateX(${horizontalOffset}px)`,
                    animation: 'floatUp 2.8s ease-out forwards'
                  }}
                  className="mb-2 flex flex-col items-center"
                >
                  <span className="text-3xl sm:text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]">
                    {item.emoji}
                  </span>
                  {item.senderName && (
                    <span className="mt-0.5 max-w-[96px] truncate rounded-full bg-slate-950/85 px-2 py-0.5 text-[10px] font-medium text-slate-200 border border-slate-800/80 shadow">
                      {item.senderName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 6. Synchronized 3-2-1 Countdown Overlay */}
        {countdownValue !== null && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/15 border border-white/30 px-10 py-6 backdrop-blur-xl shadow-2xl animate-bounce">
              <span className="text-5xl sm:text-7xl font-black text-white drop-shadow-[0_6px_18px_rgba(20,184,166,0.6)]">
                {countdownValue > 0 ? countdownValue : '🎬 BẮT ĐẦU!'}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-200">
                Đồng bộ nhịp bấm Play
              </span>
            </div>
          </div>
        )}

        {/* 7. Theatre Mode Translucent Chat Overlay */}
        {theatreMode && overlayMessages.length > 0 && (
          <div className="pointer-events-none absolute bottom-12 left-4 z-30 flex max-w-xs sm:max-w-sm flex-col gap-1.5">
            {overlayMessages.slice(-4).map((m) => (
              <div
                key={`ov-${m.id}`}
                className="rounded-xl bg-slate-950/55 border border-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-lg"
              >
                <span className="font-bold text-teal-200 mr-1.5">
                  {m.senderName}:
                </span>
                <span className="text-white/95">{m.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner for Web Iframe Embed */}
      {hasVideo && videoState.type === 'iframe' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 bg-white/10 px-4 py-2.5 text-xs text-teal-100">
          <div className="flex items-start sm:items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-teal-300 mt-0.5 sm:mt-0" />
            <span>
              <strong>Chế độ Nhúng Web (Iframe):</strong> Do bảo mật trình duyệt (Cross-Origin), trình phát của web thứ 3 không tự động đồng bộ nút Play/Pause. Cả phòng hãy hô 1-2-3 qua Mic/Chat để bấm Play cùng lúc nhé! (Nếu web chặn nhúng, hãy dùng link trực tiếp <code>.m3u8</code> / <code>.mp4</code> hoặc bấm mở tab mới).
            </span>
          </div>
          <a
            href={videoState.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl btn-3d-soft px-3 py-1 font-bold text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Mở tab mới
          </a>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
