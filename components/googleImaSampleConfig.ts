/**
 * Shared Google IMA / GAM **sample** URLs for QA.
 *
 * - Catalog row uses {@link GOOGLE_IMA_LINEAR_PREROLL_AD_TAG} with {@link adTagUrl}.
 * - IMA test player uses {@link GOOGLE_IMA_PRE_MID_POST_AD_BREAKS} with `source.ad.adBreaks`
 *   (SDK builds inline VMAP via `buildVmapFromAdBreaks`).
 *
 * Multi-break tags must use `/21775744923/external/vmap_ad_samples` with per-position
 * `vpos` / `cue` / `pod` params — not reused `single_ad_samples` linear URLs.
 */

import {Platform} from 'react-native';
import type {AdBreak} from '@ttn/vr-rn-player-sdk';

/** ExoPlayer sample MKV — fine on Android; AVPlayer on iOS does not decode MKV. */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI_ANDROID =
  'https://storage.googleapis.com/exoplayer-test-media-1/mkv/android-screens-lavf-56.36.100-aac-avc-main-1280x720.mkv';

/** Short progressive MP4 for IMA + content QA on iOS (same catalog uses this host). */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI_IOS =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4';

/**
 * Main **content** URL for catalog IMA QA. Must be a format **AVPlayer can play** on iOS.
 */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI =
  Platform.OS === 'ios'
    ? GOOGLE_IMA_SAMPLE_CONTENT_URI_IOS
    : GOOGLE_IMA_SAMPLE_CONTENT_URI_ANDROID;

/** Single-break preroll (`source.ad.adTagUrl`). */
export const GOOGLE_IMA_LINEAR_PREROLL_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=';

/** Single skippable linear ad (`source.ad.adTagUrl`). */
export const GOOGLE_IMA_SKIPPABLE_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dskippablelinear&correlator=';

/**
 * Long VOD for pre/mid/post adBreaks QA (Eyevinn sample — matches SDK example).
 */
export const GOOGLE_IMA_PREMIDPOST_CONTENT_URI =
  'https://maitv-vod.lab.eyevinn.technology/VINN.mp4/master.m3u8';

/** Google premidpost VAST base — same inventory as SDK `ads_using_Adbreak.md`. */
const GOOGLE_IMA_PREMIDPOST_VAST_BASE =
  'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&ciu_szs=300x250&cust_params=sample_ar%3Dpremidpost&unviewed_position_start=1&output=xml_vast3&impl=s&env=vp&gdfp_req=1&ad_rule=0&vad_type=linear&cmsid=496&vid=short_onecue&lip=true&min_ad_duration=0&max_ad_duration=30000';

export const GOOGLE_IMA_PREMIDPOST_PREROLL_AD_TAG =
  `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&vpos=preroll&pod=1&ppos=1&correlator=`;

/** Mid-roll sample tag (cue=15000 ms) — SDK uses this URL for each mid-roll break. */
export const GOOGLE_IMA_PREMIDPOST_MIDROLL_AD_TAG =
  `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&cue=15000&vpos=midroll&pod=2&mridx=1&rmridx=1&ppos=1&correlator=`;

export const GOOGLE_IMA_PREMIDPOST_POSTROLL_AD_TAG =
  `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&vpos=postroll&pod=3&ppos=1&correlator=`;

/** Pre / 15s / 30s / post — pass as `source.ad.adBreaks`. */
export const GOOGLE_IMA_PRE_MID_POST_AD_BREAKS: ReadonlyArray<AdBreak> = [
  {position: 'pre', adTagUrl: GOOGLE_IMA_PREMIDPOST_PREROLL_AD_TAG},
  {position: 15, adTagUrl: GOOGLE_IMA_PREMIDPOST_MIDROLL_AD_TAG},
  {position: 30, adTagUrl: GOOGLE_IMA_PREMIDPOST_MIDROLL_AD_TAG},
  {position: 'post', adTagUrl: GOOGLE_IMA_PREMIDPOST_POSTROLL_AD_TAG},
];

export type GoogleImaTestPreset = {
  id: string;
  label: string;
  /** Single ad — SDK uses `source.ad.adTagUrl`. */
  adTagUrl?: string;
  /** Multi break — SDK uses `source.ad.adBreaks`. */
  adBreaks?: ReadonlyArray<AdBreak>;
  /** Override content URI (defaults to {@link GOOGLE_IMA_SAMPLE_CONTENT_URI}). */
  contentUri?: string;
};

export const GOOGLE_IMA_TEST_PRESETS: GoogleImaTestPreset[] = [
  {
    id: 'preroll',
    label: '1. Linear preroll',
    adTagUrl: GOOGLE_IMA_LINEAR_PREROLL_AD_TAG,
  },
  {
    id: 'skippable',
    label: '2. Skippable',
    adTagUrl: GOOGLE_IMA_SKIPPABLE_AD_TAG,
  },
  {
    id: 'premidpost-breaks',
    label: '3. Pre / 15s / 30s / post',
    adBreaks: GOOGLE_IMA_PRE_MID_POST_AD_BREAKS,
    contentUri: GOOGLE_IMA_PREMIDPOST_CONTENT_URI,
  },
];
