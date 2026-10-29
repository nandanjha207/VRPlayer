/**
 * Detox E2E — four required playback scenarios for the catalog / SDK wrapper.
 *
 * Wrapper mapping (UI stands in for direct SDK calls):
 *   load(url)  → selectPlaylistTitle() — taps a curated playlist row (see helpers/testMedia.js)
 *   play()     → tap playPauseButton
 *   pause()    → tap playPauseButton while PLAYING
 *   seek(60)   → seekToSeconds(60) — taps __DEV__ e2eSeekTo60 → commitSeek(60)
 *
 * Assertions read __DEV__ testIDs from MediaCatalogPlayer (e2ePlaybackState, e2eFirstFrameReady, …).
 *
 * Lifecycle: fresh JS context per test (reloadReactNative); each test sets up its own stream + play state.
 */

const {
  TEST_MEDIA,
  readPlaybackTimeCurrentSeconds,
  waitForCatalogPlayerReady,
  waitForE2ePlaybackState,
  waitForFirstFrameSince,
  waitForPlaybackStartedSignal,
  waitForPlaybackAdvance,
  waitForPlaybackTimeStable,
  waitForPlaybackPositionNear,
  ensurePlaying,
  selectPlaylistTitle,
  seekToSeconds,
  readPlaybackDurationSeconds,
} = require('./helpers/player');

