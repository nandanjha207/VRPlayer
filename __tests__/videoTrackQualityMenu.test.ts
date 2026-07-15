import {
  dedupeVideoTracksByResolution,
  prepareVideoTracksForQualityUi,
  sortVideoTracksByQuality,
} from '../components/videoTrackQualityMenu';
import type {OnLoadData} from '@ttn/vr-rn-player-sdk';

type VT = OnLoadData['videoTracks'][number];

const t = (partial: Partial<VT>): VT => ({
  index: 0,
  ...partial,
});

describe('prepareVideoTracksForQualityUi', () => {
  it('drops iframe trick-play rows when tracksID hints iframe', () => {
    const tracks: OnLoadData['videoTracks'] = [
      t({
        index: 0,
        height: 720,
        width: 1280,
        bitrate: 3_000_000,
        tracksID: 'main-720',
        codecs: 'avc1.4d401f',
      }),
      t({
        index: 1,
        height: 720,
        width: 1280,
        bitrate: 400_000,
        tracksID: 'iframe-720',
        codecs: 'avc1.4d401f',
      }),
    ];
    const out = prepareVideoTracksForQualityUi(tracks);
    expect(out).toHaveLength(1);
    expect(out[0].tracksID).toBe('main-720');
  });

  it('dedupes same height keeping highest bitrate', () => {
    const tracks: OnLoadData['videoTracks'] = [
      t({index: 0, height: 1080, bitrate: 1_000_000, codecs: 'avc1.4d401f'}),
      t({index: 1, height: 1080, bitrate: 5_000_000, codecs: 'avc1.4d401f'}),
    ];
    const out = dedupeVideoTracksByResolution(tracks);
    expect(out).toHaveLength(1);
    expect(out[0].bitrate).toBe(5_000_000);
  });

  it('sortVideoTracksByQuality orders by height desc', () => {
    const tracks: OnLoadData['videoTracks'] = [
      t({index: 0, height: 360, bitrate: 500_000}),
      t({index: 1, height: 1080, bitrate: 4_000_000}),
    ];
    const out = sortVideoTracksByQuality(tracks);
    expect(out[0].height).toBe(1080);
  });
});
