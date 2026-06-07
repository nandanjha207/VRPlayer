/**
 * Short curated playlist for QA — known HLS / DASH / DRM samples.
 * Replace or extend as you confirm which URLs work on your devices.
 */

import {Platform} from 'react-native';
import type {CatalogStreamItem, QualityVariant} from './exoListParser';

/** KeyOS demo token (FairPlay) — rotate via your KeyOS portal when expired. */
export const KEYOS_MERIDIAN_CUSTOM_DATA =
  'PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxLZXlPU0F1dGhlbnRpY2F0aW9uWE1MPjxEYXRhPjxXaWRldmluZVBvbGljeSBmbF9DYW5QZXJzaXN0PSJmYWxzZSIgZmxfQ2FuUGxheT0idHJ1ZSIvPjxXaWRldmluZUNvbnRlbnRLZXlTcGVjIFRyYWNrVHlwZT0iSEQiPjxTZWN1cml0eUxldmVsPjE8L1NlY3VyaXR5TGV2ZWw+PC9XaWRldmluZUNvbnRlbnRLZXlTcGVjPjxGYWlyUGxheVBvbGljeSBwZXJzaXN0ZW50PSJmYWxzZSIvPjxMaWNlbnNlIHR5cGU9InNpbXBsZSIvPjxHZW5lcmF0aW9uVGltZT4yMDI2LTAxLTI2IDE4OjAyOjEzLjAwMDwvR2VuZXJhdGlvblRpbWU+PEV4cGlyYXRpb25UaW1lPjIwNDEtMDEtMjYgMTg6MDI6MTMuMDAwPC9FeHBpcmF0aW9uVGltZT48VW5pcXVlSWQ+NzFmZTdhYmNjMzE4ZDE2M2EwYTJmOWE4NDVjOGI2ZTk8L1VuaXF1ZUlkPjxSU0FQdWJLZXlJZD43ZTExNDAwYzdkY2NkMjlkMDE3NGM2NzQzOTdkOTlkZDwvUlNBUHViS2V5SWQ+PC9EYXRhPjxTaWduYXR1cmU+WWZXR2VJSmpNYjRLOEVWWGRUck9OM1h5SVJlM1Uwams5YU1jVkVoVFluc1FKMTI3NUdmNlF3VzZ6SkVQUjNtYlNwU2crWEVVcVNEVm5wQVcwY1lQUWpiM21Hcjl4clJLR0xrcVJUU0VYR25JblpzSWJuc3VlOHZweXcycTRRVUo5OHpwV0J3NFhzeDY2b2NrV2R2dUFoTkFydHpSZHAvUDhuekdWdXc1eE5scy9tSEswMmxmb09rVGY4ZHc3M2RLTkx4SXZ6TjdyWnRHWlVGbSs1VTNtVjB2SzNybUE3TmF3dkltSEwzUFJVbXFEUjBWKytHVDFZMU5wRHZCOTNPb1hIK0FKWGhOOGhxWTEzMzRKQnVIdGtuQXJjRlh5MW5LVlFQbzZGd1VsVmJzNFBzOS9rL3ltZ0h0UXV4bGZ1SWFOcUtadEtlRXNSbnl4eWFLRytvOVBnPT08L1NpZ25hdHVyZT48L0tleU9TQXV0aGVudGljYXRpb25YTUw+Cg==';

const KEYOS_FP_LICENSE = 'https://fp-keyos.licensekeyserver.com/getkey/';
const KEYOS_FP_CERT = 'https://fp-keyos.licensekeyserver.com/cert/';
const KEYOS_MERIDIAN_HLS =
  'https://d2jl6e4h8300i8.cloudfront.net/netflix_meridian/4k-18.5!9/keyos-logo/g180-avc_a2.0-vbr-aac-128k/r30/hls-fp/master.m3u8';

const WV_TEARS_MANIFEST =
  'https://storage.googleapis.com/wvmedia/cenc/h264/tears/tears.mpd';
const WV_LICENSE_DEFAULT =
  'https://proxy.uat.widevine.com/proxy?video_id=2015_tears&provider=widevine_test';
const WV_LICENSE_RENEW =
  'https://proxy.uat.widevine.com/proxy?video_id=GTS_CAN_RENEW&provider=widevine_test';

const CLEAR_DASH =
  'https://storage.googleapis.com/wvmedia/clear/h264/tears/tears.mpd';
const HLS_UNIFIED =
  'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';
const HLS_BIPBOP =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8';
const BIPBOP_16X9_BASE =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/';

/** Fixed gear playlists — avoids Android selectedVideoTrack layout bugs. */
const BIPBOP_QUALITY_VARIANTS: QualityVariant[] = [
  {
    id: '234',
    label: '234p',
    uri: `${BIPBOP_16X9_BASE}gear1/prog_index.m3u8`,
  },
  {
    id: '360',
    label: '360p',
    uri: `${BIPBOP_16X9_BASE}gear2/prog_index.m3u8`,
  },
  {
    id: '540',
    label: '540p',
    uri: `${BIPBOP_16X9_BASE}gear3/prog_index.m3u8`,
  },
  {
    id: '720',
    label: '720p',
    uri: `${BIPBOP_16X9_BASE}gear4/prog_index.m3u8`,
  },
  {
    id: '1080',
    label: '1080p',
    uri: `${BIPBOP_16X9_BASE}gear5/prog_index.m3u8`,
  },
];

const MP4_BIG_BUCK_BUNNY =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4';
const HLS_LIVE_FORSTREET = 'https://live.forstreet.cl/live/livestream.m3u8';
/** Forstreet CDN returns 400 for ExoPlayer / AVPlayer UAs — browser UA required. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Shaka Player public FairPlay demo (no customdata — native FPS license flow). */
const SHAKA_ANGEL_ONE_HLS =
  'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8';
