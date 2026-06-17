/**
 * WebVTT thumbnail storyboards (sprite + #xywh=… or per-cue image URLs).
 * Used for frame-accurate scrub previews when your CDN / encoder provides a .vtt track.
 */

export type StoryboardRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ParsedStoryboardCue = {
  start: number;
  end: number;
  /** Absolute URL, no #fragment — safe for Image / getSize. */
  imageUri: string;
  /** Sprite crop; null = use full image for this cue. */
  region: StoryboardRegion | null;
  /**
   * Union bounding box of all #xywh regions for this `imageUri` in the same VTT
   * (full sprite pixel size). Lets the UI crop without Image.getSize / onLoad dimensions
   * (unreliable on Android when using custom request headers).
   */
  spriteBounds?: {w: number; h: number};
};

const XYWH_RE = /[#&]xywh=([\d.]+),([\d.]+),([\d.]+),([\d.]+)/;

/** WebVTT timestamp → seconds (supports HH:MM:SS.mmm, MM:SS.mmm, SS.mmm). */
export function parseWebVttTimestamp(raw: string): number {
  const s = raw.trim().split(/\s+/)[0] ?? '';
  const dotIdx = s.indexOf('.');
  const intPart = dotIdx >= 0 ? s.slice(0, dotIdx) : s;
  const fracStr = dotIdx >= 0 ? s.slice(dotIdx + 1).replace(/[^\d]/g, '') : '0';
  const frac =
    fracStr.length > 0
      ? parseInt(fracStr.padEnd(3, '0').slice(0, 3), 10) / 1000
      : 0;
  const parts = intPart.split(':').map(p => parseInt(p, 10));
  if (parts.some(n => Number.isNaN(n))) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + frac;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1] + frac;
  }
  if (parts.length === 1) {
    return parts[0] + frac;
  }
  return 0;
}

function stripUrlHashForImageLoad(href: string): string {
  const hashIdx = href.indexOf('#');
  return hashIdx >= 0 ? href.slice(0, hashIdx) : href;
}

