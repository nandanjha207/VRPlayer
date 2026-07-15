/**
 * Short curated playlist for QA — known HLS / DASH / DRM samples.
 * Replace or extend as you confirm which URLs work on your devices.
 */

import {Platform} from 'react-native';
import {buildAkamaiBbbThumbnailStoryboardVtt} from './akamaiBbbThumbnailStoryboardVtt';
import type {CatalogStreamItem} from './exoListParser';

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

/** Nuevo Devel sample: HLS + external WebVTT scrub thumbnails. */
const NUEVO_COFFEE_HLS =
  'https://stream.nuevodevel.com/hls/coffee/playlist.m3u8';
const NUEVO_COFFEE_THUMB_VTT =
  'https://nvd.nuevodevel.com/media/coffee3.vtt';
const NUEVO_COFFEE_POSTER =
  'https://nvd.nuevodevel.com/media/coffee16.jpg';
const AKAMAI_BBB_DASH_WITH_THUMBS =
  'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_thumbnails.mpd';

const MP4_BIG_BUCK_BUNNY =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4';

const MP4_ONE_HR =
  'https://storage.googleapis.com/exoplayer-test-media-1/mp4/frame-counter-one-hour.mp4';
const HLS_LIVE_FORSTREET = 'https://live.forstreet.cl/live/livestream.m3u8';
/** Forstreet CDN returns 400 for ExoPlayer / AVPlayer UAs — browser UA required. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * BunnyCDN (stream.nuevodevel.com / nvd.nuevodevel.com) returns 403 without a browser-like
 * User-Agent **and** a site Referer (curl: Referer https://nuevodevel.com/ → 200).
 */
const NUEVO_DEVEL_CDN_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Referer: 'https://nuevodevel.com/',
};

/** Shaka Player public FairPlay demo (no customdata — native FPS license flow). */
const SHAKA_ANGEL_ONE_HLS =
  'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8';
const SHAKA_FP_CERT = 'https://cwip-shaka-proxy.appspot.com/fps_certificate';
const SHAKA_FP_LICENSE = 'https://cwip-shaka-proxy.appspot.com/no_auth';

/** Brightcove Live FairPlay (tokenized cert + license URLs). */
const BRIGHTCOVE_LIVE_HLS =
  'https://fastly.live.brightcove.com/6387929198112/ap-southeast-1/6271486521001/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJob3N0Ijoid29ocXRqLmVncmVzcy5wcHRpOHciLCJhY2NvdW50X2lkIjoiNjI3MTQ4NjUyMTAwMSIsImVobiI6ImZhc3RseS5saXZlLmJyaWdodGNvdmUuY29tIiwiaXNzIjoiYmxpdmUtcGxheWJhY2stc291cmNlLWFwaSIsInN1YiI6InBhdGhtYXB0b2tlbiIsImF1ZCI6WyI2MjcxNDg2NTIxMDAxIl0sImp0aSI6IjYzODc5MjkxOTgxMTIifQ.TNO-Uq2c4NEHQCD1vzs1wN5nMIxqbUqas6OIo4aK4fM/playlist-hls.m3u8';
const BRIGHTCOVE_FP_CERT =
  'https://license.live.brightcove.com/cert/fp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJicmlnaHRjb3ZlL2xpdmUvdjIvbGljZW5jZS1hcGkiLCJleHAiOjE3ODQwNjY5NTEsImp0aSI6IjAzNTYwZTcyLTU0OGMtNGZhMy1hZTg0LWM4NmI3MDc3ZTMwNiIsImlhdCI6MTc4NDAyMzc1MSwiaXNzIjoiYnJpZ2h0Y292ZS9saXZlL3YyL3BsYXliYWNrLW1hbmFnZW1lbnQtYXBpIiwibmJmIjoxNzg0MDIzNzUxLCJzdWIiOiI2Mzg3OTI5MTk4MTEyIiwiYWNjb3VudCI6ImJyaWdodGNvdmVfNjI3MTQ4NjUyMTAwMSIsInBsYXlsaXN0IjoiIiwib3B0aW9ucyI6W10sImNydCI6eyJtZXNzYWdlIjoiTGljZW5zZSBncmFudGVkIiwib3AiOnsiY29uZmlnIjp7IkFVRElPIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIkhEIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIlNEIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIlVIRCI6eyJGYWlyUGxheSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJQbGF5UmVhZHkiOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifSwiV2lkZXZpbmVNIjp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn19fX0sIm91dHB1dFByb3RlY3Rpb24iOnsiYW5hbG9ndWUiOnRydWUsImRpZ2l0YWwiOnRydWUsImVuZm9yY2UiOmZhbHNlfSwicHJvZmlsZSI6eyJwdXJjaGFzZSI6e319LCJzdG9yZUxpY2Vuc2UiOmZhbHNlfSwicmVmZXJlciI6IiIsImFjY2lkIjoiNjI3MTQ4NjUyMTAwMSIsInZpZCI6IjYzODc5MjkxOTgxMTIiLCJwYXQiOiIifQ.-QiWRQhu5HmVS7bD6UYHy6RDWwlVDIYhASJwCUda0MY';
