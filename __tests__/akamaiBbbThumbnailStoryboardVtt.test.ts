import {
  buildAkamaiBbbThumbnailStoryboardVtt,
  formatVttTimeFromSeconds,
} from '../components/akamaiBbbThumbnailStoryboardVtt';
import {
  findStoryboardCueAt,
  parseThumbnailStoryboardVtt,
} from '../components/thumbnailStoryboardVtt';

describe('formatVttTimeFromSeconds', () => {
  it('formats hours with milliseconds', () => {
    expect(formatVttTimeFromSeconds(3661.5)).toBe('01:01:01.500');
  });
});

describe('buildAkamaiBbbThumbnailStoryboardVtt', () => {
  it('produces parseable cues that map scrub time to thumb JPEGs', () => {
    const vtt = buildAkamaiBbbThumbnailStoryboardVtt();
    const cues = parseThumbnailStoryboardVtt(
      vtt,
      'https://dash.akamaized.net/akamai/bbb_30fps/storyboard.vtt',
    );
    expect(cues.length).toBeGreaterThan(120);
    const at2 = findStoryboardCueAt(cues, 2.5);
    expect(at2?.imageUri).toContain('thumb1.jpg');
    const at12 = findStoryboardCueAt(cues, 12);
    expect(at12?.imageUri).toContain('thumb3.jpg');
  });
});
