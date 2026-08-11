import {DRMType} from 'react-native-video';
import type {ReactVideoSource} from 'react-native-video';

/** Matches SDK Cast media builder: network HLS/DASH, Widevine only (no FairPlay). */
export function isCastFriendlySource(source?: ReactVideoSource): boolean {
  if (!source) {
    return false;
  }

  const uri = typeof source.uri === 'string' ? source.uri : '';
  if (!uri.startsWith('http')) {
    return false;
  }

  const drmType = source.drm?.type;
  if (drmType === DRMType.FAIRPLAY || drmType === DRMType.PLAYREADY) {
    return false;
  }

  const type = (source.type ?? '').toLowerCase();
  if (type === 'm3u8' || type === 'hls' || type === 'mpd' || type === 'dash') {
    return true;
  }
  if (uri.includes('.m3u8') || uri.includes('.mpd')) {
    return true;
  }

  return false;
}
