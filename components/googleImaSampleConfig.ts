/**
 * Shared Google IMA / GAM **sample** URLs for QA (same tags as Google devsite samples).
 * Used by `ImaAdTestPlayer` and the curated catalog IMA row.
 */

import {Platform} from 'react-native';

/** ExoPlayer sample MKV — fine on Android; AVPlayer on iOS does not decode MKV. */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI_ANDROID =
  'https://storage.googleapis.com/exoplayer-test-media-1/mkv/android-screens-lavf-56.36.100-aac-avc-main-1280x720.mkv';

/** Short progressive MP4 for IMA + content QA on iOS (same catalog uses this host). */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI_IOS =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4';

/**
 * Main **content** URL for client-side ads QA. Must be a format **AVPlayer can play** on iOS
 * or the item never becomes ready, IMA `requestAds` may not run, and you see a black surface
 * with no ad events.
 */
export const GOOGLE_IMA_SAMPLE_CONTENT_URI =
  Platform.OS === 'ios'
    ? GOOGLE_IMA_SAMPLE_CONTENT_URI_IOS
    : GOOGLE_IMA_SAMPLE_CONTENT_URI_ANDROID;

export const GOOGLE_IMA_LINEAR_PREROLL_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=';

export const GOOGLE_IMA_SKIPPABLE_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dskippablelinear&correlator=';

export const GOOGLE_IMA_VMAP_PREMIDPOST_AD_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/ad_rule_samples&ciu_szs=300x250&ad_rule=1&impl=s&gdfp_req=1&env=vp&output=vmap&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ar%3Dpremidpost&cmsid=496&vid=short_onecue&correlator=';

export const GOOGLE_IMA_TEST_PRESETS = [
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
    id: 'vmap',
    label: '3. VMAP pre/mid/post',
    adTagUrl: GOOGLE_IMA_VMAP_PREMIDPOST_AD_TAG,
  },
] as const;
