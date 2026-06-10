/**
 * Runtime HLS / DASH manifest parsing for adaptive video renditions.
 * Used to build a quality menu without per-URL hardcoding.
 */

export type ManifestVideoRendition = {
  /** Stable id for React keys and selection state */
  id: string;
  /** Human-readable row label */
  label: string;
  /** Absolute URL for this fixed rendition (variant playlist or progressive URL) */
  uri: string;
  bandwidth?: number;
  width?: number;
  height?: number;
};

export type ManifestKind = 'hls' | 'dash';

export function inferManifestKind(uri: string): ManifestKind | null {
  const lower = uri.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('.ism/')) {
    return 'hls';
  }
  if (lower.includes('.mpd')) {
    return 'dash';
  }
  return null;
}

/** Resolve a possibly-relative URL against a manifest base URL. */
export function resolveAgainstManifest(manifestUrl: string, ref: string): string {
  const trimmed = ref.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  try {
    return new URL(trimmed, manifestUrl).href;
  } catch {
    return trimmed;
  }
}

function hasVideoCodec(codecsAttr: string): boolean {
  const c = codecsAttr.toLowerCase();
  return (
    c.includes('avc1') ||
    c.includes('avc3') ||
    c.includes('hvc1') ||
    c.includes('hev1') ||
    c.includes('dvh1') ||
    c.includes('dvhe') ||
    c.includes('vp09') ||
    c.includes('vp08') ||
    c.includes('av01')
  );
}

/** Parse HLS attribute list: KEY=VAL,KEY="Q,V" — returns plain string values. */
export function parseHlsAttributeList(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    const eq = body.indexOf('=', i);
    if (eq < 0) {
      break;
    }
    const key = body.slice(i, eq).trim();
    let j = eq + 1;
    let value = '';
    if (body[j] === '"') {
      j += 1;
      while (j < body.length) {
        if (body[j] === '"' && body[j - 1] !== '\\') {
          j += 1;
          break;
        }
        value += body[j];
        j += 1;
      }
    } else {
      while (j < body.length && body[j] !== ',') {
        value += body[j];
        j += 1;
      }
    }
    out[key.toUpperCase()] = value.trim();
    while (j < body.length && body[j] === ',') {
      j += 1;
    }
    i = j;
  }
  return out;
}

function formatRenditionLabel(
  bandwidth: number | undefined,
  width: number | undefined,
  height: number | undefined,
  index: number,
): string {
  if (height && width) {
    return `${height}p (${width}×${height})`;
  }
  if (height) {
    return `${height}p`;
  }
  if (width) {
    return `${width}w`;
  }
  if (bandwidth && bandwidth >= 1_000_000) {
    return `${(bandwidth / 1_000_000).toFixed(1)} Mbps`;
  }
  if (bandwidth) {
    return `${Math.round(bandwidth / 1000)} kbps`;
  }
  return `Quality ${index + 1}`;
}

/**
 * Parse an HLS multivariant (master) playlist; returns video variants only.
 */
export function parseHlsMasterForVideoRenditions(
  text: string,
  manifestUrl: string,
): ManifestVideoRendition[] {
  const lines = text.split(/\r?\n/);
  const raw: ManifestVideoRendition[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF:')) {
      continue;
    }
    const attrStr = line.slice('#EXT-X-STREAM-INF:'.length);
    const attrs = parseHlsAttributeList(attrStr);
    const codecs = attrs.CODECS ?? '';
    if (!hasVideoCodec(codecs)) {
      continue;
    }

    let uriLine = '';
    for (let k = i + 1; k < lines.length; k++) {
      const next = lines[k].trim();
      if (!next || next.startsWith('#')) {
        continue;
      }
      uriLine = next;
      i = k;
      break;
    }
    if (!uriLine) {
      continue;
    }

    const bandwidth = attrs.BANDWIDTH
      ? parseInt(attrs.BANDWIDTH, 10)
      : undefined;
    let width: number | undefined;
    let height: number | undefined;
    if (attrs.RESOLUTION) {
      const parts = attrs.RESOLUTION.toLowerCase().split('x');
      if (parts.length === 2) {
        width = parseInt(parts[0], 10);
        height = parseInt(parts[1], 10);
      }
    }

    const uri = resolveAgainstManifest(manifestUrl, uriLine);
    const id = `hls-${bandwidth ?? raw.length}-${raw.length}`;
    raw.push({
      id,
      label: formatRenditionLabel(bandwidth, width, height, raw.length),
      uri,
      bandwidth,
      width,
      height,
    });
  }

  const seen = new Set<string>();
  const deduped: ManifestVideoRendition[] = [];
  for (const r of raw) {
    if (seen.has(r.uri)) {
      continue;
    }
    seen.add(r.uri);
    deduped.push(r);
  }

  deduped.sort(
    (a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0) || (b.height ?? 0) - (a.height ?? 0),
  );

  return deduped.map((r, idx) => ({
    ...r,
    id: `hls-${idx}-${r.bandwidth ?? idx}`,
  }));
}

