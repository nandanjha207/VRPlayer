import {
  inferManifestKind,
  parseDashMpdForVideoRenditions,
  parseHlsAttributeList,
  parseHlsMasterForVideoRenditions,
  resolveAgainstManifest,
} from '../components/manifestQualities';

describe('inferManifestKind', () => {
  it('detects HLS from .m3u8', () => {
    expect(inferManifestKind('https://x/a/b.m3u8')).toBe('hls');
  });
  it('detects HLS from Smooth / Unified .ism/.m3u8 path', () => {
    expect(
      inferManifestKind(
        'https://demo.example/video/foo.ism/.m3u8',
      ),
    ).toBe('hls');
  });
  it('detects DASH from .mpd', () => {
    expect(inferManifestKind('https://x/y/tears.mpd')).toBe('dash');
  });
  it('returns null for plain progressive', () => {
    expect(inferManifestKind('https://x/y/file.mp4')).toBeNull();
  });
});

describe('parseHlsAttributeList', () => {
  it('parses quoted CODECS with commas', () => {
    const body =
      'BANDWIDTH=263851,CODECS="mp4a.40.2, avc1.4d400d",RESOLUTION=416x234';
    const a = parseHlsAttributeList(body);
    expect(a.BANDWIDTH).toBe('263851');
    expect(a.CODECS).toBe('mp4a.40.2, avc1.4d400d');
    expect(a.RESOLUTION).toBe('416x234');
  });
});

describe('parseHlsMasterForVideoRenditions', () => {
  it('extracts video variants and resolves URIs', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=100,CODECS="avc1.4d400d",RESOLUTION=100x50',
      'low/prog_index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=200,CODECS="avc1.4d400d",RESOLUTION=200x100',
      'high/prog_index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=50,CODECS="mp4a.40.2"',
      'audio_only.m3u8',
    ].join('\n');
    const base = 'https://cdn.example/path/master.m3u8';
    const r = parseHlsMasterForVideoRenditions(master, base);
    expect(r).toHaveLength(2);
    expect(r[0].bandwidth).toBe(200);
    expect(r[0].uri).toBe('https://cdn.example/path/high/prog_index.m3u8');
    expect(r[1].bandwidth).toBe(100);
  });

  it('uses URI= on the #EXT-X-STREAM-INF line when present (RFC 8216)', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=100,CODECS="avc1.4d400d",URI="renditions/low.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=200,CODECS="avc1.4d400d",URI="renditions/high.m3u8"',
    ].join('\n');
    const base = 'https://cdn.example/live/out/master.m3u8';
    const r = parseHlsMasterForVideoRenditions(master, base);
    expect(r).toHaveLength(2);
    expect(r[0].bandwidth).toBe(200);
    expect(r[0].uri).toBe('https://cdn.example/live/out/renditions/high.m3u8');
    expect(r[1].uri).toBe('https://cdn.example/live/out/renditions/low.m3u8');
  });
});

describe('parseDashMpdForVideoRenditions', () => {
  it('reads video Representations with BaseURL', () => {
    const mpd = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="0" bandwidth="100" width="100" height="50">
        <BaseURL>low.mp4</BaseURL>
      </Representation>
      <Representation id="1" bandwidth="200" width="200" height="100">
        <BaseURL>high.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="a" bandwidth="128">
        <BaseURL>a.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
    const base = 'https://storage.example/media/manifest.mpd';
    const r = parseDashMpdForVideoRenditions(mpd, base);
    expect(r).toHaveLength(2);
    expect(r[0].bandwidth).toBe(200);
    expect(r[0].uri).toBe('https://storage.example/media/high.mp4');
  });
});

describe('resolveAgainstManifest', () => {
  it('resolves relative paths', () => {
    expect(
      resolveAgainstManifest(
        'https://a.com/b/c/master.m3u8',
        'child/playlist.m3u8',
      ),
    ).toBe('https://a.com/b/c/child/playlist.m3u8');
  });
});

describe('HLS base URL (redirect parity)', () => {
  it('variant absolute URL depends on manifest base path (must match post-redirect URL)', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=100,CODECS="avc1.4d400d"',
      'renditions/low.m3u8',
    ].join('\n');
    const entryPoint = 'https://go.example/start.m3u8';
    const afterRedirect = 'https://cdn.example/vod/season/1/master.m3u8';
    const fromEntry = parseHlsMasterForVideoRenditions(master, entryPoint)[0]
      .uri;
    const fromFinal = parseHlsMasterForVideoRenditions(master, afterRedirect)[0]
      .uri;
    expect(fromEntry).toBe('https://go.example/renditions/low.m3u8');
    expect(fromFinal).toBe('https://cdn.example/vod/season/1/renditions/low.m3u8');
  });
});
