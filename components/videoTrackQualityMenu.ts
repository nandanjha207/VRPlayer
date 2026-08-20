/**
 * Shapes native `videoTracks` (ExoPlayer) into a short quality menu.
 * Masters like Apple BipBop also expose I-frame / trick-play renditions that
 * duplicate resolutions and confuse selection — we keep one playable row per size.
 */

import type {OnLoadData} from '@ttn/vr-rn-player-sdk';

type VideoTrackRow = OnLoadData['videoTracks'][number];

function hasMainVideoCodec(codecs: string): boolean {
  const c = codecs.toLowerCase();
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

function looksLikeIframeOrTrickPlay(t: VideoTrackRow): boolean {
  const id = (t.tracksID ?? '').toLowerCase();
  return (
    id.includes('iframe') ||
    id.includes('i-frame') ||
    id.includes('trick') ||
    id.includes('thumbnail')
  );
}

/** Drop obvious non–main-ladder rows when metadata is present. */
function filterNonPlayableVideoTracks(tracks: OnLoadData['videoTracks']): VideoTrackRow[] {
  const kept = tracks.filter(t => {
    if (looksLikeIframeOrTrickPlay(t)) {
      return false;
    }
    const codecs = t.codecs ?? '';
    if (codecs.length > 0 && !hasMainVideoCodec(codecs)) {
      return false;
    }
    return true;
  });
  return kept.length > 0 ? kept : [...tracks];
}

export function sortVideoTracksByQuality(
  tracks: OnLoadData['videoTracks'],
): OnLoadData['videoTracks'] {
  return [...tracks].sort(
    (a, b) =>
      (b.height ?? 0) - (a.height ?? 0) ||
      (b.bitrate ?? 0) - (a.bitrate ?? 0) ||
      (a.index ?? 0) - (b.index ?? 0),
  );
}

/**
 * One row per resolution (height preferred; else width; else index).
 * When several formats share the same size (e.g. full ladder vs I-frame), keep
 * the highest bitrate — usually the normal playable rendition.
 */
export function dedupeVideoTracksByResolution(
  tracks: OnLoadData['videoTracks'],
): OnLoadData['videoTracks'] {
  const byKey = new Map<string, VideoTrackRow>();
  for (const t of tracks) {
    const h = t.height ?? 0;
    const w = t.width ?? 0;
    const key =
      h > 0 ? `h:${h}` : w > 0 ? `w:${w}` : `i:${t.index ?? 0}`;
    const prev = byKey.get(key);
    const br = t.bitrate ?? 0;
    const prevBr = prev?.bitrate ?? 0;
    if (!prev || br > prevBr) {
      byKey.set(key, t);
    }
  }
  return sortVideoTracksByQuality([...byKey.values()]);
}

/** Pipeline used by the quality modal: working ladder rows only, sorted. */
export function prepareVideoTracksForQualityUi(
  tracks: OnLoadData['videoTracks'],
): OnLoadData['videoTracks'] {
  if (!tracks.length) {
    return [];
  }
  const cleaned = filterNonPlayableVideoTracks(tracks);
  return dedupeVideoTracksByResolution(cleaned);
}