function readXmlAttr(tagOpen: string, name: string): string | undefined {
  const dquoted = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const squoted = new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i');
  const md = tagOpen.match(dquoted);
  if (md) {
    return md[1].trim();
  }
  const ms = tagOpen.match(squoted);
  if (ms) {
    return ms[1].trim();
  }
  const bare = new RegExp(`\\b${name}\\s*=\\s*([0-9]+)\\b`, 'i');
  const mb = tagOpen.match(bare);
  return mb?.[1];
}

/**
 * Parse DASH MPD for video Representations that declare a concrete `<BaseURL>`.
 * Skips template-only ladders where no per-representation URL is available.
 */
export function parseDashMpdForVideoRenditions(
  xml: string,
  manifestUrl: string,
): ManifestVideoRendition[] {
  const out: ManifestVideoRendition[] = [];
  const adaptRe =
    /<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/gi;
  let am: RegExpExecArray | null;
  while ((am = adaptRe.exec(xml)) !== null) {
    const openAttrs = am[1];
    const body = am[2];
    const isVideo =
      /contentType\s*=\s*"video"/i.test(openAttrs) ||
      /mimeType\s*=\s*"video\//i.test(openAttrs);
    if (!isVideo) {
      continue;
    }

    const setBaseMatch = body.match(/<BaseURL\b[^>]*>([^<]+)<\/BaseURL>/i);
    const adaptationBase = setBaseMatch?.[1]?.trim();

    const repRe = /<Representation\b([^>]*)>([\s\S]*?)<\/Representation>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = repRe.exec(body)) !== null) {
      const repAttrs = rm[1];
      const inner = rm[2];
      const baseMatch = inner.match(/<BaseURL\b[^>]*>([^<]+)<\/BaseURL>/i);
      let rel = baseMatch?.[1]?.trim();
      if (!rel && adaptationBase) {
        rel = adaptationBase.trim();
      }
      if (!rel) {
        continue;
      }

      const id = readXmlAttr(repAttrs, 'id') ?? `r${out.length}`;
      const bwStr = readXmlAttr(repAttrs, 'bandwidth');
      const bandwidth = bwStr ? parseInt(bwStr, 10) : undefined;
      const wStr = readXmlAttr(repAttrs, 'width');
      const hStr = readXmlAttr(repAttrs, 'height');
      const width = wStr ? parseInt(wStr, 10) : undefined;
      const height = hStr ? parseInt(hStr, 10) : undefined;

      const uri = resolveAgainstManifest(manifestUrl, rel);
      out.push({
        id: `dash-${id}-${out.length}`,
        label: formatRenditionLabel(bandwidth, width, height, out.length),
        uri,
        bandwidth,
        width,
        height,
      });
    }
  }

  const seen = new Set<string>();
  const deduped: ManifestVideoRendition[] = [];
  for (const r of out) {
    if (seen.has(r.uri)) {
      continue;
    }
    seen.add(r.uri);
    deduped.push(r);
  }

  deduped.sort(
    (a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0) || (b.height ?? 0) - (a.height ?? 0),
  );

  return deduped.map((r, idx) => ({
    ...r,
    id: `dash-${idx}-${r.bandwidth ?? idx}`,
  }));
}

/**
 * Fetch manifest text and return sorted video renditions (may be empty).
 */
export async function loadManifestVideoRenditions(
  manifestUrl: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
): Promise<ManifestVideoRendition[]> {
  const kind = inferManifestKind(manifestUrl);
  if (!kind) {
    return [];
  }

  const res = await fetch(manifestUrl, {
    headers: headers ?? {},
    signal,
  });
  if (!res.ok) {
    return [];
  }
  const text = await res.text();
  if (!text) {
    return [];
  }

  if (kind === 'hls') {
    if (!text.includes('#EXT-X-STREAM-INF')) {
      return [];
    }
    return parseHlsMasterForVideoRenditions(text, manifestUrl);
  }

  return parseDashMpdForVideoRenditions(text, manifestUrl);
}
