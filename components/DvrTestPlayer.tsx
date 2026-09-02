/**
 * Fresh Live DVR integration test harness for SPOTV streams.
 * Consumes only public {@link VideoRef} DVR APIs from `@ttn/vr-rn-player-sdk`.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  LIVE_OFFSET_NOT_APPLICABLE,
  type OnBufferData,
  type OnDvrAvailabilityChangedData,
  type OnDvrWindowChangedData,
  type OnLoadData,
  type OnVideoErrorData,
  type ReactVideoSource,
  type VideoRef,
} from '@ttn/vr-rn-player-sdk';
import {buildDvrTestVideoSource} from './dvr/buildDvrTestVideoSource';
import {
  DVR_TEST_SOURCES,
  type DvrTestSource,
  type DvrTestSourceId,
} from './dvr/dvrTestSources';
import {VideoPlayer} from './videoFork';

const SEEK_STEP_MS = 10_000;
const OVERLAY_HIDE_MS = 4500;
const VIDEO_HORIZONTAL_PADDING = 24;
const SCRUB_PREVIEW_WIDTH = 96;
/** iOS AVPlayer may briefly report live-edge offset while a DVR seek settles. */
const IOS_DVR_SEEK_SETTLE_MS = 250;
const DVR_SEEK_LOCK_RELEASE_MS = Platform.OS === 'ios' ? 800 : 150;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type DvrSeekLock = Readonly<{
  active: boolean;
  targetMs: number | null;
}>;

type TriState = boolean | null;

type DvrWindowState = Readonly<{
  startMs: number;
  endMs: number;
}> | null;

function formatTriState(value: TriState): string {
  if (value === null) {
    return '—';
  }
  return value ? 'Yes' : 'No';
}

function formatMs(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (value === LIVE_OFFSET_NOT_APPLICABLE) {
    return 'N/A';
  }
  return `${value} ms`;
}

function formatDvrWindow(window: DvrWindowState): string {
  if (!window) {
    return '—';
  }
  return `${window.startMs} ms -> ${window.endMs} ms`;
}

function formatAvailabilityEvent(
  event: OnDvrAvailabilityChangedData | null,
): string {
  if (!event) {
    return '—';
  }
  return JSON.stringify(event);
}

