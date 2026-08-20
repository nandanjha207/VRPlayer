/**
 * Shared Google IMA / GAM **sample** URLs for QA (same tags as Google devsite samples).
 * Used by `ImaAdTestPlayer` and the curated catalog IMA row.
 *
 * SDK v1.0.3+ schedules ads via `source.ad.adBreaks`; the player builds inline VMAP
 * (`buildVmapFromAdBreaks`) and passes `adsResponse` to native IMA.
 *
 * Mid/post breaks must use `ad_rule_samples` VAST with `vpos` + `cue` — reusing
 * `single_ad_samples` linear URLs causes `AD_BREAK_FETCH_ERROR` / empty VAST.
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
 * Long VOD for mid-roll QA — Apple BipBop HLS (known duration, both platforms).
 */
export const GOOGLE_IMA_LONG_SAMPLE_CONTENT_URI =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8';

/**
 * Main **content** URL for client-side ads QA. Must be a format **AVPlayer can play** on iOS
 * or the item never becomes ready, IMA `requestAds` may not run, and you see a black surface
 * with no ad events.
 */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI =
  Platform.OS === 'ios'
    ? GOOGLE_IMA_SAMPLE_CONTENT_URI_IOS
    : GOOGLE_IMA_SAMPLE_CONTENT_URI_ANDROID;

/** Single-break preroll QA (`single_ad_samples` — only valid for standalone preroll). */
export const GOOGLE_IMA_LINEAR_PREROLL_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=';

export const GOOGLE_IMA_SKIPPABLE_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dskippablelinear&correlator=';

/** Google devsite server VMAP (pre / 15s mid / post in one tag). */
export const GOOGLE_IMA_VMAP_PREMIDPOST_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/ad_rule_samples&ciu_szs=300x250&ad_rule=1&impl=s&gdfp_req=1&env=vp&output=vmap&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&cmsid=496&vid=short_onecue&correlator=';

/**
 * Base for Google devsite **premidpost** per-break VAST URLs (same inventory as server VMAP).
 * Each break needs `vpos` and mid-rolls need `cue` in **milliseconds** matching `position`.
 */
const GOOGLE_IMA_PREMIDPOST_VAST_BASE =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/ad_rule_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&cmsid=496&vid=short_onecue&vad_type=linear';

export function googleImaPremidpostPrerollVastTag(): string {
  return `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&vpos=preroll&correlator=`;
}

/** @param cueSeconds Must match the `adBreaks[].position` value (IMA `cue` is ms). */
export function googleImaPremidpostMidrollVastTag(cueSeconds: number): string {
  const cueMs = Math.round(cueSeconds * 1000);
  return `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&vpos=midroll&cue=${cueMs}&correlator=`;
}

export function googleImaPremidpostPostrollVastTag(): string {
  return `${GOOGLE_IMA_PREMIDPOST_VAST_BASE}&vpos=postroll&correlator=`;
}

/** Mid-roll cue times (seconds) — keep in sync with {@link GOOGLE_IMA_PRE_MID_POST_AD_BREAKS}. */
export const GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS = [15, 30] as const;

/**
 * Pre / 15s / 30s / post — each break uses a **position-aware** GAM sample VAST URL.
 */
export const GOOGLE_IMA_PRE_MID_POST_AD_BREAKS: ReadonlyArray<AdBreak> = [
  {position: 'pre', adTagUrl: googleImaPremidpostPrerollVastTag()},
  {
    position: GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS[0],
    adTagUrl: googleImaPremidpostMidrollVastTag(
      GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS[0],
    ),
  },
  {
    position: GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS[1],
    adTagUrl: googleImaPremidpostMidrollVastTag(
      GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS[1],
    ),
  },
  {position: 'post', adTagUrl: googleImaPremidpostPostrollVastTag()},
];

export type GoogleImaTestPreset = {
  id: string;
  label: string;
  adBreaks: ReadonlyArray<AdBreak>;
  /** Use {@link GOOGLE_IMA_LONG_SAMPLE_CONTENT_URI} so mid-roll offsets are reachable. */
  needsLongContent?: boolean;
};

export const GOOGLE_IMA_TEST_PRESETS: GoogleImaTestPreset[] = [
  {
    id: 'preroll',
    label: '1. Linear preroll',
    adBreaks: [{position: 'pre', adTagUrl: GOOGLE_IMA_LINEAR_PREROLL_AD_TAG}],
  },
  {
    id: 'skippable',
    label: '2. Skippable',
    adBreaks: [{position: 'pre', adTagUrl: GOOGLE_IMA_SKIPPABLE_AD_TAG}],
  },
  {
    id: 'premidpost-breaks',
    label: '3. Pre / 15s / 30s / post',
    adBreaks: GOOGLE_IMA_PRE_MID_POST_AD_BREAKS,
    needsLongContent: true,
  },
];
