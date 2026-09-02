/**
 * SPOTV live DVR test streams — URLs must remain exactly as provided.
 */

import {Platform} from 'react-native';
import type {Drm} from '@ttn/vr-rn-player-sdk';
import {
  buildKeyOSDrmConfigWithCallback,
  KEYOS_CUSTOMDATA,
} from '../drm/keyosDrm';

export type DvrTestSourceId =
  | 'drm-hls'
  | 'drm-dash'
  | 'clear-hls'
  | 'clear-dash';

export type DvrTestSource = Readonly<{
  id: DvrTestSourceId;
  label: string;
  uri: string;
  type: 'm3u8' | 'mpd';
  drm?: Drm;
  /** When true, show a blocking hint instead of attempting playback. */
  drmConfigMissing?: boolean;
  unsupportedHint?: string;
  playable: boolean;
}>;

const DRM_HLS_URI =
  'https://cdn-spotv-a-01.vos360.video/Content/HLS_HLS/Live/channel(adhoc01mn)/index.m3u8';

const DRM_DASH_URI =
  'https://cdn-spotv-a-01.vos360.video/Content/DASH_DASH/Live/channel(adhoc01mn)/master.mpd';

const CLEAR_HLS_URI =
  'https://cdn-spotv-a-01.vos360.video/Content/HLS_HLS/Live/channel(adhoc40mm)/index.m3u8';

const CLEAR_DASH_URI =
  'https://cdn-spotv-a-01.vos360.video/Content/DASH_DASH/Live/channel(adhoc40mm)/master.mpd';

/**
 * DRM HLS uses the same KeyOS FairPlay configuration as the Harmonic VOS360
 * TTNTEST row in curatedPlaylist (channel(drm) on the same CDN).
 *
 * DRM DASH (Widevine) has no license server / customdata in this repository —
 * see `drmConfigMissing` on that source.
 */
export const DVR_TEST_SOURCES: readonly DvrTestSource[] = [
  {
    id: 'drm-hls',
    label: 'DRM – HLS',
    uri: DRM_HLS_URI,
    type: 'm3u8',
    drm: buildKeyOSDrmConfigWithCallback(KEYOS_CUSTOMDATA),
    playable: Platform.OS === 'ios',
    unsupportedHint:
      Platform.OS === 'android'
        ? 'FairPlay HLS — iOS physical device only.'
        : 'KeyOS FairPlay via Harmonic VOS360. Real iPhone required.',
  },
  {
    id: 'drm-dash',
    label: 'DRM – DASH',
    uri: DRM_DASH_URI,
    type: 'mpd',
    drmConfigMissing: true,
    playable: false,
    unsupportedHint:
      'Missing Widevine license configuration for adhoc01mn DASH in this repo. ' +
      'Add licenseServer (and any KeyOS customdata headers) before testing.',
  },
  {
    id: 'clear-hls',
    label: 'Non-DRM – HLS',
    uri: CLEAR_HLS_URI,
    type: 'm3u8',
    playable: true,
  },
  {
    id: 'clear-dash',
    label: 'Non-DRM – DASH',
    uri: CLEAR_DASH_URI,
    type: 'mpd',
    playable: Platform.OS === 'android',
    unsupportedHint:
      Platform.OS === 'ios'
        ? 'DASH on iOS is limited — use Non-DRM HLS for iOS DVR testing.'
        : undefined,
  },
];

export function getDvrTestSource(id: DvrTestSourceId): DvrTestSource {
  const source = DVR_TEST_SOURCES.find(s => s.id === id);
  if (!source) {
    throw new Error(`Unknown DVR test source: ${id}`);
  }
  return source;
}
