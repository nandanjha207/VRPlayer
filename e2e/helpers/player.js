/**
 * Detox helpers for the four catalog playback tests (see ../playerControls.test.js).
 *
 * Prefer e2e* testIDs (MediaCatalogPlayer, __DEV__) for state/events/sub-second time.
 * UI testIDs: catalogPlayer, playlistList, playPauseButton, playerError, seekSlider.
 */

const {TEST_MEDIA} = require('./testMedia');

/**
 * @param {string} label
 * @returns {number}
 */
function parsePlaybackTimeLabel(label) {
  const match = /^(\d+):(\d{2})$/.exec(String(label).trim());
  if (!match) {
    throw new Error(`Unrecognized playback time label: ${label}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * @param {string} testId
 * @returns {Promise<string>}
 */
async function readTestIdText(testId) {
  const attrs = await element(by.id(testId)).getAttributes();
  const label =
    typeof attrs.text === 'string'
      ? attrs.text
      : typeof attrs.label === 'string'
        ? attrs.label
        : '';
  return String(label).trim();
}

/**
 * Current position in seconds — prefers e2ePlaybackTimeSeconds (Test 3 ±0.5s), else mm:ss label.
 * @returns {Promise<number>}
 */
async function readPlaybackTimeCurrentSeconds() {
  const precise = Number.parseFloat(await readTestIdText('e2ePlaybackTimeSeconds'));
  if (Number.isFinite(precise)) {
    return precise;
  }
  const label = await readTestIdText('playbackTimeCurrent');
  return parsePlaybackTimeLabel(label);
}

/**
 * @returns {Promise<number>}
 */
async function readPlaybackDurationSeconds() {
  const precise = Number.parseFloat(await readTestIdText('e2eDurationSeconds'));
  if (Number.isFinite(precise) && precise > 0) {
    return precise;
  }
  const label = await readTestIdText('playbackTimeDuration');
  return parsePlaybackTimeLabel(label);
}

async function waitForMinimumDuration(minSeconds, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const duration = await readPlaybackDurationSeconds();
    if (duration >= minSeconds) {
      return duration;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Duration stayed below ${minSeconds}s`);
}

/**
 * @returns {Promise<number>}
 */
async function readVolumeValue() {
  const label = await readTestIdText('volumeValue');
  const value = Number.parseFloat(label);
  if (!Number.isFinite(value)) {
    throw new Error(`Unrecognized volume value label: ${label}`);
  }
  return value;
}

async function openVolumeSettings() {
  await element(by.id('openSettingsButton')).tap();
  await waitFor(element(by.id('volumeSlider')))
    .toBeVisible()
    .withTimeout(10000);
  await waitFor(element(by.id('volumeValue')))
    .toBeVisible()
    .withTimeout(5000);
}

async function closeSettingsModal() {
  try {
    await element(by.text('✕')).tap();
  } catch (_e) {
    await device.pressBack();
  }
}

/** Tests 1–4 — player visible, loading done, no error banner. Called in beforeEach. */
async function waitForCatalogPlayerReady() {
  await waitFor(element(by.id('catalogPlayer')))
    .toBeVisible()
    .withTimeout(30000);
  await waitFor(element(by.id('playPauseButton')))
    .toBeVisible()
    .withTimeout(30000);
  try {
    await waitFor(element(by.id('playerLoadingIndicator')))
      .not.toBeVisible()
      .withTimeout(45000);
  } catch (_e) {
    // Indicator is unmounted when not buffering.
  }
  await expect(element(by.id('playerError'))).not.toExist();
}

/**
 * Wrapper load(url): scroll playlist, tap row, wait until stream is ready to play.
 * Used in all four tests (see TEST_MEDIA in testMedia.js).
 * @param {string} title
 */
async function selectPlaylistTitle(title) {
  await waitFor(element(by.text(title)))
    .toBeVisible()
    .whileElement(by.id('playlistList'))
    .scroll(250, 'down');
  await element(by.text(title)).tap();
  await waitForCatalogPlayerReady();
}

async function tapPlay() {
  await element(by.id('playPauseButton')).tap();
}

async function tapPause() {
  await element(by.id('playPauseButton')).tap();
}

/**
 * Polls testID e2ePlaybackState (IDLE | BUFFERING | PLAYING | PAUSED | SEEKING).
 * Tests 1–3: state transitions; Test 4: optional after seek.
 * @param {string} expectedState
 * @param {number} [timeoutMs]
 */
async function waitForE2ePlaybackState(expectedState, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readTestIdText('e2ePlaybackState');
    if (state === expectedState) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const last = await readTestIdText('e2ePlaybackState');
  throw new Error(
    `Expected e2e playback state ${expectedState} but saw ${last}`,
  );
}

/**
 * @param {number} [maxMs]
 */
async function waitForFirstFrameReady(maxMs = 3000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const ready = await readTestIdText('e2eFirstFrameReady');
    if (ready === 'yes') {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('First video frame did not render within 3 seconds');
}

/**
 * Tests 1–2 — first frame within maxMs after play() (Date.now() at tap).
 * Reads e2eFirstFrameReady (onReadyForDisplay or first progress fallback in app).
 * @param {number} playStartedAt
 * @param {number} [maxMs]
 */
async function waitForFirstFrameSince(playStartedAt, maxMs = 3000) {
  const deadline = playStartedAt + maxMs;
  while (Date.now() < deadline) {
    const ready = await readTestIdText('e2eFirstFrameReady');
    if (ready === 'yes') {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(
    'First video frame did not render within 3 seconds of playback start',
  );
}

/** Test 1 — proxy for SDK playbackStarted via e2ePlaybackStarted (first isPlaying after load). */
async function waitForPlaybackStartedSignal(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const started = await readTestIdText('e2ePlaybackStarted');
    if (started === 'yes') {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('playbackStarted signal did not fire (e2ePlaybackStarted)');
}

/**
 * @param {number} beforeSeconds
 * @param {number} [minDeltaSeconds]
 */
async function waitForPlaybackAdvance(beforeSeconds, minDeltaSeconds = 1) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const now = await readPlaybackTimeCurrentSeconds();
    if (now >= beforeSeconds + minDeltaSeconds) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(
    `Playback did not advance ${minDeltaSeconds}s from ${beforeSeconds}s`,
  );
}

/**
 * Test 4 — wait until current time is within toleranceSeconds of targetSeconds.
 * @param {number} targetSeconds
 * @param {number} toleranceSeconds
 * @param {number} [timeoutMs]
 */
async function waitForPlaybackPositionNear(
  targetSeconds,
  toleranceSeconds,
  timeoutMs = 20000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = await readPlaybackTimeCurrentSeconds();
    if (Math.abs(now - targetSeconds) <= toleranceSeconds) {
      return now;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const last = await readPlaybackTimeCurrentSeconds();
  throw new Error(
    `Expected position ~${targetSeconds}s (±${toleranceSeconds}s) but saw ${last}s`,
  );
}

/**
 * Test 3 — while PAUSED, position must not drift more than ±0.5s over stableMs.
 * @param {number} baselineSeconds
 * @param {number} [stableMs]
 */
async function waitForPlaybackTimeStable(baselineSeconds, stableMs = 2500) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const now = await readPlaybackTimeCurrentSeconds();
    if (Math.abs(now - baselineSeconds) <= 0.25) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await new Promise(resolve => setTimeout(resolve, stableMs));
  const after = await readPlaybackTimeCurrentSeconds();
  if (Math.abs(after - baselineSeconds) > 0.5) {
    throw new Error(
      `Expected playback time to stay at ~${baselineSeconds}s (±0.5s) but saw ${after}s`,
    );
  }
}

/** Tests 3–4 precondition — tap play until PLAYING and time advances ≥1s. */
async function ensurePlaying() {
  const start = await readPlaybackTimeCurrentSeconds();
  await element(by.id('playPauseButton')).tap();
  try {
    await waitForPlaybackAdvance(start, 1);
  } catch (_firstError) {
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackAdvance(start, 1);
  }
  await waitForE2ePlaybackState('PLAYING', 20000);
}

async function ensurePaused() {
  const before = await readPlaybackTimeCurrentSeconds();
  await element(by.id('playPauseButton')).tap();
  await waitForE2ePlaybackState('PAUSED', 10000);
  await waitForPlaybackTimeStable(before, 2000);
}

/**
 * Test 4 — wrapper seek(60): taps e2eSeekTo60 → commitSeek(60); asserts onSeek via e2eSeekEventCount.
 * @param {number} targetSeconds
 */
async function seekToSeconds(targetSeconds) {
  if (targetSeconds !== 60) {
    throw new Error(
      `Detox seek helper currently supports programmatic seek(60) only (got ${targetSeconds})`,
    );
  }
  const beforeSeekEvents = Number(await readTestIdText('e2eSeekEventCount'));
  await waitForMinimumDuration(Math.max(120, targetSeconds + 1));
  await element(by.id('e2eSeekTo60')).tap();
  const landed = await waitForPlaybackPositionNear(targetSeconds, 1, 30000);
  const afterSeekEvents = Number(await readTestIdText('e2eSeekEventCount'));
  if (afterSeekEvents <= beforeSeekEvents) {
    throw new Error(
      'Expected SDK onSeek (seeked) to fire after seek, but e2eSeekEventCount did not increase',
    );
  }
  return landed;
}

/**
 * @param {number} position
 */
async function setVolumeSliderPosition(position) {
  await element(by.id('volumeSlider')).adjustSliderToPosition(position);
  const expected = Math.round(position * 100) / 100;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const volume = await readVolumeValue();
    if (Math.abs(volume - expected) <= 0.03) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const volume = await readVolumeValue();
  throw new Error(
    `Volume did not reach ~${expected.toFixed(2)} (saw ${volume.toFixed(2)})`,
  );
}

/**
 * @param {number} expected
 */
async function waitForVolumeValue(expected) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const volume = await readVolumeValue();
    if (Math.abs(volume - expected) <= 0.03) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Volume did not reach ~${expected}`);
}

/**
 * Loads (catalog select) + play() for a curated stream title.
 * @param {{ title: string }} media
 */
async function loadCatalogItemAndPlay(media) {
  await selectPlaylistTitle(media.title);
  const playStartedAt = Date.now();
  await tapPlay();
  return {playStartedAt};
}

module.exports = {
  TEST_MEDIA,
  parsePlaybackTimeLabel,
  readTestIdText,
  readPlaybackTimeCurrentSeconds,
  readPlaybackDurationSeconds,
  readVolumeValue,
  openVolumeSettings,
  closeSettingsModal,
  waitForCatalogPlayerReady,
  selectPlaylistTitle,
  tapPlay,
  tapPause,
  waitForE2ePlaybackState,
  waitForFirstFrameReady,
  waitForFirstFrameSince,
  waitForPlaybackStartedSignal,
  waitForPlaybackAdvance,
  waitForPlaybackPositionNear,
  waitForPlaybackTimeStable,
  ensurePlaying,
  ensurePaused,
  waitForMinimumDuration,
  seekToSeconds,
  setVolumeSliderPosition,
  waitForVolumeValue,
  loadCatalogItemAndPlay,
};
