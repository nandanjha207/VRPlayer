import {
  findStoryboardCueAt,
  parseThumbnailStoryboardVtt,
  parseWebVttTimestamp,
  rewriteSpriteUrlIfMergedUnderVttFile,
} from '../components/thumbnailStoryboardVtt';

describe('rewriteSpriteUrlIfMergedUnderVttFile', () => {
  it('rewrites when VTT URL has a trailing slash (basename extraction)', () => {
    expect(
      rewriteSpriteUrlIfMergedUnderVttFile(
        'https://nvd.nuevodevel.com/media/coffee3.vtt/media/coffee16.jpg',
        'https://nvd.nuevodevel.com/media/coffee3.vtt/',
      ),
    ).toBe('https://nvd.nuevodevel.com/media/coffee16.jpg');
  });

  it('rewrites the exact Android / RN mis-merge seen on Nuevo (404 → real sprite path)', () => {
    expect(
      rewriteSpriteUrlIfMergedUnderVttFile(
        'https://nvd.nuevodevel.com/media/coffee3.vtt/media/coffee16.jpg',
        'https://nvd.nuevodevel.com/media/coffee3.vtt',
      ),
    ).toBe('https://nvd.nuevodevel.com/media/coffee16.jpg');
  });

  it('collapses /media/media/… when VTT is under /media/ (path-relative cue)', () => {
    expect(
      rewriteSpriteUrlIfMergedUnderVttFile(
        'https://nvd.nuevodevel.com/media/media/coffee16.jpg',
        'https://nvd.nuevodevel.com/media/coffee3.vtt',
      ),
    ).toBe('https://nvd.nuevodevel.com/media/coffee16.jpg');
  });

  it('leaves normal URLs unchanged', () => {
    const sprite = 'https://nvd.nuevodevel.com/media/coffee16.jpg';
    const vtt = 'https://nvd.nuevodevel.com/media/coffee3.vtt';
    expect(rewriteSpriteUrlIfMergedUnderVttFile(sprite, vtt)).toBe(sprite);
  });
});

describe('parseWebVttTimestamp', () => {
  it('parses HH:MM:SS.mmm', () => {
    expect(parseWebVttTimestamp('01:02:03.500')).toBe(3723.5);
  });
  it('parses MM:SS.mmm', () => {
    expect(parseWebVttTimestamp('05:30.250')).toBe(330.25);
  });
});

describe('parseThumbnailStoryboardVtt', () => {
  const vttBase = 'https://cdn.example.com/content/thumbs/storyboard.vtt';

  it('parses relative sprite refs with xywh', () => {
    const body = `WEBVTT

00:00.000 --> 00:05.000
tile.jpg#xywh=0,0,160,90

00:05.000 --> 00:10.000
tile.jpg#xywh=160,0,160,90
`;
    const cues = parseThumbnailStoryboardVtt(body, vttBase);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      start: 0,
      end: 5,
      imageUri: 'https://cdn.example.com/content/thumbs/tile.jpg',
      region: {x: 0, y: 0, w: 160, h: 90},
    });
    expect(cues[1].region).toMatchObject({x: 160, y: 0, w: 160, h: 90});
  });

  it('parses absolute image URL without xywh as full frame', () => {
    const body = `WEBVTT

00:00.000 --> 00:02.000
https://cdn.example.com/f0.jpg
`;
    const cues = parseThumbnailStoryboardVtt(body, vttBase);
    expect(cues).toHaveLength(1);
    expect(cues[0].imageUri).toBe('https://cdn.example.com/f0.jpg');
    expect(cues[0].region).toBeNull();
  });

  it('resolves root-relative paths against the VTT host (Nuevo-style)', () => {
    const body = `WEBVTT

00:00:00.000 --> 00:00:01.000
/media/coffee16.jpg#xywh=0,0,160,90

00:00:01.000 --> 00:00:02.000
/media/coffee16.jpg#xywh=0,90,160,90
`;
    const cues = parseThumbnailStoryboardVtt(
      body,
      'https://nvd.nuevodevel.com/media/coffee3.vtt',
    );
    expect(cues).toHaveLength(2);
    expect(cues[0].imageUri).toBe(
      'https://nvd.nuevodevel.com/media/coffee16.jpg',
    );
    expect(cues[0].spriteBounds).toEqual({w: 160, h: 180});
    expect(cues[1].spriteBounds).toEqual({w: 160, h: 180});
  });

  it('fixes path-relative refs when VTT base wrongly ends with / (…/file.vtt/media/sprite → /media/sprite)', () => {
    const body = `WEBVTT

00:00:00.000 --> 00:00:01.000
media/coffee16.jpg#xywh=0,0,160,90
`;
    const cues = parseThumbnailStoryboardVtt(
      body,
      'https://nvd.nuevodevel.com/media/coffee3.vtt/',
    );
    expect(cues).toHaveLength(1);
    expect(cues[0].imageUri).toBe(
      'https://nvd.nuevodevel.com/media/coffee16.jpg',
    );
  });
});

describe('findStoryboardCueAt', () => {
  const cues = parseThumbnailStoryboardVtt(
    `WEBVTT

00:00.000 --> 00:05.000
a.jpg#xywh=0,0,10,10

00:05.000 --> 00:10.000
a.jpg#xywh=10,0,10,10
`,
    'https://x/y/z.vtt',
  );

  it('returns last cue with start <= t', () => {
    expect(findStoryboardCueAt(cues, 0)?.start).toBe(0);
    expect(findStoryboardCueAt(cues, 4.9)?.start).toBe(0);
    expect(findStoryboardCueAt(cues, 5)?.start).toBe(5);
    expect(findStoryboardCueAt(cues, 99)?.start).toBe(5);
  });
});
