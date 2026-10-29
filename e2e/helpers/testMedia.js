/**
 * Curated catalog rows used by Detox playback tests.
 * Titles must match `components/curatedPlaylist.ts` exactly.
 * URLs are the same sources the app loads when a row is selected (wrapper load()).
 */
const TEST_MEDIA = {
  /** Test 1 — valid HLS .m3u8 */
  hls: {
    title: 'HLS – Tears of Steel (Unified Streaming)',
    url:
      'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  /** Test 2 — valid DASH .mpd (Android clear stream) */
  dash: {
    title: 'DASH – Tears clear (wvmedia multi quality)',
    url: 'https://storage.googleapis.com/wvmedia/clear/h264/tears/tears.mpd',
  },
  /** Tests 3 & 4 — VOD HLS with duration > 120s (pause/resume + seek) */
  longFormHls: {
    title: 'HLS – Tears of Steel (Unified Streaming)',
    url:
      'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
};

module.exports = {TEST_MEDIA};
