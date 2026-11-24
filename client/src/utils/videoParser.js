/**
 * Parses a video URL (or pasted <iframe> snippet) and detects its playback type.
 * Supports: YouTube, Facebook, Google Drive, TikTok, Vimeo, Dailymotion,
 * HLS (.m3u8), Direct HTML5 video (.mp4, .webm, .ogg), DRM detection (Netflix, etc.),
 * and generic Iframe embed URLs.
 *
 * @param {string} rawInput
 * @returns {{ type: 'youtube'|'hls'|'video'|'iframe'|'drm_blocked', videoId: string, url: string, provider?: string } | null}
 */
export function parseVideoUrl(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 0. If user pasted a full <iframe ... src="..."> embed code, extract src
  const iframeSrcMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    trimmed = iframeSrcMatch[1].trim();
  }

  // Validate http/https protocol
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();

  // 1. Check YouTube patterns
  const ytPatterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
  ];
  for (const regex of ytPatterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return {
        type: 'youtube',
        videoId: match[1],
        url: trimmed,
        provider: 'YouTube',
      };
    }
  }

  if (host.includes('youtube.com') && parsedUrl.searchParams.get('v')) {
    const vId = parsedUrl.searchParams.get('v');
    if (vId && vId.length >= 11) {
      return {
        type: 'youtube',
        videoId: vId.slice(0, 11),
        url: trimmed,
        provider: 'YouTube',
      };
    }
  }

  // 2. Check HLS (.m3u8)
  if (/\.m3u8(\?.*)?$/i.test(trimmed) || trimmed.toLowerCase().includes('.m3u8')) {
    return {
      type: 'hls',
      videoId: '',
      url: trimmed,
      provider: 'HLS Stream',
    };
  }

  // 3. Check direct HTML5 video (.mp4, .webm, .ogg)
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsedUrl.pathname)) {
    return {
      type: 'video',
      videoId: '',
      url: trimmed,
      provider: 'Direct Video',
    };
  }

  // 4. Check Facebook Video / Reel / Watch -> Facebook Video Plugin Embed
  if (
    host === 'fb.watch' ||
    host.endsWith('.fb.watch') ||
    host === 'facebook.com' ||
    host.endsWith('.facebook.com')
  ) {
    if (trimmed.includes('/plugins/video.php')) {
      return {
        type: 'iframe',
        videoId: '',
        url: trimmed,
        provider: 'Facebook',
      };
    }
    return {
      type: 'iframe',
      videoId: '',
      url: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        trimmed
      )}&show_text=false&t=0`,
      provider: 'Facebook',
    };
  }

  // 5. Check Google Drive -> /preview embed
  if (host.includes('drive.google.com')) {
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idParam = parsedUrl.searchParams.get('id');
    const fileId = (driveMatch && driveMatch[1]) || idParam;
    if (fileId) {
      return {
        type: 'iframe',
        videoId: fileId,
        url: `https://drive.google.com/file/d/${fileId}/preview`,
        provider: 'Google Drive',
      };
    }
  }

  // 6. Check TikTok -> /embed/v2/<id>
  if (host.includes('tiktok.com')) {
    const ttMatch = trimmed.match(/\/video\/(\d+)/);
    if (ttMatch && ttMatch[1]) {
      return {
        type: 'iframe',
        videoId: ttMatch[1],
        url: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
        provider: 'TikTok',
      };
    }
  }

  // 7. Check Vimeo -> player.vimeo.com/video/<id>
  if (host.includes('vimeo.com') && !host.includes('player.vimeo.com')) {
    const vimeoMatch = parsedUrl.pathname.match(/\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        type: 'iframe',
        videoId: vimeoMatch[1],
        url: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
        provider: 'Vimeo',
      };
    }
  }

  // 8. Check Dailymotion
  if (host.includes('dailymotion.com') || host === 'dai.ly') {
    const dmMatch =
      trimmed.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/i) ||
      trimmed.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
    if (dmMatch && dmMatch[1]) {
      return {
        type: 'iframe',
        videoId: dmMatch[1],
        url: `https://www.dailymotion.com/embed/video/${dmMatch[1]}`,
        provider: 'Dailymotion',
      };
    }
  }

  // 9. Detect DRM-protected streaming platforms (block iframe embedding)
  const drmDomains = [
    'netflix.com',
    'disneyplus.com',
    'primevideo.com',
    'hbomax.com',
    'max.com',
    'fptplay.vn',
    'vieon.vn',
    'tv360.vn',
    'galaxyplay.vn',
  ];
  if (drmDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
    return {
      type: 'drm_blocked',
      videoId: '',
      url: trimmed,
      provider: host.replace(/^www\./, ''),
    };
  }

  // 10. Fallback to generic iframe embed for any other valid http/https URL
  return {
    type: 'iframe',
    videoId: '',
    url: trimmed,
    provider: 'Web Embed',
  };
}

export default parseVideoUrl;
