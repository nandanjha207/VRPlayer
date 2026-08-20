/**
 * Short curated playlist for QA — known HLS / DASH / DRM samples.
 * Replace or extend as you confirm which URLs work on your devices.
 */

import {Platform} from 'react-native';
import {buildAkamaiBbbThumbnailStoryboardVtt} from './akamaiBbbThumbnailStoryboardVtt';
import type {CatalogStreamItem} from './exoListParser';
import {
  GOOGLE_IMA_LINEAR_PREROLL_AD_TAG,
  GOOGLE_IMA_SAMPLE_CONTENT_URI,
} from './googleImaSampleConfig';
import {
  buildKeyOSDrmConfigWithCallback,
  KEYOS_CUSTOMDATA,
} from './drm/keyosDrm';

/** @deprecated Use {@link KEYOS_CUSTOMDATA} from `./drm/keyosDrm`. */
export const KEYOS_MERIDIAN_CUSTOM_DATA = KEYOS_CUSTOMDATA;

const HLS_HARMONIC_KEYOS_TTNTEST =
  'https://cdn-spotv-a-01.vos360.video/Content/HLS_HLS/Live/channel(drm)/index.m3u8';

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
/** Cast QA: clear HLS live (Amagi / Gusto) — Chromecast-friendly. */
const HLS_GUSTO_TV =
  'https://cdn-apse1-prod.tsv2.amagi.tv/linear/amg01077-gustoworldwidem-gustotv-hls-sooka/playlist.m3u8';
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
      category: 'Cast QA',
      title: 'HLS live – Gusto TV (clear, Chromecast)',
      uri: HLS_GUSTO_TV,
      thumbnailUri: THUMB_BIG_BUCK_BUNNY,
      tags: ['clear', 'live'],
      playable: true,
      unsupportedHint:
        'Non-DRM HLS live for Chromecast testing (matches SDK example).',
    },
    {
      category: 'Cast QA',
      title: 'DASH – WV Tears cenc (Widevine, Chromecast)',
      uri: WV_TEARS_MANIFEST,
      thumbnailUri: THUMB_TEARS,
      drmScheme: 'widevine',
      drmLicenseUri: WV_LICENSE_DEFAULT,
      tags: ['drm'],
      playable: Platform.OS === 'android',
      unsupportedHint:
        Platform.OS === 'ios'
          ? 'Widevine Cast DRM — Android only.'
          : 'Widevine DASH cenc — matches SDK / web Cast DRM test asset.',
    },
    {
      category: 'Ads (IMA)',
      title: 'IMA sample content + Google linear preroll (MKV Android / MP4 iOS)',
      uri: GOOGLE_IMA_SAMPLE_CONTENT_URI,
      adTagUri: GOOGLE_IMA_LINEAR_PREROLL_AD_TAG,
      thumbnailUri: THUMB_BIG_BUCK_BUNNY,
      tags: ['clear', 'ads'],
      playable: true,
      unsupportedHint:
        'Tap play first (fork: Android needs isContentPlaying to resume). iOS uses MP4 — AVPlayer cannot play the ExoPlayer MKV sample.',
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
      unsupportedHint:
        'Cast QA: multi-variant VOD master may stall on VR receiver (41A25E4F). Seek to 0 before Cast, or test Live HLS rows.',
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
      category: 'DRM – FairPlay (KeyOS / Harmonic)',
      title: 'HLS live – TTNTEST (KeyOS FairPlay)',
      description: '(hls|live|fairplay|keyos) TTNTEST',
      uri: HLS_HARMONIC_KEYOS_TTNTEST,
      thumbnailUri: THUMB_TEARS,
      drm: buildKeyOSDrmConfigWithCallback(KEYOS_CUSTOMDATA),
      tags: ['drm', 'live'],
      playable: Platform.OS === 'ios',
      unsupportedHint:
        Platform.OS === 'android'
          ? 'FairPlay — iOS physical device only (not simulator).'
          : 'Harmonic VOS360 live HLS via KeyOS v4 API. Real iPhone required.',
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
