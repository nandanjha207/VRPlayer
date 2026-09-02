import {buildDvrTestVideoSource} from '../components/dvr/buildDvrTestVideoSource';
import {
  DVR_TEST_SOURCES,
  getDvrTestSource,
} from '../components/dvr/dvrTestSources';

describe('dvrTestSources', () => {
  it('defines four SPOTV test streams with exact URLs', () => {
    expect(DVR_TEST_SOURCES).toHaveLength(4);

    const drmHls = getDvrTestSource('drm-hls');
    expect(drmHls.uri).toBe(
      'https://cdn-spotv-a-01.vos360.video/Content/HLS_HLS/Live/channel(adhoc01mn)/index.m3u8',
    );

    const drmDash = getDvrTestSource('drm-dash');
    expect(drmDash.uri).toBe(
      'https://cdn-spotv-a-01.vos360.video/Content/DASH_DASH/Live/channel(adhoc01mn)/master.mpd',
    );
    expect(drmDash.drmConfigMissing).toBe(true);

    const clearHls = getDvrTestSource('clear-hls');
    expect(clearHls.uri).toBe(
      'https://cdn-spotv-a-01.vos360.video/Content/HLS_HLS/Live/channel(adhoc40mm)/index.m3u8',
    );

    const clearDash = getDvrTestSource('clear-dash');
    expect(clearDash.uri).toBe(
      'https://cdn-spotv-a-01.vos360.video/Content/DASH_DASH/Live/channel(adhoc40mm)/master.mpd',
    );
  });
});

describe('buildDvrTestVideoSource', () => {
  it('enables supportsDvr for playable clear HLS', () => {
    const source = buildDvrTestVideoSource(getDvrTestSource('clear-hls'));
    expect(source).toMatchObject({
      uri: getDvrTestSource('clear-hls').uri,
      type: 'm3u8',
      isLive: true,
      supportsDvr: true,
    });
    expect(source?.drm).toBeUndefined();
  });

  it('returns undefined when DRM config is missing', () => {
    expect(buildDvrTestVideoSource(getDvrTestSource('drm-dash'))).toBeUndefined();
  });

  it('attaches KeyOS FairPlay drm for DRM HLS', () => {
    const source = buildDvrTestVideoSource(getDvrTestSource('drm-hls'));
    expect(source?.drm?.type).toBe('fairplay');
    expect(source?.supportsDvr).toBe(true);
  });
});