/** Pathname without trailing `/` and `.vtt` filename (handles `…/file.vtt/` bases). */
function vttPathAndFile(vttBaseHref: string): {path: string; file: string} | null {
  try {
    let path = new URL(vttBaseHref).pathname;
    while (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const file = path.split('/').pop() ?? '';
    if (!file.endsWith('.vtt')) {
      return null;
    }
    return {path, file};
  } catch {
    return null;
  }
}

/**
 * Fix sprite URLs after `new URL(ref, vttUrl)` on React Native / odd bases:
 * 1. `…/file.vtt/media/sprite.jpg` → `/{rest}` (VTT filename wrongly treated as a directory).
 * 2. `…/media/media/sprite.jpg` when the VTT is under `…/media/*.vtt` and the cue used a
 *    path-relative `media/sprite.jpg` (double folder segment).
 */
export function rewriteSpriteUrlIfMergedUnderVttFile(
  imageHref: string,
  vttBaseHref: string,
): string {
  const vtt = vttPathAndFile(vttBaseHref);
  if (!vtt) {
    return imageHref;
  }
  const {path: vttPath, file: vttFile} = vtt;
  let result = imageHref;
  try {
    const img = new URL(result);
    const needle = `/${vttFile}/`;
    const {pathname} = img;
    const pos = pathname.indexOf(needle);
    if (pos >= 0) {
      const rest = pathname.slice(pos + needle.length).replace(/^\//, '');
      if (rest) {
        const rootPath = `/${rest}`;
        result = new URL(rootPath + img.search + img.hash, img.origin).href;
      }
    }
  } catch {
    /* keep result */
  }
  try {
    const vttDir = vttPath.replace(/[^/]+$/, '');
    if (vttDir.length > 1) {
      const dirSegs = vttDir.replace(/\/$/, '').split('/').filter(Boolean);
      const folder = dirSegs[dirSegs.length - 1];
      if (folder) {
        const dup = `/${folder}/${folder}/`;
        const img = new URL(result);
        if (img.pathname.includes(dup)) {
          const p2 = img.pathname.replace(dup, `/${folder}/`);
          result = new URL(p2 + img.search + img.hash, img.origin).href;
        }
      }
    }
  } catch {
    /* keep result */
  }
  return result;
}

function resolveStoryboardImageRef(ref: string, resolveBase: string): string {
  const trimmed = ref.replace(/\r/g, '').trim();
  let absolute: string;
  try {
    absolute = new URL(trimmed, resolveBase).href;
  } catch {
    return stripUrlHashForImageLoad(trimmed);
  }
  absolute = rewriteSpriteUrlIfMergedUnderVttFile(absolute, resolveBase);
  return stripUrlHashForImageLoad(absolute);
}

function parsePayloadLine(line: string): {
  ref: string;
  region: StoryboardRegion | null;
} {
  const trimmed = line.trim();
  const m = trimmed.match(XYWH_RE);
  if (!m) {
    return {ref: trimmed, region: null};
  }
  const region: StoryboardRegion = {
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
    h: Number(m[4]),
  };
  const ref = trimmed.slice(0, m.index).trim();
  return {ref, region};
}

function looksLikeThumbnailPayload(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith('NOTE')) {
    return false;
  }
  return (
    /https?:\/\//i.test(t) ||
    /\.(jpe?g|png|webp)(\?|#|$)/i.test(t) ||
    XYWH_RE.test(t)
  );
}

/**
 * Parse a thumbnail storyboard WebVTT body into cues with absolute image URLs.
 * Relative image paths are resolved against `vttSourceUrl` (the fetched .vtt URL).
 */
export function parseThumbnailStoryboardVtt(
  body: string,
  vttSourceUrl: string,
): ParsedStoryboardCue[] {
  const normalized = body
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const resolveBase = vttSourceUrl.trim();
  const blocks = normalized.split(/\n\n+/);
  const cues: ParsedStoryboardCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      continue;
    }
    if (lines[0].startsWith('WEBVTT')) {
      continue;
    }
    if (lines[0].startsWith('NOTE')) {
      continue;
    }
    const header = lines[0];
    if (!header.includes(' --> ')) {
      continue;
    }
    const [rawStart, rawEndPart] = header.split(' --> ');
    const rawEnd = (rawEndPart ?? '').split(/\s+/)[0] ?? '';
    const start = parseWebVttTimestamp(rawStart ?? '');
    const end = parseWebVttTimestamp(rawEnd);
    const payload = lines.slice(1).find(looksLikeThumbnailPayload);
    if (!payload) {
      continue;
    }
    const {ref, region} = parsePayloadLine(payload.replace(/\r/g, '').trim());
    if (!ref) {
      continue;
    }
    const imageUri = resolveStoryboardImageRef(ref, resolveBase);
    cues.push({start, end, imageUri, region});
  }

  const maxCornerByImage = new Map<string, {w: number; h: number}>();
  for (const c of cues) {
    if (!c.region) {
      continue;
    }
    const right = c.region.x + c.region.w;
    const bottom = c.region.y + c.region.h;
    const prev = maxCornerByImage.get(c.imageUri) ?? {w: 0, h: 0};
    maxCornerByImage.set(c.imageUri, {
      w: Math.max(prev.w, right),
      h: Math.max(prev.h, bottom),
    });
  }
  for (const c of cues) {
    if (!c.region) {
      continue;
    }
    const b = maxCornerByImage.get(c.imageUri);
    if (b && b.w > 0 && b.h > 0) {
      c.spriteBounds = {w: b.w, h: b.h};
    }
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/**
 * Pick the thumbnail cue for playback time `t` (seconds).
 * Uses the last cue whose `start <= t` (typical scrub behavior through gaps / tail).
 */
export function findStoryboardCueAt(
  cues: ParsedStoryboardCue[],
  t: number,
): ParsedStoryboardCue | null {
  if (!cues.length) {
    return null;
  }
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    } 
  }
  if (ans < 0) {
    return cues[0];
  }
  return cues[ans];
}