const BRIGHTCOVE_FP_LICENSE =
  'https://license.live.brightcove.com/lic/fp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJicmlnaHRjb3ZlL2xpdmUvdjIvbGljZW5jZS1hcGkiLCJleHAiOjE3ODQwNjY5NTEsImp0aSI6IjAzNTYwZTcyLTU0OGMtNGZhMy1hZTg0LWM4NmI3MDc3ZTMwNiIsImlhdCI6MTc4NDAyMzc1MSwiaXNzIjoiYnJpZ2h0Y292ZS9saXZlL3YyL3BsYXliYWNrLW1hbmFnZW1lbnQtYXBpIiwibmJmIjoxNzg0MDIzNzUxLCJzdWIiOiI2Mzg3OTI5MTk4MTEyIiwiYWNjb3VudCI6ImJyaWdodGNvdmVfNjI3MTQ4NjUyMTAwMSIsInBsYXlsaXN0IjoiIiwib3B0aW9ucyI6W10sImNydCI6eyJtZXNzYWdlIjoiTGljZW5zZSBncmFudGVkIiwib3AiOnsiY29uZmlnIjp7IkFVRElPIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIkhEIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIlNEIjp7IkZhaXJQbGF5Ijp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn0sIlBsYXlSZWFkeSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJXaWRldmluZU0iOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifX0sIlVIRCI6eyJGYWlyUGxheSI6eyJyZXF1aXJlSERDUCI6IkhEQ1BfTk9ORSJ9LCJQbGF5UmVhZHkiOnsicmVxdWlyZUhEQ1AiOiJIRENQX05PTkUifSwiV2lkZXZpbmVNIjp7InJlcXVpcmVIRENQIjoiSERDUF9OT05FIn19fX0sIm91dHB1dFByb3RlY3Rpb24iOnsiYW5hbG9ndWUiOnRydWUsImRpZ2l0YWwiOnRydWUsImVuZm9yY2UiOmZhbHNlfSwicHJvZmlsZSI6eyJwdXJjaGFzZSI6e319LCJzdG9yZUxpY2Vuc2UiOmZhbHNlfSwicmVmZXJlciI6IiIsImFjY2lkIjoiNjI3MTQ4NjUyMTAwMSIsInZpZCI6IjYzODc5MjkxOTgxMTIiLCJwYXQiOiIifQ.-QiWRQhu5HmVS7bD6UYHy6RDWwlVDIYhASJwCUda0MY';

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
      category: 'Test',
      title: 'MP4  One hr clip',
      uri: MP4_ONE_HR,
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
      tags: ['clear'],
      playable: true,
    },
    {
      category: 'HLS (clear)',
      title: 'HLS – Nuevo Devel Coffee (WebVTT scrub thumbs)',
      uri: NUEVO_COFFEE_HLS,
      thumbnailUri: NUEVO_COFFEE_POSTER,
      thumbnailStoryboardVttUri: NUEVO_COFFEE_THUMB_VTT,
      headers: NUEVO_DEVEL_CDN_HEADERS,
      tags: ['clear'],
      playable: true,
      unsupportedHint:
        'BunnyCDN requires browser User-Agent + Referer (https://nuevodevel.com/) like a page embed.',
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
      title: 'DASH – Tears clear (wvmedia multi quality)',
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
    {
      category: 'DRM – FairPlay (iOS test)',
      title: 'HLS – Brightcove Live (FairPlay)',
      uri: BRIGHTCOVE_LIVE_HLS,
      thumbnailUri: THUMB_TEARS,
      drmScheme: 'fairplay',
      drmLicenseUri: BRIGHTCOVE_FP_LICENSE,
      fairPlayCertificateUrl: BRIGHTCOVE_FP_CERT,
      fairPlayLicenseHandler: 'brightcove',
      tags: ['drm', 'live'],
      playable: Platform.OS === 'ios',
      unsupportedHint:
        Platform.OS === 'android'
          ? 'FairPlay — iOS physical device only (not simulator).'
          : 'Brightcove Live: custom JSON license POST. Use a real iPhone; refresh JWT URLs when expired.',
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
