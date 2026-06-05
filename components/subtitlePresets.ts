import {TextTrackType} from 'react-native-video';
import type {TextTracks} from 'react-native-video';

/** ExoPlayer demo list (media.exolist.json) subtitle samples for QA. */
export type SubtitlePreset = {
  id: string;
  label: string;
  uri: string;
  textTracks?: TextTracks;
  /** Platforms where sidecar format is expected to work. */
  platforms?: 'all' | 'android';
};

const DIZZY_MP4 = 'https://html5demos.com/assets/dizzy.mp4';
const EXO_VTT = 'https://storage.googleapis.com/exoplayer-test-media-1/webvtt';
const EXO_TTML = 'https://storage.googleapis.com/exoplayer-test-media-1/ttml';
const EXO_SSA = 'https://storage.googleapis.com/exoplayer-test-media-1/ssa';
const EXO_MP4 =
  'https://storage.googleapis.com/exoplayer-test-media-1/gen-3/screens/dash-vod-single-segment/video-avc-baseline-480.mp4';

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'main',
    label: 'Main',
    uri: '', // filled from sourceUri prop at runtime
  },
  {
    id: 'webvtt',
    label: 'WebVTT',
    uri: DIZZY_MP4,
    textTracks: [
      {
        title: 'English',
        language: 'en',
        type: TextTrackType.VTT,
        uri: `${EXO_VTT}/numeric-lines.vtt`,
      },
    ],
  },
  {
    id: 'vtt-dual',
    label: 'VTT EN+JA',
    uri: DIZZY_MP4,
    textTracks: [
      {
        title: 'English',
        language: 'en',
        type: TextTrackType.VTT,
        uri: `${EXO_VTT}/numeric-lines.vtt`,
      },
      {
        title: 'Japanese',
        language: 'ja',
        type: TextTrackType.VTT,
        uri: `${EXO_VTT}/japanese.vtt`,
      },
    ],
  },
  {
    id: 'mkv-srt',
    label: 'SRT MKV',
    uri: 'https://storage.googleapis.com/exoplayer-test-media-1/mkv/android-screens-with-subrip.mkv',
    platforms: 'android',
  },
  {
    id: 'ttml',
    label: 'TTML',
    uri: DIZZY_MP4,
    textTracks: [
      {
        title: 'English TTML',
        language: 'en',
        type: TextTrackType.TTML,
        uri: `${EXO_TTML}/netflix_ttml_sample.xml`,
      },
    ],
    platforms: 'android',
  },
  {
    id: 'ssa-style',
    label: 'SSA style',
    uri: EXO_MP4,
    textTracks: [
      {
        title: 'SSA styling',
        language: 'en',
        type: TextTrackType.SUBRIP,
        uri: `${EXO_SSA}/test-subs-styling.ass`,
      },
    ],
    platforms: 'android',
  },
];

export function resolveSubtitlePresetUri(
  preset: SubtitlePreset,
  fallbackUri: string,
): string {
  return preset.id === 'main' ? fallbackUri : preset.uri;
}
