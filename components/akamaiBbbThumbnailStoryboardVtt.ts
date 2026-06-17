/**
 * WebVTT storyboard for Akamai's public Big Buck Bunny DASH sample
 * (https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_thumbnails.mpd).
 * JPEG tiles are one full image per 5s segment — matches the packaged thumbnails track.
 */

const AKAMAI_BBB_THUMB_BASE =
  'https://dash.akamaized.net/akamai/bbb_30fps/thumbnails_320x180/thumb';

/** MPD mediaPresentationDuration="PT634.566S" */
const AKAMAI_BBB_DURATION_SEC = 634.566;
const AKAMAI_BBB_THUMB_PERIOD_SEC = 5;

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

/** Format seconds as `HH:MM:SS.mmm` for WebVTT cues. */
export function formatVttTimeFromSeconds(totalSec: number): string {
  const ms = Math.round((totalSec % 1) * 1000);
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}.${String(ms).padStart(3, '0')}`;
}

/**
 * Builds a thumbnail WebVTT where each 5s window maps to the official `thumbN.jpg`
 * from the Akamai sample (same timeline as the video).
 */
export function buildAkamaiBbbThumbnailStoryboardVtt(): string {
  const lines: string[] = ['WEBVTT', ''];
  for (
    let start = 0;
    start < AKAMAI_BBB_DURATION_SEC;
    start += AKAMAI_BBB_THUMB_PERIOD_SEC
  ) {
    const thumbIndex = Math.floor(start / AKAMAI_BBB_THUMB_PERIOD_SEC) + 1;
    const end = Math.min(
      start + AKAMAI_BBB_THUMB_PERIOD_SEC,
      AKAMAI_BBB_DURATION_SEC,
    );
    lines.push(
      `${formatVttTimeFromSeconds(start)} --> ${formatVttTimeFromSeconds(end)}`,
      `${AKAMAI_BBB_THUMB_BASE}${thumbIndex}.jpg`,
      '',
    );
  }
  return lines.join('\n');
}