function formatWindowEvent(event: OnDvrWindowChangedData | null): string {
  if (!event) {
    return '—';
  }
  return JSON.stringify(event);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function thumbMsFromOffset(
  window: DvrWindowState,
  liveOffsetMs: number | null,
): number | null {
  if (!window) {
    return null;
  }
  if (liveOffsetMs === null || liveOffsetMs === LIVE_OFFSET_NOT_APPLICABLE) {
    return window.endMs;
  }
  return Math.max(
    window.startMs,
    Math.min(window.endMs, window.endMs - liveOffsetMs),
  );
}

const INITIAL_DVR_STATE = {
  isLive: null as TriState,
  isDvrAvailable: null as TriState,
  liveOffsetMs: null as number | null,
  liveWindowStartOffset: null as number | null,
  dvrWindow: null as DvrWindowState,
  isAtLiveEdge: null as TriState,
  lastAvailabilityEvent: null as OnDvrAvailabilityChangedData | null,
  lastWindowEvent: null as OnDvrWindowChangedData | null,
};

export default function DvrTestPlayer() {
  const {width: windowWidth} = useWindowDimensions();
  const videoWidth = Math.max(0, windowWidth - VIDEO_HORIZONTAL_PADDING);
  const videoHeight = videoWidth / (16 / 9);
  const videoLayoutStyle = {width: videoWidth, height: videoHeight};

  const defaultSource =
    DVR_TEST_SOURCES.find(s => s.playable) ?? DVR_TEST_SOURCES[0]!;

  const [selectedSourceId, setSelectedSourceId] =
    useState<DvrTestSourceId>(defaultSource.id);
  const selectedSource = useMemo(
    () => DVR_TEST_SOURCES.find(s => s.id === selectedSourceId) ?? defaultSource,
    [selectedSourceId, defaultSource],
  );

  const videoRef = useRef<VideoRef>(null);
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dvrWindowRef = useRef<DvrWindowState>(null);
  const isScrubbingRef = useRef(false);
  const isSeekingDvrRef = useRef(false);
  const scrubSliderRef = useRef(0);
  const dvrSeekLockRef = useRef<DvrSeekLock>({active: false, targetMs: null});
  const dvrSeekReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [paused, setPaused] = useState(true);
  const [isContentPlaying, setIsContentPlaying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isSeekingDvr, setIsSeekingDvr] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipHint, setSkipHint] = useState<'back' | 'fwd' | null>(null);
  const [scrubSliderMs, setScrubSliderMs] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [seekTrackWidth, setSeekTrackWidth] = useState(0);

  const [dvrState, setDvrState] = useState(INITIAL_DVR_STATE);

  const videoSource: ReactVideoSource | undefined = useMemo(
    () => buildDvrTestVideoSource(selectedSource),
    [selectedSource],
  );

  const resetDvrState = useCallback(() => {
    if (dvrSeekReleaseTimerRef.current) {
      clearTimeout(dvrSeekReleaseTimerRef.current);
      dvrSeekReleaseTimerRef.current = null;
    }
    dvrSeekLockRef.current = {active: false, targetMs: null};
    setDvrState(INITIAL_DVR_STATE);
    setScrubSliderMs(0);
    scrubSliderRef.current = 0;
    setIsScrubbing(false);
    isScrubbingRef.current = false;
    dvrWindowRef.current = null;
    setLastError(null);
    setSkipHint(null);
    setIsBuffering(false);
    setControlsVisible(true);
  }, []);

  const showOverlay = useCallback(() => {
    setControlsVisible(true);
    if (hideOverlayTimerRef.current) {
      clearTimeout(hideOverlayTimerRef.current);
    }
    hideOverlayTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, OVERLAY_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideOverlayTimerRef.current) {
        clearTimeout(hideOverlayTimerRef.current);
      }
      if (dvrSeekReleaseTimerRef.current) {
        clearTimeout(dvrSeekReleaseTimerRef.current);
      }
    };
  }, []);

  const pinScrubToTarget = useCallback((targetMs: number) => {
    scrubSliderRef.current = targetMs;
    setScrubSliderMs(targetMs);
  }, []);

  const activateDvrSeekLock = useCallback(
    (targetMs: number) => {
      dvrSeekLockRef.current = {active: true, targetMs};
      pinScrubToTarget(targetMs);
      if (dvrSeekReleaseTimerRef.current) {
        clearTimeout(dvrSeekReleaseTimerRef.current);
        dvrSeekReleaseTimerRef.current = null;
      }
    },
    [pinScrubToTarget],
  );

  const releaseDvrSeekLock = useCallback((delayMs = DVR_SEEK_LOCK_RELEASE_MS) => {
    if (dvrSeekReleaseTimerRef.current) {
      clearTimeout(dvrSeekReleaseTimerRef.current);
    }
    dvrSeekReleaseTimerRef.current = setTimeout(() => {
      dvrSeekLockRef.current = {active: false, targetMs: null};
      dvrSeekReleaseTimerRef.current = null;
    }, delayMs);
  }, []);

  const shouldUpdateScrubFromEngine = useCallback(() => {
    return (
      !isScrubbingRef.current &&
      !isSeekingDvrRef.current &&
      !dvrSeekLockRef.current.active
    );
  }, []);

  const refreshDvrState = useCallback(async () => {
    const ref = videoRef.current;
    if (!ref) {
      return;
    }

    try {
      const [
        isLive,
        isDvrAvailable,
        liveOffsetMs,
        liveWindowStartOffset,
        dvrWindow,
        isAtLiveEdge,
      ] = await Promise.all([
        ref.isLive(),
        ref.isLiveDvrAvailable(),
        ref.getLiveOffsetMs(),
        ref.getLiveWindowStartOffset(),
        ref.getLiveDvrWindow(),
        ref.isAtLiveEdge(),
      ]);

      const nextWindow = dvrWindow
        ? {startMs: dvrWindow.startMs, endMs: dvrWindow.endMs}
        : null;
      dvrWindowRef.current = nextWindow;

      setDvrState(prev => ({
        ...prev,
        isLive,
        isDvrAvailable,
        liveOffsetMs,
        liveWindowStartOffset,
        dvrWindow: nextWindow,
        isAtLiveEdge,
      }));

      if (shouldUpdateScrubFromEngine()) {
        const thumb = thumbMsFromOffset(nextWindow, liveOffsetMs);
        if (thumb !== null) {
          scrubSliderRef.current = thumb;
          setScrubSliderMs(thumb);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'DVR state refresh failed';
      setLastError(message);
    }
  }, [shouldUpdateScrubFromEngine]);

  const refreshDvrStateIfIdle = useCallback(() => {
    if (dvrSeekLockRef.current.active || isSeekingDvrRef.current) {
      return;
    }
    refreshDvrState().catch(() => {});
  }, [refreshDvrState]);

  useEffect(() => {
    resetDvrState();
    if (!videoSource) {
      return;
    }
    videoRef.current?.setSource(videoSource);
    setPaused(true);
    setIsContentPlaying(false);
    showOverlay();
  }, [videoSource, resetDvrState, showOverlay]);

  const selectSource = useCallback(
    (source: DvrTestSource) => {
      if (source.id === selectedSourceId) {
        return;
      }
      resetDvrState();
      setSelectedSourceId(source.id);
    },
    [resetDvrState, selectedSourceId],
  );

  const onLoad = useCallback(
    (_data: OnLoadData) => {
      refreshDvrState().catch(() => {});
    },
    [refreshDvrState],
  );

  const onBuffer = useCallback((e: OnBufferData) => {
    setIsBuffering(e.isBuffering);
  }, []);

  const onDvrAvailabilityChanged = useCallback(
    (event: OnDvrAvailabilityChangedData) => {
      setDvrState(prev => ({
        ...prev,
        lastAvailabilityEvent: event,
        isDvrAvailable: event.isLiveDvrAvailable,
      }));
      refreshDvrStateIfIdle();
    },
    [refreshDvrStateIfIdle],
  );

  const onDvrWindowChanged = useCallback(
    (event: OnDvrWindowChangedData) => {
      const nextWindow = {startMs: event.startMs, endMs: event.endMs};
      dvrWindowRef.current = nextWindow;
      setDvrState(prev => ({
        ...prev,
        lastWindowEvent: event,
        dvrWindow: nextWindow,
      }));
      refreshDvrStateIfIdle();
    },
    [refreshDvrStateIfIdle],
  );

  const onError = useCallback((e: OnVideoErrorData) => {
    const message =
      e.error?.errorString ??
      e.error?.localizedDescription ??
      e.error?.error ??
      'Playback error';
    setLastError(String(message));
  }, []);

  const togglePlayPause = useCallback(() => {
    if (paused) {
      setPaused(false);
      setIsContentPlaying(true);
    } else {
      setPaused(true);
      setIsContentPlaying(false);
    }
    showOverlay();
  }, [paused, showOverlay]);

  /**
   * iOS AVPlayer pauses after DVR seek. Wait for the seek to settle before
   * unpausing so playback does not flash at the live edge first.
   */
  const resumePlaybackAfterDvrSeek = useCallback(
    async (ref: VideoRef, shouldResume: boolean) => {
      if (!shouldResume) {
        return;
      }
      if (Platform.OS === 'ios') {
        await sleep(IOS_DVR_SEEK_SETTLE_MS);
      }
      setPaused(false);
      setIsContentPlaying(true);
      if (Platform.OS === 'ios') {
        ref.resume();
      }
    },
    [],
  );

  const dvrControlsEnabled =
    selectedSource.playable &&
    !selectedSource.drmConfigMissing &&
    dvrState.isDvrAvailable === true &&
    !isSeekingDvr;

  const seekbarMin = dvrState.dvrWindow?.startMs ?? 0;
  const seekbarMax = dvrState.dvrWindow?.endMs ?? 0;
  const seekbarSpan = Math.max(seekbarMax - seekbarMin, 1);
  const seekbarEnabled = dvrControlsEnabled && seekbarMax > seekbarMin;

  const commitDvrSeek = useCallback(
    async (positionMs: number) => {
      const ref = videoRef.current;
      if (!ref || dvrState.isDvrAvailable !== true) {
        return;
      }

      const shouldResumeAfterSeek = !paused;
      const clamped = Math.max(
        seekbarMin,
        Math.min(seekbarMax, Math.round(positionMs)),
      );

      activateDvrSeekLock(clamped);
      isSeekingDvrRef.current = true;
      setIsSeekingDvr(true);
      try {
        await ref.seekToLiveOffset(clamped);
        await resumePlaybackAfterDvrSeek(ref, shouldResumeAfterSeek);
        if (Platform.OS === 'ios') {
          await sleep(IOS_DVR_SEEK_SETTLE_MS);
        }
        pinScrubToTarget(clamped);
        await refreshDvrState();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'DVR seek failed';
        setLastError(message);
      } finally {
        isSeekingDvrRef.current = false;
        setIsSeekingDvr(false);
        releaseDvrSeekLock();
      }
    },
    [
      activateDvrSeekLock,
      dvrState.isDvrAvailable,
      paused,
      pinScrubToTarget,
      refreshDvrState,
      releaseDvrSeekLock,
      resumePlaybackAfterDvrSeek,
      seekbarMin,
      seekbarMax,
    ],
  );

  const skipDvr = useCallback(
    (direction: 'back' | 'fwd') => {
      if (!seekbarEnabled) {
        return;
      }
      const delta = direction === 'back' ? -SEEK_STEP_MS : SEEK_STEP_MS;
      const target = Math.max(
        seekbarMin,
        Math.min(seekbarMax, scrubSliderRef.current + delta),
      );
      setSkipHint(direction);
      setTimeout(() => setSkipHint(null), 600);
      commitDvrSeek(target).catch(() => {});
      showOverlay();
    },
    [commitDvrSeek, seekbarEnabled, seekbarMin, seekbarMax, showOverlay],
  );

  const goLive = useCallback(async () => {
    const ref = videoRef.current;
    if (!ref) {
      return;
    }

    const shouldResumeAfterSeek = !paused;
    const targetMs = seekbarMax > seekbarMin ? seekbarMax : scrubSliderRef.current;
    activateDvrSeekLock(targetMs);
    isSeekingDvrRef.current = true;
    setIsSeekingDvr(true);
    try {
      await ref.seekToLiveEdge();
      await resumePlaybackAfterDvrSeek(ref, shouldResumeAfterSeek);
      if (Platform.OS === 'ios') {
        await sleep(IOS_DVR_SEEK_SETTLE_MS);
      }
      pinScrubToTarget(targetMs);
      await refreshDvrState();
      showOverlay();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Go Live failed';
      setLastError(message);
    } finally {
      isSeekingDvrRef.current = false;
      setIsSeekingDvr(false);
      releaseDvrSeekLock();
    }
  }, [
    activateDvrSeekLock,
    paused,
    pinScrubToTarget,
    refreshDvrState,
    releaseDvrSeekLock,
    resumePlaybackAfterDvrSeek,
    seekbarMax,
    seekbarMin,
    showOverlay,
  ]);

  const handleSeekStart = useCallback(() => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    activateDvrSeekLock(scrubSliderRef.current);
    showOverlay();
  }, [activateDvrSeekLock, showOverlay]);

  const handleSeekChange = useCallback((value: number) => {
    scrubSliderRef.current = value;
    setScrubSliderMs(value);
  }, []);

  const handleSeekComplete = useCallback(
    (value: number) => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      scrubSliderRef.current = value;
      setScrubSliderMs(value);
      commitDvrSeek(value).catch(() => {});
      showOverlay();
    },
    [commitDvrSeek, showOverlay],
  );

  useEffect(() => {
    if (
      paused ||
      !videoSource ||
      dvrState.isDvrAvailable !== true ||
      isScrubbing ||
      isSeekingDvr
    ) {
      return;
    }

    const updateThumb = () => {
      if (!shouldUpdateScrubFromEngine()) {
        return;
      }
      const ref = videoRef.current;
      const window = dvrWindowRef.current;
      if (!ref || !window) {
        return;
      }
      ref
        .getLiveOffsetMs()
        .then(offset => {
          if (!shouldUpdateScrubFromEngine()) {
            return;
          }
          const thumb = thumbMsFromOffset(window, offset);
          if (thumb !== null) {
            scrubSliderRef.current = thumb;
            setScrubSliderMs(thumb);
          }
        })
        .catch(() => {});
    };

    updateThumb();
    const intervalId = setInterval(updateThumb, 1000);
    return () => clearInterval(intervalId);
  }, [
    paused,
    videoSource,
    dvrState.isDvrAvailable,
    isScrubbing,
    isSeekingDvr,
    shouldUpdateScrubFromEngine,
  ]);

  const goLiveEnabled =
    selectedSource.playable &&
    !selectedSource.drmConfigMissing &&
    dvrState.isLive === true &&
    dvrState.isAtLiveEdge === false &&
    !isSeekingDvr;

  const scrubPreviewLeft = useMemo(() => {
    if (seekTrackWidth <= 0 || seekbarSpan <= 0) {
      return 0;
    }
    const ratio = (scrubSliderMs - seekbarMin) / seekbarSpan;
    const centerX = ratio * seekTrackWidth;
    const half = SCRUB_PREVIEW_WIDTH / 2;
    return Math.min(
      Math.max(0, centerX - half),
      Math.max(0, seekTrackWidth - SCRUB_PREVIEW_WIDTH),
    );
  }, [seekTrackWidth, seekbarSpan, scrubSliderMs, seekbarMin]);

  const leftTimeLabel = useMemo(() => {
    const window = dvrState.dvrWindow;
    if (isScrubbing || isSeekingDvr) {
      if (!window) {
        return formatTime(scrubSliderMs / 1000);
      }
      const offsetMs = Math.max(0, window.endMs - scrubSliderMs);
      return offsetMs <= 3000
        ? 'LIVE'
        : `-${formatTime(offsetMs / 1000)}`;
    }
    if (dvrState.isAtLiveEdge === true) {
      return 'LIVE';
    }
    const offset = dvrState.liveOffsetMs;
    if (offset !== null && offset !== LIVE_OFFSET_NOT_APPLICABLE) {
      return `-${formatTime(offset / 1000)}`;
    }
    return formatTime(scrubSliderMs / 1000);
  }, [
    dvrState.dvrWindow,
    dvrState.isAtLiveEdge,
    dvrState.liveOffsetMs,
    isScrubbing,
    isSeekingDvr,
    scrubSliderMs,
  ]);

  const rightTimeLabel = useMemo(() => {
    if (seekbarMax > 0) {
      return formatTime(seekbarMax / 1000);
    }
    return '—';
  }, [seekbarMax]);

  const canShowPlayerChrome = selectedSource.playable && !!videoSource;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Live DVR test</Text>
      <Text style={styles.subheading}>
        SPOTV live streams — catalog-style player controls
      </Text>

      <View style={styles.sourceRow}>
        {DVR_TEST_SOURCES.map(source => {
          const active = source.id === selectedSourceId;
          return (
            <Pressable
              key={source.id}
              onPress={() => selectSource(source)}
              style={[styles.sourceChip, active && styles.sourceChipActive]}>
              <Text
                style={[
                  styles.sourceChipLabel,
                  active && styles.sourceChipLabelActive,
                ]}>
                {source.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.videoStage, videoLayoutStyle]}>
        {videoSource ? (
          <View style={styles.videoClip} pointerEvents="none">
            <VideoPlayer
              ref={videoRef}
              source={videoSource}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              paused={paused}
              isContentPlaying={isContentPlaying}
              controls={false}
              progressUpdateInterval={250}
              onLoad={onLoad}
              onBuffer={onBuffer}
              onDvrAvailabilityChanged={onDvrAvailabilityChanged}
              onDvrWindowChanged={onDvrWindowChanged}
              onError={onError}
            />
          </View>
        ) : (
          <View style={[styles.placeholder, StyleSheet.absoluteFill]}>
            <Text style={styles.placeholderTitle}>Cannot play</Text>
            <Text style={styles.placeholderBody}>
              {selectedSource.unsupportedHint ??
                'This source is not playable on this platform.'}
            </Text>
          </View>
        )}

        {canShowPlayerChrome ? (
          <Pressable
            style={styles.overlayTapCatcher}
            onPress={() => {
              if (controlsVisible) {
                setControlsVisible(false);
                if (hideOverlayTimerRef.current) {
                  clearTimeout(hideOverlayTimerRef.current);
                }
              } else {
                showOverlay();
              }
            }}
            accessibilityLabel="Toggle player controls"
          />
        ) : null}

        {skipHint ? (
          <View style={styles.skipBadge} pointerEvents="none">
            <Text style={styles.skipBadgeText}>
              {skipHint === 'back' ? '−10s' : '+10s'}
            </Text>
          </View>
        ) : null}

        {(isBuffering || isSeekingDvr) && canShowPlayerChrome ? (
          <View
            style={[
              styles.bufferOverlay,
              isSeekingDvr && styles.seekBufferOverlay,
            ]}
            pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}

        {controlsVisible && canShowPlayerChrome ? (
          <View style={styles.overlayRoot} pointerEvents="box-none">
            <View style={styles.overlayTop} pointerEvents="box-none">
              <Text
                style={styles.overlayTitle}
                pointerEvents="none"
                numberOfLines={1}>
                {selectedSource.label}
              </Text>
            </View>

            {dvrState.isAtLiveEdge === true ? (
              <View style={styles.livePill} pointerEvents="none">
                <Text style={styles.liveDot}>●</Text>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : goLiveEnabled ? (
              <Pressable style={styles.goLivePill} onPress={() => goLive().catch(() => {})}>
                <Text style={styles.goLiveText}>GO LIVE</Text>
              </Pressable>
            ) : null}

            <View style={styles.overlayCenter}>
              <Pressable
                style={[styles.roundBtn, !seekbarEnabled && styles.roundBtnDisabled]}
                onPress={() => skipDvr('back')}
                disabled={!seekbarEnabled}>
                <Text style={styles.roundBtnGlyph}>⏪</Text>
                <Text style={styles.roundBtnCap}>10</Text>
              </Pressable>
              <Pressable style={styles.playMain} onPress={togglePlayPause}>
                <Text style={styles.playMainGlyph}>{paused ? '▶' : '⏸'}</Text>
              </Pressable>
              <Pressable
                style={[styles.roundBtn, !seekbarEnabled && styles.roundBtnDisabled]}
                onPress={() => skipDvr('fwd')}
                disabled={!seekbarEnabled}>
                <Text style={styles.roundBtnGlyph}>⏩</Text>
                <Text style={styles.roundBtnCap}>10</Text>
              </Pressable>
            </View>

            <View
              style={styles.overlayBottom}
              onLayout={e => setSeekTrackWidth(e.nativeEvent.layout.width)}>
              {isScrubbing && seekbarEnabled ? (
                <View
                  style={[
                    styles.scrubPreviewBubble,
                    {left: scrubPreviewLeft, width: SCRUB_PREVIEW_WIDTH},
                  ]}
                  pointerEvents="none">
                  <View style={styles.scrubPreviewPlaceholder}>
                    <Text style={styles.scrubPreviewPlaceholderGlyph}>DVR</Text>
                  </View>
                  <Text style={styles.scrubPreviewTime}>
                    {formatTime(scrubSliderMs / 1000)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.timeRow}>
                <Text style={styles.timeMono}>{leftTimeLabel}</Text>
                <Text style={styles.timeMono}>{rightTimeLabel}</Text>
              </View>
              <Slider
                style={styles.seekSlider}
                minimumValue={seekbarMin}
                maximumValue={seekbarMax > seekbarMin ? seekbarMax : seekbarMin + 1}
                value={scrubSliderMs}
                minimumTrackTintColor="#f8fafc"
                maximumTrackTintColor="rgba(255,255,255,0.35)"
                thumbTintColor="#fff"
                disabled={!seekbarEnabled}
                onSlidingStart={handleSeekStart}
                onValueChange={handleSeekChange}
                onSlidingComplete={handleSeekComplete}
              />
            </View>
          </View>
        ) : null}
      </View>

      {lastError ? (
        <Text style={styles.errorBanner} numberOfLines={3}>
          Error: {lastError}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DVR Status</Text>
        <StatusRow label="Live" value={formatTriState(dvrState.isLive)} />
        <StatusRow
          label="DVR Available"
          value={formatTriState(dvrState.isDvrAvailable)}
        />
        <StatusRow
          label="Live Offset"
          value={formatMs(dvrState.liveOffsetMs)}
        />
        <StatusRow
          label="Live Window Start Offset"
          value={formatMs(dvrState.liveWindowStartOffset)}
        />
        <StatusRow
          label="DVR Window"
          value={formatDvrWindow(dvrState.dvrWindow)}
        />
        <StatusRow
          label="At Live Edge"
          value={formatTriState(dvrState.isAtLiveEdge)}
        />
        <Pressable
          onPress={() => refreshDvrState().catch(() => {})}
          style={styles.refreshButton}>
          <Text style={styles.refreshButtonLabel}>Refresh DVR State</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DVR Events</Text>
        <Text style={styles.eventLabel}>Last DVR Availability Event:</Text>
        <Text style={styles.eventValue}>
          {formatAvailabilityEvent(dvrState.lastAvailabilityEvent)}
        </Text>
        <Text style={styles.eventLabel}>Last DVR Window Event:</Text>
        <Text style={styles.eventValue}>
          {formatWindowEvent(dvrState.lastWindowEvent)}
        </Text>
      </View>
    </ScrollView>
  );
}

function StatusRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}:</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingBottom: 32,
  },
  heading: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  subheading: {
    color: '#94a3b8',
    fontSize: 13,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#334155',
  },
  sourceChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  sourceChipLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  sourceChipLabelActive: {
    color: '#f8fafc',
  },
  videoStage: {
    alignSelf: 'center',
    marginTop: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTapCatcher: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#0f172a',
  },
  placeholderTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderBody: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  seekBufferOverlay: {
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 40,
    elevation: 40,
  },
  overlayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  overlayTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  livePill: {
    position: 'absolute',
    left: 12,
    bottom: 108,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  liveDot: {color: '#fff', fontSize: 10},
  liveText: {color: '#fff', fontWeight: '800', fontSize: 12},
  goLivePill: {
    position: 'absolute',
    left: 12,
    bottom: 108,
    backgroundColor: 'rgba(14,165,233,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  goLiveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  overlayCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  roundBtn: {
    alignItems: 'center',
  },
  roundBtnDisabled: {
    opacity: 0.35,
  },
  roundBtnGlyph: {fontSize: 34, color: '#fff'},
  roundBtnCap: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: -4,
  },
  playMain: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMainGlyph: {fontSize: 36, color: '#0f172a', marginLeft: 4},
  overlayBottom: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    position: 'relative',
  },
  scrubPreviewBubble: {
    position: 'absolute',
    bottom: 72,
    zIndex: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
  },
  scrubPreviewPlaceholder: {
    width: '100%',
    height: 54,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubPreviewPlaceholderGlyph: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  scrubPreviewTime: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timeMono: {
    color: '#e2e8f0',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  seekSlider: {width: '100%', height: 36},
  skipBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBadgeText: {
    fontSize: 44,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(127,29,29,0.5)',
    color: '#fecaca',
    fontSize: 12,
  },
  section: {
    gap: 8,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 13,
    flexShrink: 0,
  },
  statusValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  refreshButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    marginTop: 4,
  },
  refreshButtonLabel: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  eventLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  eventValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
