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
 * @returns {Promise<number>}
 */
async function readPlaybackTimeCurrentSeconds() {
  const attrs = await element(by.id('playbackTimeCurrent')).getAttributes();
  const label =
    typeof attrs.text === 'string'
      ? attrs.text
      : typeof attrs.label === 'string'
        ? attrs.label
        : '';
  return parsePlaybackTimeLabel(label);
}

/**
 * @returns {Promise<number>}
 */
async function readVolumeValue() {
  const attrs = await element(by.id('volumeValue')).getAttributes();
  const label =
    typeof attrs.text === 'string'
      ? attrs.text
      : typeof attrs.label === 'string'
        ? attrs.label
        : '';
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
 * @param {number} baselineSeconds
 * @param {number} [stableMs]
 */
async function waitForPlaybackTimeStable(baselineSeconds, stableMs = 2500) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const now = await readPlaybackTimeCurrentSeconds();
    if (now === baselineSeconds) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await new Promise(resolve => setTimeout(resolve, stableMs));
  const after = await readPlaybackTimeCurrentSeconds();
  if (after !== baselineSeconds) {
    throw new Error(
      `Expected playback time to stay at ${baselineSeconds}s but saw ${after}s`,
    );
  }
}

async function ensurePlaying() {
  const start = await readPlaybackTimeCurrentSeconds();
  await element(by.id('playPauseButton')).tap();
  try {
    await waitForPlaybackAdvance(start, 1);
  } catch (_firstError) {
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackAdvance(start, 1);
  }
}

async function ensurePaused() {
  const before = await readPlaybackTimeCurrentSeconds();
  await element(by.id('playPauseButton')).tap();
  await waitForPlaybackTimeStable(before, 2000);
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

module.exports = {
  parsePlaybackTimeLabel,
  readPlaybackTimeCurrentSeconds,
  readVolumeValue,
  openVolumeSettings,
  closeSettingsModal,
  waitForCatalogPlayerReady,
  waitForPlaybackAdvance,
  waitForPlaybackTimeStable,
  ensurePlaying,
  ensurePaused,
  setVolumeSliderPosition,
  waitForVolumeValue,
};