const SHAKA_FP_CERT = 'https://cwip-shaka-proxy.appspot.com/fps_certificate';
const SHAKA_FP_LICENSE = 'https://cwip-shaka-proxy.appspot.com/no_auth';

/** Playlist row posters (direct image URLs — avoid Wikimedia /thumb/ size limits). */
const THUMB_BIG_BUCK_BUNNY =
  'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg';
const THUMB_TEARS =
  'https://mango.blender.org/wp-content/uploads/2013/05/tears_of_steel_poster_02.jpg';
const THUMB_BIPBOP =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/images/48x48/icon_48x48.png';

function item(
  partial: Omit<CatalogStreamItem, 'id'> & {id?: string},
  index: number,
): CatalogStreamItem {
  return {
    id: partial.id ?? `curated-${index}`,
    ...partial,
  };
}

/** Curated rows shown in the app playlist (not the full ExoList). */
export function buildCuratedPlaylist(): CatalogStreamItem[] {
  const rows: Omit<CatalogStreamItem, 'id'>[] = [
    {
      category: 'Quick test',
      title: 'MP4 – Big Buck Bunny 1080p (10s clip)',
      uri: MP4_BIG_BUCK_BUNNY,
      thumbnailUri: THUMB_BIG_BUCK_BUNNY,
      tags: ['clear'],
      playable: true,
    },
    {
      category: 'HLS (live)',
      title: 'HLS – Forstreet live',
      uri: HLS_LIVE_FORSTREET,
      headers: {'User-Agent': BROWSER_USER_AGENT},
      tags: ['clear', 'live'],
      playable: true,
      unsupportedHint:
        'CDN blocks native player User-Agent; app sends a browser UA via headers.',
    },
    {
      category: 'HLS (clear)',
      title: 'HLS – Apple BipBop 16:9 (ABR)',
      uri: HLS_BIPBOP,
      thumbnailUri: THUMB_BIPBOP,
      qualityVariants: BIPBOP_QUALITY_VARIANTS,
      tags: ['clear'],
      playable: true,
    },
    {
      category: 'HLS (clear)',
      title: 'HLS – Tears of Steel (Unified Streaming)',
      uri: HLS_UNIFIED,
      thumbnailUri: THUMB_TEARS,
      tags: ['clear'],
      playable: true,
    },
    {
      category: 'DASH (clear)',
      title: 'DASH – Tears clear (wvmedia)',
      uri: CLEAR_DASH,
      thumbnailUri: THUMB_TEARS,
      tags: ['clear'],
      playable: true,
      unsupportedHint:
        Platform.OS === 'ios'
          ? 'DASH on iOS is limited; use HLS rows if this fails.'
          : undefined,
    },
    {
      category: 'DRM – Widevine (Android)',
      title: 'DASH – Tears Widevine HD (cenc)',
      uri: WV_TEARS_MANIFEST,
      thumbnailUri: THUMB_TEARS,
      drmScheme: 'widevine',
      drmLicenseUri: WV_LICENSE_DEFAULT,
      tags: ['drm'],
      playable: Platform.OS === 'android',
      unsupportedHint:
        Platform.OS === 'ios'
          ? 'Widevine DASH — use FairPlay row on iPhone.'
          : 'Use a physical Android device (emulator DRM is unreliable).',
    },
    {
      category: 'DRM – Widevine (Android)',
      title: 'DASH – Widevine 20s license renewal',
      uri: WV_TEARS_MANIFEST,
      thumbnailUri: THUMB_TEARS,
      drmScheme: 'widevine',
      drmLicenseUri: WV_LICENSE_RENEW,
      tags: ['drm'],
      playable: Platform.OS === 'android',
      unsupportedHint:
        Platform.OS === 'ios'
          ? 'Widevine only on Android.'
          : 'Play 60s+ to verify license renewal.',
    },
    {
      category: 'DRM – FairPlay (iOS test)',
      title: 'HLS – Shaka Angel One (FPS demo)',
      uri: SHAKA_ANGEL_ONE_HLS,
      thumbnailUri: THUMB_TEARS,
      drmScheme: 'fairplay',
      drmLicenseUri: SHAKA_FP_LICENSE,
      fairPlayCertificateUrl: SHAKA_FP_CERT,
      tags: ['drm'],
      playable: Platform.OS === 'ios',
      unsupportedHint:
        Platform.OS === 'android'
          ? 'FairPlay — iOS physical device only (not simulator).'
          : 'Shaka demo cert + license. Use real iPhone; try this before KeyOS.',
    },
    
  ];

  // {
  //   category: 'DRM – FairPlay (KeyOS)',
  //   title: 'HLS – Netflix Meridian (KeyOS FPS)',
  //   uri: KEYOS_MERIDIAN_HLS,
  //   thumbnailUri: THUMB_TEARS,
  //   drmScheme: 'fairplay',
  //   drmLicenseUri: KEYOS_FP_LICENSE,
  //   fairPlayCertificateUrl: KEYOS_FP_CERT,
  //   fairPlayCustomData: KEYOS_MERIDIAN_CUSTOM_DATA,
  //   fairPlayContentId: '71b3f031667e417e9d924535c67ce02b',
  //   tags: ['drm'],
  //   playable: Platform.OS === 'ios',
  //   unsupportedHint:
  //     Platform.OS === 'android'
  //       ? 'FairPlay — iOS physical device only (not simulator).'
  //       : 'Real iPhone required. Confirm cert/license URLs with your KeyOS team if this fails.',
  // }

  return rows.map((row, index) => item(row, index));
}

export const CURATED_PLAYLIST = buildCuratedPlaylist();
