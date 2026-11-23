/**
 * Parses a video URL and detects its playback type.
 * Supports: YouTube, HLS (.m3u8), Direct HTML5 video (.mp4, .webm, .ogg), and generic Iframe embed URLs.
 *
 * @param {string} rawUrl
 * @returns {{ type: 'youtube'|'hls'|'video'|'iframe', videoId: string, url: string } | null}
 */
export function parseVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

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
      };
    }
  }

  // Also check query param v if hostname is youtube.com
  if (
    parsedUrl.hostname.includes('youtube.com') &&
    parsedUrl.searchParams.get('v')
  ) {
    const vId = parsedUrl.searchParams.get('v');
    if (vId && vId.length >= 11) {
      return {
        type: 'youtube',
        videoId: vId.slice(0, 11),
        url: trimmed,
      };
    }
  }

  // 2. Check HLS (.m3u8)
  if (/\.m3u8(\?.*)?$/i.test(trimmed) || trimmed.toLowerCase().includes('.m3u8')) {
    return {
      type: 'hls',
      videoId: '',
      url: trimmed,
    };
  }

  // 3. Check direct HTML5 video (.mp4, .webm, .ogg)
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test( parsedUrl.pathname )) {
    return {
      type: 'video',
      videoId: '',
      url: trimmed,
    };
  }

  // 4. Fallback to iframe embed for any valid http/https URL
  return {
    type: 'iframe',
    videoId: '',
    url: trimmed,
  };
}

export default parseVideoUrl;
