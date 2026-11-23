import React, { useEffect, useState } from 'react';
import ChibiMascot from './ChibiMascot';

/**
 * Renders Chibi mascots that roam autonomously inside the chat background,
 * display mini speech bubbles on new chat messages, and gather to high-five!
 */
export default function RoamingChibis({
  users = [],
  hostId,
  currentUserId,
  isSpeaking = false,
  chibiBubbles = {},
  highFiveActive = false,
}) {
  const [positions, setPositions] = useState({});

  // Show roaming chibis when there are >= 2 users (cap at 6 so large rooms stay clean)
  const visibleUsers = users.length >= 2 ? users.slice(0, 6) : [];
  const userKey = visibleUsers.map((u) => u.id).join(',');

  useEffect(() => {
    if (visibleUsers.length === 0) return;

    setPositions((prev) => {
      const next = { ...prev };
      visibleUsers.forEach((u, idx) => {
        if (!next[u.id]) {
          next[u.id] = {
            x: 15 + ((idx * 35) % 70),
            y: 25 + ((idx * 25) % 55),
            flip: idx % 2 === 1,
          };
        }
      });
      return next;
    });

    const interval = setInterval(() => {
      setPositions((prev) => {
        const next = { ...prev };
        visibleUsers.forEach((u) => {
          const current = next[u.id] || { x: 40, y: 50, flip: false };
          const newX = 8 + Math.random() * 74;
          const newY = 14 + Math.random() * 64;
          next[u.id] = {
            x: newX,
            y: newY,
            flip: newX < current.x,
          };
        });
        return next;
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [userKey]);

  if (visibleUsers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none"
    >
      {highFiveActive && (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-2xl animate-bounce drop-shadow">
          <span>🥂</span>
          <span>✨</span>
          <span>💖</span>
        </div>
      )}

      {visibleUsers.map((u, idx) => {
        const defaultPos = positions[u.id] || {
          x: 20 + idx * 30,
          y: 45,
          flip: false,
        };
        // During high-five, gather near center facing each other
        const pos = highFiveActive
          ? {
              x: 34 + (idx % 2 === 0 ? 0 : 18) + Math.floor(idx / 2) * 8,
              y: 44 + Math.floor(idx / 2) * 10,
              flip: idx % 2 === 1,
            }
          : defaultPos;

        const isMe = u.id === currentUserId;
        const userSpeaking = isMe ? isSpeaking : Boolean(u.isSpeaking);
        const bubbleText = chibiBubbles[u.id];

        return (
          <div
            key={`roam-${u.id}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transition: highFiveActive
                ? 'left 0.65s ease-out, top 0.65s ease-out'
                : 'left 3.1s ease-in-out, top 3.1s ease-in-out',
            }}
            className="absolute flex flex-col items-center opacity-80"
          >
            {bubbleText && (
              <div className="mb-1 max-w-[115px] truncate rounded-xl bg-white/90 text-slate-900 px-2 py-0.5 text-[10px] font-bold shadow-md animate-bounce">
                {bubbleText}
              </div>
            )}

            <div
              style={{
                transform: pos.flip ? 'scaleX(-1)' : 'scaleX(1)',
                transition: 'transform 0.35s ease',
              }}
            >
              <ChibiMascot
                index={idx}
                size={40}
                isSpeaking={userSpeaking || highFiveActive || Boolean(bubbleText)}
                isHost={u.id === hostId}
                isAdmin={Boolean(u.isAdmin)}
                withEffects={true}
                className={
                  userSpeaking || highFiveActive ? '' : 'animate-float-3d'
                }
              />
            </div>

            {/* 3D Ground Shadow */}
            <div className="w-6 h-1.5 -mt-1 rounded-full bg-slate-950/40 blur-[1px]" />

            <span className="mt-0.5 px-1.5 py-0.2 rounded-full bg-slate-950/40 backdrop-blur-xs text-[9px] font-bold text-white/90 max-w-[68px] truncate">
              {u.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
