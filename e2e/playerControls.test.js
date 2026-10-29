const {
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
} = require('./helpers/player');

describe('Catalog player controls', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {notifications: 'YES'},
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await waitForCatalogPlayerReady();
  });

  it('shows the Catalog player screen', async () => {
    await expect(element(by.id('modeTabCatalog'))).toBeVisible();
    await expect(element(by.id('catalogPlayer'))).toBeVisible();
    await expect(element(by.id('playPauseButton'))).toBeVisible();
    await expect(element(by.text('Playlist (curated QA)'))).toBeVisible();
  });

  it('starts playback and advances current time', async () => {
    const start = await readPlaybackTimeCurrentSeconds();
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackAdvance(start, 1);
  });

  it('pauses playback and holds current time steady', async () => {
    await ensurePlaying();
    const playingAt = await readPlaybackTimeCurrentSeconds();
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackTimeStable(playingAt, 2500);
  });

  it('resumes playback after pause', async () => {
    await ensurePlaying();
    const pausedAt = await readPlaybackTimeCurrentSeconds();
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackTimeStable(pausedAt, 1500);
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackAdvance(pausedAt, 1);
  });

  it('increases volume via the settings slider', async () => {
    await openVolumeSettings();
    await setVolumeSliderPosition(0.12);
    const low = await readVolumeValue();
    await setVolumeSliderPosition(0.52);
    const high = await readVolumeValue();
    expect(high).toBeGreaterThan(low + 0.15);
    await closeSettingsModal();
  });

  it('decreases volume via the settings slider', async () => {
    await openVolumeSettings();
    await setVolumeSliderPosition(0.62);
    const higher = await readVolumeValue();
    await setVolumeSliderPosition(0.22);
    const lower = await readVolumeValue();
    expect(lower).toBeLessThan(higher - 0.15);
    await closeSettingsModal();
  });

  it('respects volume slider boundaries at 0 and 1', async () => {
    await openVolumeSettings();
    await setVolumeSliderPosition(0);
    const minVolume = await readVolumeValue();
    expect(minVolume).toBeLessThanOrEqual(0.02);
    await setVolumeSliderPosition(1);
    const maxVolume = await readVolumeValue();
    expect(maxVolume).toBeGreaterThanOrEqual(0.98);
    await closeSettingsModal();
  });

  it('toggles mute and restores unmuted volume', async () => {
    await openVolumeSettings();
    await setVolumeSliderPosition(0.4);
    const unmutedVolume = await readVolumeValue();
    await closeSettingsModal();

    await element(by.id('muteButton')).tap();
    await openVolumeSettings();
    await waitForVolumeValue(0);
    await closeSettingsModal();

    await element(by.id('muteButton')).tap();
    await openVolumeSettings();
    await waitForVolumeValue(unmutedVolume);
    await closeSettingsModal();
  });

  it('handles repeated play/pause and ends paused', async () => {
    await ensurePlaying();
    await ensurePaused();
    await ensurePlaying();
    await ensurePaused();
    const finalTime = await readPlaybackTimeCurrentSeconds();
    await waitForPlaybackTimeStable(finalTime, 2000);
  });

  it('waits for loading to finish before playback controls are used', async () => {
    await waitForCatalogPlayerReady();
    const before = await readPlaybackTimeCurrentSeconds();
    await element(by.id('playPauseButton')).tap();
    await waitForPlaybackAdvance(before, 1);
  });
});