describe('Catalog player playback (scoped E2E)', () => {
  /** One cold start of the app binary; notifications allowed for RN startup. */
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {notifications: 'YES'},
    });
  });

  /** Reload JS only — native player may persist; each test must select media and play again. */
  beforeEach(async () => {
    await device.reloadReactNative();
    await waitForCatalogPlayerReady();
  });

  /**
   * Test 1 — Initiate playback (valid HLS .m3u8)
   * Preconditions: catalog ready; TEST_MEDIA.hls row loads a reachable HLS URL.
   * Steps: load (playlist) → play → observe state, first frame, playbackStarted proxy.
   * Expect: BUFFERING→PLAYING (when observable), first frame ≤3s from play tap, time advances, no playerError.
   */
  it('initiates playback with a valid HLS URL', async () => {
    // load(url)
    await selectPlaylistTitle(TEST_MEDIA.hls.title);
    await waitForE2ePlaybackState('PAUSED', 30000);

    // play() — clock starts here for the 3s first-frame requirement
    const playStartedAt = Date.now();
    await element(by.id('playPauseButton')).tap();

    await waitForFirstFrameSince(playStartedAt, 3000);
    try {
      await waitForE2ePlaybackState('BUFFERING', 8000);
    } catch (_optionalBuffering) {
      // Some streams reach PLAYING before Detox observes BUFFERING.
    }
    await waitForE2ePlaybackState('PLAYING', 30000);
    await waitForPlaybackStartedSignal(30000);

    const start = await readPlaybackTimeCurrentSeconds();
    await waitForPlaybackAdvance(start, 1);
    await expect(element(by.id('playerError'))).not.toExist();
  });

  /**
   * Test 2 — Initiate playback (valid DASH .mpd)
   * Preconditions: TEST_MEDIA.dash row (clear Tears MPD on Android).
   * Steps: load → play → PLAYING, first frame, advancing time.
   * Expect: no manifest/playback error banner.
   */
  it('initiates playback with a valid DASH URL', async () => {
    await selectPlaylistTitle(TEST_MEDIA.dash.title);
    const playStartedAt = Date.now();
    await element(by.id('playPauseButton')).tap();
    await waitForE2ePlaybackState('PLAYING', 45000);
    await waitForFirstFrameSince(playStartedAt, 3000);
    const start = await readPlaybackTimeCurrentSeconds();
    await waitForPlaybackAdvance(start, 1);
    await expect(element(by.id('playerError'))).not.toExist();
  });

  /**
   * Test 3 — Pause and resume (single it block)
   * Preconditions: long-form HLS playing (TEST_MEDIA.longFormHls).
   * Steps: play → pause → verify PAUSED + frozen time → play → verify PLAYING + position ±0.5s.
   * Expect: PLAYING → PAUSED → PLAYING; no restart from 0:00.
   */
  it('pauses and resumes while preserving position', async () => {
    await selectPlaylistTitle(TEST_MEDIA.longFormHls.title);
    await ensurePlaying();

    // pause()
    await element(by.id('playPauseButton')).tap();
    await waitForE2ePlaybackState('PAUSED', 10000);
    await waitForPlaybackTimeStable(
      await readPlaybackTimeCurrentSeconds(),
      2000,
    );
    const pausedAt = await readPlaybackTimeCurrentSeconds();

    // play() to resume
    await element(by.id('playPauseButton')).tap();
    await waitForE2ePlaybackState('PLAYING', 15000);
    await new Promise(resolve => setTimeout(resolve, 400));
    const resumedAt = await readPlaybackTimeCurrentSeconds();
    if (Math.abs(resumedAt - pausedAt) > 0.5) {
      throw new Error(
        `Expected resume within ±0.5s of ${pausedAt}s but saw ${resumedAt}s`,
      );
    }
    await waitForPlaybackAdvance(resumedAt, 1);
  });

  /**
   * Test 4 — Seek to mid-stream (single it block)
   * Preconditions: duration > 120s; content playing.
   * Steps: seek(60) via e2eSeekTo60 → verify position 60±1s, onSeek count, playback continues.
   * Expect: no crash; seeked proxy (e2eSeekEventCount) increments.
   */
  it('seeks to a mid-stream position', async () => {
    await selectPlaylistTitle(TEST_MEDIA.longFormHls.title);
    await ensurePlaying();

    const durationSeconds = await readPlaybackDurationSeconds();
    if (durationSeconds < 120) {
      throw new Error(
        `Expected media duration > 120s for seek test but saw ${durationSeconds}s`,
      );
    }

    await seekToSeconds(60);
    const atSeek = await waitForPlaybackPositionNear(60, 1, 10000);
    await waitForPlaybackAdvance(atSeek, 0.5);
    await expect(element(by.id('playerError'))).not.toExist();
  });

  /*
   * Temporarily disabled — outside current scoped playback E2E.
   * Uncomment individual tests below to re-enable.
   */
  // it('shows the Catalog player screen', async () => {
  //   await expect(element(by.id('modeTabCatalog'))).toBeVisible();
  //   await expect(element(by.id('catalogPlayer'))).toBeVisible();
  //   await expect(element(by.id('playPauseButton'))).toBeVisible();
  //   await expect(element(by.text('Playlist (curated QA)'))).toBeVisible();
  // });
  //
  // it('starts playback and advances current time', async () => {
  //   const start = await readPlaybackTimeCurrentSeconds();
  //   await element(by.id('playPauseButton')).tap();
  //   await waitForPlaybackAdvance(start, 1);
  // });
  //
  // it('pauses playback and holds current time steady', async () => {
  //   await ensurePlaying();
  //   const playingAt = await readPlaybackTimeCurrentSeconds();
  //   await element(by.id('playPauseButton')).tap();
  //   await waitForPlaybackTimeStable(playingAt, 2500);
  // });
  //
  // it('resumes playback after pause', async () => {
  //   await ensurePlaying();
  //   const pausedAt = await readPlaybackTimeCurrentSeconds();
  //   await element(by.id('playPauseButton')).tap();
  //   await waitForPlaybackTimeStable(pausedAt, 1500);
  //   await element(by.id('playPauseButton')).tap();
  //   await waitForPlaybackAdvance(pausedAt, 1);
  // });
  //
  // it('increases volume via the settings slider', async () => {
  //   const {openVolumeSettings, setVolumeSliderPosition, readVolumeValue, closeSettingsModal} =
  //     require('./helpers/player');
  //   await openVolumeSettings();
  //   await setVolumeSliderPosition(0.12);
  //   const low = await readVolumeValue();
  //   await setVolumeSliderPosition(0.52);
  //   const high = await readVolumeValue();
  //   expect(high).toBeGreaterThan(low + 0.15);
  //   await closeSettingsModal();
  // });
  //
  // it('decreases volume via the settings slider', async () => {
  //   const {openVolumeSettings, setVolumeSliderPosition, readVolumeValue, closeSettingsModal} =
  //     require('./helpers/player');
  //   await openVolumeSettings();
  //   await setVolumeSliderPosition(0.62);
  //   const higher = await readVolumeValue();
  //   await setVolumeSliderPosition(0.22);
  //   const lower = await readVolumeValue();
  //   expect(lower).toBeLessThan(higher - 0.15);
  //   await closeSettingsModal();
  // });
  //
  // it('respects volume slider boundaries at 0 and 1', async () => {
  //   const {openVolumeSettings, setVolumeSliderPosition, readVolumeValue, closeSettingsModal} =
  //     require('./helpers/player');
  //   await openVolumeSettings();
  //   await setVolumeSliderPosition(0);
  //   const minVolume = await readVolumeValue();
  //   expect(minVolume).toBeLessThanOrEqual(0.02);
  //   await setVolumeSliderPosition(1);
  //   const maxVolume = await readVolumeValue();
  //   expect(maxVolume).toBeGreaterThanOrEqual(0.98);
  //   await closeSettingsModal();
  // });
  //
  // it('toggles mute and restores unmuted volume', async () => {
  //   const {
  //     openVolumeSettings,
  //     setVolumeSliderPosition,
  //     readVolumeValue,
  //     closeSettingsModal,
  //     waitForVolumeValue,
  //   } = require('./helpers/player');
  //   await openVolumeSettings();
  //   await setVolumeSliderPosition(0.4);
  //   const unmutedVolume = await readVolumeValue();
  //   await closeSettingsModal();
  //   await element(by.id('muteButton')).tap();
  //   await openVolumeSettings();
  //   await waitForVolumeValue(0);
  //   await closeSettingsModal();
  //   await element(by.id('muteButton')).tap();
  //   await openVolumeSettings();
  //   await waitForVolumeValue(unmutedVolume);
  //   await closeSettingsModal();
  // });
  //
  // it('handles repeated play/pause and ends paused', async () => {
  //   const {ensurePaused} = require('./helpers/player');
  //   await ensurePlaying();
  //   await ensurePaused();
  //   await ensurePlaying();
  //   await ensurePaused();
  //   const finalTime = await readPlaybackTimeCurrentSeconds();
  //   await waitForPlaybackTimeStable(finalTime, 2000);
  // });
  //
  // it('waits for loading to finish before playback controls are used', async () => {
  //   await waitForCatalogPlayerReady();
  //   const before = await readPlaybackTimeCurrentSeconds();
  //   await element(by.id('playPauseButton')).tap();
  //   await waitForPlaybackAdvance(before, 1);
  // });
});
