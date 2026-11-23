import React from 'react';

const MASCOT_THEMES = [
  {
    id: 'cat-mint',
    name: 'Mèo Ngọc Bích',
    earColor: '#2dd4bf',
    earInner: '#fbcfe8',
    headColor: '#ccfbf1',
    cheekColor: '#fb7185',
    outfitColor: '#0d9488',
    accent: '#99f6e4',
    glow: 'rgba(45, 212, 191, 0.55)',
  },
  {
    id: 'bunny-cream',
    name: 'Thỏ Kem Dâu',
    earColor: '#fde68a',
    earInner: '#fda4af',
    headColor: '#fffbeb',
    cheekColor: '#fb7185',
    outfitColor: '#f59e0b',
    accent: '#fef3c7',
    glow: 'rgba(251, 191, 36, 0.55)',
  },
  {
    id: 'bear-sky',
    name: 'Gấu Mây Xanh',
    earColor: '#7dd3fc',
    earInner: '#e0f2fe',
    headColor: '#f0f9ff',
    cheekColor: '#f472b6',
    outfitColor: '#0284c7',
    accent: '#bae6fd',
    glow: 'rgba(56, 189, 248, 0.55)',
  },
  {
    id: 'fox-peach',
    name: 'Cáo Đào Tiên',
    earColor: '#fda4af',
    earInner: '#ffe4e6',
    headColor: '#fff1f2',
    cheekColor: '#fb7185',
    outfitColor: '#e11d48',
    accent: '#fecdd3',
    glow: 'rgba(251, 113, 133, 0.55)',
  },
];

export function getMascotIndex(seed = '', fallbackIndex = 0) {
  if (!seed) return fallbackIndex % MASCOT_THEMES.length;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % MASCOT_THEMES.length;
}

export default function ChibiMascot({
  index = 0,
  size = 44,
  isSpeaking = false,
  isHost = false,
  isAdmin = false,
  withEffects = true,
  className = '',
}) {
  const theme = MASCOT_THEMES[Math.abs(index) % MASCOT_THEMES.length];
  const isBunny = theme.id === 'bunny-cream';

  return (
    <div
      style={{
        width: size,
        height: size,
        filter: isSpeaking
          ? `drop-shadow(0 0 10px ${theme.glow})`
          : withEffects
          ? `drop-shadow(0 4px 10px rgba(0, 0, 0, 0.28))`
          : undefined,
      }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        isSpeaking ? 'animate-bounce' : ''
      } ${className}`}
    >
      {/* Ambient Sparkle Effects attached around Chibi */}
      {withEffects && (
        <>
          <span
            className="pointer-events-none absolute -top-1 -right-1 text-[10px] animate-chibi-sparkle"
            style={{ animationDelay: `${(index % 3) * 0.4}s` }}
          >
            {isSpeaking ? '🎵' : '✨'}
          </span>
          {isAdmin && !isHost && (
            <span
              className="pointer-events-none absolute -top-1 -left-1 text-[10px] animate-chibi-sparkle"
              style={{ animationDelay: '0.8s' }}
            >
              ⭐
            </span>
          )}
        </>
      )}

      <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible">
        {/* Host Crown Attachment */}
        {isHost && (
          <g transform="translate(21, -5)">
            <path
              d="M2 12 L0 3 L6 7 L11 0 L16 7 L22 3 L20 12 Z"
              fill="#fbbf24"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="11" cy="7.5" r="1.5" fill="#f43f5e" />
          </g>
        )}

        {/* Ears */}
        {isBunny ? (
          <>
            <ellipse
              cx="22"
              cy="14"
              rx="5.5"
              ry="12"
              transform="rotate(-10 22 14)"
              fill={theme.earColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <ellipse
              cx="22"
              cy="15"
              rx="2.8"
              ry="7.5"
              transform="rotate(-10 22 15)"
              fill={theme.earInner}
            />
            <ellipse
              cx="42"
              cy="14"
              rx="5.5"
              ry="12"
              transform="rotate(10 42 14)"
              fill={theme.earColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <ellipse
              cx="42"
              cy="15"
              rx="2.8"
              ry="7.5"
              transform="rotate(10 42 15)"
              fill={theme.earInner}
            />
          </>
        ) : (
          <>
            <path
              d="M14 25 L17 9 L29 19 Z"
              fill={theme.earColor}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M17 22 L18.5 13 L25 19 Z" fill={theme.earInner} />
            <path
              d="M50 25 L47 9 L35 19 Z"
              fill={theme.earColor}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M47 22 L45.5 13 L39 19 Z" fill={theme.earInner} />
          </>
        )}

        {/* Headphones Band Attachment for Cinema Mood */}
        {withEffects && (
          <>
            <path
              d="M13 30 C13 15, 51 15, 51 30"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.85"
            />
            <rect x="10.5" y="26" width="5" height="9" rx="2.5" fill={theme.outfitColor} stroke="#ffffff" strokeWidth="1.2" />
            <rect x="48.5" y="26" width="5" height="9" rx="2.5" fill={theme.outfitColor} stroke="#ffffff" strokeWidth="1.2" />
          </>
        )}

        {/* Chibi Body / Outfit */}
        <path
          d="M20 48 C20 41, 44 41, 44 48 L46 58 C46 60, 18 60, 18 58 Z"
          fill={theme.outfitColor}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        {/* Little Scarf / Collar */}
        <ellipse cx="32" cy="45" rx="10" ry="3.2" fill={theme.accent} />

        {/* Chibi Head */}
        <ellipse
          cx="32"
          cy="31"
          rx="18"
          ry="15.5"
          fill={theme.headColor}
          stroke="#ffffff"
          strokeWidth="1.8"
        />

        {/* Rosy Cheeks */}
        <ellipse cx="20.5" cy="34.5" rx="3.5" ry="2" fill={theme.cheekColor} opacity="0.55" />
        <ellipse cx="43.5" cy="34.5" rx="3.5" ry="2" fill={theme.cheekColor} opacity="0.55" />

        {/* Sparkling Blinking Eyes */}
        <g className="animate-chibi-blink">
          <circle cx="24.5" cy="30" r="3" fill="#1e293b" />
          <circle cx="25.5" cy="28.8" r="1.1" fill="#ffffff" />
          <circle cx="23.7" cy="30.8" r="0.5" fill="#ffffff" />

          <circle cx="39.5" cy="30" r="3" fill="#1e293b" />
          <circle cx="40.5" cy="28.8" r="1.1" fill="#ffffff" />
          <circle cx="38.7" cy="30.8" r="0.5" fill="#ffffff" />
        </g>

        {/* Cute Mouth */}
        {isSpeaking ? (
          <ellipse cx="32" cy="35.5" rx="2.6" ry="2.2" fill="#f43f5e" />
        ) : (
          <path
            d="M29.2 34.5 Q32 37.2 34.8 34.5"
            fill="none"
            stroke="#334155"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
