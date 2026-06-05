/**
 * Lightweight video player for testing playback controls and react-native-video behavior.
 * Uses functional components, hooks, and react-native-video v6 callbacks.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Video, {
  SelectedTrackType,
  type OnBufferData,
  type OnLoadData,
  type OnProgressData,
  type OnTextTracksData,
  type ReactVideoSource,
  type SelectedTrack,
  type TextTracks,
  type VideoRef,
} from 'react-native-video';
import {
  SUBTITLE_PRESETS,
  resolveSubtitlePresetUri,
} from './subtitlePresets';

/** Public playback states shown in the UI. */
export type PlaybackState = 'Playing' | 'Paused' | 'Buffering' | 'Ended';

// HLS
// export const SAMPLE_MP4_URL =
//   'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

// DASH (iOS) / HLS (Android)
export const SAMPLE_MP4_URL =
  Platform.OS === 'android'
    ? 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8'
    : 'https://storage.googleapis.com/wvmedia/clear/h264/tears/tears.mpd';

const SEEK_STEP_SECONDS = 10;
const VIDEO_HORIZONTAL_PADDING = 32;
const VIDEO_ASPECT_RATIO = 16 / 9;
const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export type SimpleVideoPlayerProps = {
  /** Remote or local video URI. */
  sourceUri?: string;
};

/** Builds a react-native-video source object with optional sidecar subtitles. */
function buildVideoSource(
  uri: string,
  sidecarTextTracks?: TextTracks,
): ReactVideoSource {
  const lower = uri.toLowerCase();
  let type: string | undefined;
  if (lower.includes('.m3u8')) {
    type = 'm3u8';
  } else if (lower.includes('.mpd')) {
    type = 'mpd';
  } else if (lower.includes('.mkv')) {
    type = 'mkv';
  }

  return {
    uri,
    ...(type ? {type} : {}),
    ...(sidecarTextTracks?.length ? {textTracks: sidecarTextTracks} : {}),
  };
}

function formatTextTrackLabel(
  track: OnLoadData['textTracks'][number],
  index: number,
): string {
  const parts = [track.language, track.title].filter(Boolean);
  return parts.length > 0 ? parts.join(' – ') : `Track ${index}`;
}

/** Formats seconds as m:ss for the time labels. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Derives the label shown under the controls from pause, buffer, and end flags.
 */
function resolvePlaybackState(
  paused: boolean,
  isBuffering: boolean,
  hasEnded: boolean,
): PlaybackState {
  if (hasEnded) {
    return 'Ended';
  }
  if (isBuffering) {
    return 'Buffering';
  }
  if (paused) {
    return 'Paused';
  }
  return 'Playing';
}

export function SimpleVideoPlayer({
  sourceUri = SAMPLE_MP4_URL,
}: SimpleVideoPlayerProps) {
  const {width: windowWidth} = useWindowDimensions();
  const videoWidth = windowWidth - VIDEO_HORIZONTAL_PADDING;
  const videoHeight = videoWidth / VIDEO_ASPECT_RATIO;
  const videoLayoutStyle = {width: videoWidth, height: videoHeight};

  const videoRef = useRef<VideoRef>(null);
  const currentTimeRef = useRef(0);
  const wasPlayingBeforeBackgroundRef = useRef(false);
  const playbackSnapshotRef = useRef({
    paused: true,
    isContentPlaying: false,
    hasEnded: false,
  });

  // Playback control
  const [paused, setPaused] = useState(true);
  /** Required by custom react-native-video: native play() only runs when this is true. */
  const [isContentPlaying, setIsContentPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Subtitles (TC-SUB-001 … 006)
  const [subtitlePresetId, setSubtitlePresetId] = useState('webvtt');
  const [availableTextTracks, setAvailableTextTracks] = useState<
    OnLoadData['textTracks']
  >([]);
  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTextTrack>(
    {type: SelectedTrackType.DISABLED},
  );
  const [subtitleFontSize, setSubtitleFontSize] = useState(18);
  const [subtitleOpacity, setSubtitleOpacity] = useState(1);

  // Timeline
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekSliderValue, setSeekSliderValue] = useState(0);

  // Audio
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const volumeBeforeMuteRef = useRef(1);

  const playbackState = resolvePlaybackState(paused, isBuffering, hasEnded);

  const activeSubtitlePreset =
    SUBTITLE_PRESETS.find(preset => preset.id === subtitlePresetId) ??
    SUBTITLE_PRESETS[1];
  const activeVideoUri = resolveSubtitlePresetUri(
    activeSubtitlePreset,
    sourceUri,
  );
  const videoSource = buildVideoSource(
    activeVideoUri,
    activeSubtitlePreset.textTracks,
  );

  const resetPlaybackForSourceChange = useCallback(() => {
    setPaused(true);
    setIsContentPlaying(false);
    setHasEnded(false);
    setIsBuffering(false);
    setDuration(0);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setSeekSliderValue(0);
    setAvailableTextTracks([]);
    setSelectedTextTrack({type: SelectedTrackType.DISABLED});
  }, []);

  const selectSubtitlePreset = useCallback(
    (presetId: string) => {
      setSubtitlePresetId(presetId);
      resetPlaybackForSourceChange();
    },
    [resetPlaybackForSourceChange],
  );

  const selectTextTrack = useCallback((index: number | 'off') => {
    if (index === 'off') {
      setSelectedTextTrack({type: SelectedTrackType.DISABLED});
      return;
    }
    setSelectedTextTrack({type: SelectedTrackType.INDEX, value: index});
  }, []);

  useEffect(() => {
    playbackSnapshotRef.current = {paused, isContentPlaying, hasEnded};
  }, [paused, isContentPlaying, hasEnded]);

  /** Re-sync native playback after OS stops video in background. */
  const resumePlaybackAfterForeground = useCallback(() => {
    const resumeTime = currentTimeRef.current;
    setHasEnded(false);
    setIsContentPlaying(true);
    setPaused(false);
    videoRef.current?.seek(resumeTime);
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const snapshot = playbackSnapshotRef.current;

      if (nextAppState === 'inactive' || nextAppState === 'background') {
        wasPlayingBeforeBackgroundRef.current =
          !snapshot.paused &&
          snapshot.isContentPlaying &&
          !snapshot.hasEnded;
        return;
      }

      if (nextAppState === 'active' && wasPlayingBeforeBackgroundRef.current) {
        wasPlayingBeforeBackgroundRef.current = false;
        resumePlaybackAfterForeground();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [resumePlaybackAfterForeground]);

  /**
   * onLoad — fired when the media is ready; provides duration and track metadata.
   */
  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setCurrentTime(data.currentTime);
    currentTimeRef.current = data.currentTime;
    setSeekSliderValue(data.currentTime);
    setHasEnded(false);
    setIsBuffering(false);
    if (data.textTracks?.length) {
      setAvailableTextTracks(data.textTracks);
    }
  }, []);

  const handleTextTracks = useCallback((data: OnTextTracksData) => {
    if (data.textTracks?.length) {
      setAvailableTextTracks(data.textTracks);
    }
  }, []);

  /**
   * onProgress — periodic updates while playing; drives the seek bar and clock.
   */
  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (isSeeking) {
        return;
      }
      setCurrentTime(data.currentTime);
      currentTimeRef.current = data.currentTime;
      setSeekSliderValue(data.currentTime);
    },
    [isSeeking],
  );

  /**
   * onBuffer — reports when the player is waiting for more data (stalls).
   */
  const handleBuffer = useCallback((data: OnBufferData) => {
    setIsBuffering(data.isBuffering);
  }, []);

  /**
   * onEnd — fired when playback reaches the end of the file.
   * When loop is on, native repeat restarts playback; keep UI in Playing state.
   */
  const handleEnd = useCallback(() => {
    if (loopEnabled) {
      setLoopCount(prev => prev + 1);
      setHasEnded(false);
      setIsBuffering(false);
      setIsContentPlaying(true);
      setPaused(false);
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setSeekSliderValue(0);
      return;
    }
    setHasEnded(true);
    setPaused(true);
    setIsBuffering(false);
    if (duration > 0) {
      currentTimeRef.current = duration;
      setCurrentTime(duration);
      setSeekSliderValue(duration);
    }
  }, [duration, loopEnabled]);

  /** Play / Pause — toggles paused and isContentPlaying for the custom player fork. */
  const togglePlayPause = useCallback(() => {
    if (hasEnded) {
      return;
    }
    if (paused) {
      setIsContentPlaying(true);
      setPaused(false);
    } else {
      setPaused(true);
    }
  }, [hasEnded, paused]);

  /** Replay — seek to start and resume after onEnd. */
  const handleReplay = useCallback(() => {
    setHasEnded(false);
    setIsContentPlaying(true);
    setPaused(false);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setSeekSliderValue(0);
    videoRef.current?.seek(0);
  }, []);

  /** Forward 10s — uses player.seek() on the ref. */
  const skipForward = useCallback(() => {
    const target = Math.min(currentTime + SEEK_STEP_SECONDS, duration || 0);
    setHasEnded(false);
    setSeekSliderValue(target);
    setCurrentTime(target);
    currentTimeRef.current = target;
    videoRef.current?.seek(target);
  }, [currentTime, duration]);

  /** Backward 10s — uses player.seek() on the ref. */
  const skipBackward = useCallback(() => {
    const target = Math.max(currentTime - SEEK_STEP_SECONDS, 0);
    setHasEnded(false);
    setSeekSliderValue(target);
    setCurrentTime(target);
    currentTimeRef.current = target;
    videoRef.current?.seek(target);
  }, [currentTime]);

  /** Mute / Unmute — toggles muted prop; restores previous volume when unmuting. */
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      if (!prev) {
        volumeBeforeMuteRef.current = volume > 0 ? volume : 1;
        return true;
      }
      setVolume(volumeBeforeMuteRef.current);
      return false;
    });
  }, [volume]);

  /** Volume slider — 0.0 to 1.0 mapped to react-native-video volume prop. */
  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    if (value > 0) {
      setMuted(false);
      volumeBeforeMuteRef.current = value;
    } else {
      setMuted(true);
    }
  }, []);

  /** Progress seekbar — seek while dragging; commit on release. */
  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekChange = useCallback((value: number) => {
    setSeekSliderValue(value);
  }, []);

  const handleSeekComplete = useCallback((value: number) => {
    setIsSeeking(false);
    setHasEnded(false);
    setSeekSliderValue(value);
    setCurrentTime(value);
    currentTimeRef.current = value;
    videoRef.current?.seek(value);
  }, []);

  /** Loop — toggles react-native-video repeat; resets loop counter when enabled. */
  const toggleLoop = useCallback(() => {
    setLoopEnabled(prev => {
      const next = !prev;
      if (next) {
        setLoopCount(0);
        if (hasEnded) {
          setHasEnded(false);
          setIsContentPlaying(true);
          setPaused(false);
          currentTimeRef.current = 0;
          setCurrentTime(0);
          setSeekSliderValue(0);
          videoRef.current?.seek(0);
        }
      }
      return next;
    });
  }, [hasEnded]);

  /** Fullscreen — native fullscreen via VideoRef (iOS & Android). */
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      videoRef.current?.dismissFullscreenPlayer();
    } else {
      videoRef.current?.presentFullscreenPlayer();
    }
  }, [isFullscreen]);

  const showReplay = hasEnded && !loopEnabled;
  const maxSeek = duration > 0 ? duration : 1;

  const isTextTrackOff =
    selectedTextTrack.type === SelectedTrackType.DISABLED;

  return (
    <View style={styles.container}>
      <View style={[styles.videoWrapper, videoLayoutStyle]}>
        <Video
          key={`${subtitlePresetId}-${activeVideoUri}`}
          ref={videoRef}
          source={videoSource}
          style={videoLayoutStyle}
          resizeMode="contain"
          paused={paused}
          isContentPlaying={isContentPlaying}
          muted={muted}
          volume={volume}
          fullscreen={isFullscreen}
          repeat={loopEnabled}
          rate={playbackRate}
          selectedTextTrack={selectedTextTrack}
          subtitleStyle={{
            fontSize: subtitleFontSize,
            opacity: subtitleOpacity,
            paddingBottom: 8,
          }}
          controls={false}
          playInBackground={false}
          playWhenInactive={false}
          useTextureView={Platform.OS === 'android'}
          progressUpdateInterval={250}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onEnd={handleEnd}
          onTextTracks={handleTextTracks}
          onFullscreenPlayerDidPresent={() => setIsFullscreen(true)}
          onFullscreenPlayerDidDismiss={() => setIsFullscreen(false)}
        />

        {/* Loading indicator while buffering */}
        {isBuffering && (
          <View style={styles.bufferOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.bufferText}>Buffering…</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controlsScrollContent}
        showsVerticalScrollIndicator={false}>
      {/* Playback state label */}
      <Text style={styles.stateLabel}>State: {playbackState}</Text>

      {/* Current time / total duration */}
      <Text style={styles.timeText}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </Text>

      {/* Video progress seekbar */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Progress</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={maxSeek}
          value={seekSliderValue}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#1d4ed8"
          disabled={duration <= 0}
          onSlidingStart={handleSeekStart}
          onValueChange={handleSeekChange}
          onSlidingComplete={handleSeekComplete}
        />
      </View>

      {/* Transport controls */}
      <View style={styles.controlsRow}>
        <Pressable style={styles.button} onPress={skipBackward}>
          <Text style={styles.buttonText}>-10s</Text>
        </Pressable>

        {showReplay ? (
          <Pressable style={styles.buttonPrimary} onPress={handleReplay}>
            <Text style={styles.buttonPrimaryText}>Replay</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.buttonPrimary} onPress={togglePlayPause}>
            <Text style={styles.buttonPrimaryText}>
              {paused ? 'Play' : 'Pause'}
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.button} onPress={skipForward}>
          <Text style={styles.buttonText}>+10s</Text>
        </Pressable>
      </View>

      {/* Playback rate (TC-PB-012) */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Rate</Text>
      </View>
      <View style={styles.controlsRow}>
        {PLAYBACK_RATES.map(rate => (
          <Pressable
            key={rate}
            style={[
              styles.rateButton,
              playbackRate === rate && styles.buttonActive,
            ]}
            onPress={() => setPlaybackRate(rate)}>
            <Text style={styles.buttonText}>{rate}x</Text>
          </Pressable>
        ))}
      </View>

      {/* Loop toggle (TC-PB-013) */}
      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.button, loopEnabled && styles.buttonActive]}
          onPress={toggleLoop}>
          <Text style={styles.buttonText}>
            Loop: {loopEnabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        {loopEnabled && (
          <Text style={styles.loopCountText}>Loops: {loopCount}</Text>
        )}
      </View>

      {/* Mute and volume */}
      <View style={styles.controlsRow}>
        <Pressable style={styles.button} onPress={toggleMute}>
          <Text style={styles.buttonText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <View style={styles.volumeSliderWrap}>
          <Text style={styles.sliderLabel}>Vol</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={muted ? 0 : volume}
            minimumTrackTintColor="#22c55e"
            maximumTrackTintColor="#cbd5e1"
            thumbTintColor="#15803d"
            onValueChange={handleVolumeChange}
          />
          <Text style={styles.volumeValue}>
            {(muted ? 0 : volume).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Subtitle stream presets (ExoList) */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Sub stream (TC-SUB)</Text>
      </View>
      <View style={styles.presetWrap}>
        {SUBTITLE_PRESETS.map(preset => (
          <Pressable
            key={preset.id}
            style={[
              styles.presetButton,
              subtitlePresetId === preset.id && styles.buttonActive,
            ]}
            onPress={() => selectSubtitlePreset(preset.id)}>
            <Text style={styles.presetButtonText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      {activeSubtitlePreset.platforms === 'android' && Platform.OS === 'ios' && (
        <Text style={styles.hintText}>
          This preset is Android-only in ExoList; iOS may show no subtitles.
        </Text>
      )}

      {/* Subtitle track selection */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Subtitle track</Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.rateButton, isTextTrackOff && styles.buttonActive]}
          onPress={() => selectTextTrack('off')}>
          <Text style={styles.buttonText}>Off</Text>
        </Pressable>
        {availableTextTracks.map((track, index) => (
          <Pressable
            key={`${track.index ?? index}-${track.language ?? track.title}`}
            style={[
              styles.rateButton,
              selectedTextTrack.type === SelectedTrackType.INDEX &&
                selectedTextTrack.value === index &&
                styles.buttonActive,
            ]}
            onPress={() => selectTextTrack(index)}>
            <Text style={styles.presetButtonText} numberOfLines={1}>
              {formatTextTrackLabel(track, index)}
            </Text>
          </Pressable>
        ))}
      </View>
      {availableTextTracks.length === 0 && (
        <Text style={styles.hintText}>
          Play video to load tracks, or pick WebVTT / VTT EN+JA preset.
        </Text>
      )}

      {/* Subtitle style (TC-SUB-006) */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>
          Sub size: {Math.round(subtitleFontSize)}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={12}
          maximumValue={36}
          step={1}
          value={subtitleFontSize}
          minimumTrackTintColor="#a855f7"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#7c3aed"
          onValueChange={setSubtitleFontSize}
        />
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>
          Sub opacity: {subtitleOpacity.toFixed(2)}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0.2}
          maximumValue={1}
          step={0.05}
          value={subtitleOpacity}
          minimumTrackTintColor="#a855f7"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#7c3aed"
          onValueChange={setSubtitleOpacity}
        />
      </View>

      {/* Fullscreen toggle */}
      <Pressable style={styles.fullscreenButton} onPress={toggleFullscreen}>
        <Text style={styles.buttonText}>
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  controlsScroll: {
    flex: 1,
  },
  controlsScrollContent: {
    paddingBottom: 24,
  },
  videoWrapper: {
    alignSelf: 'center',
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bufferOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferText: {
    color: '#ffffff',
    marginTop: 8,
    fontSize: 14,
  },
  stateLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  sliderRow: {
    marginTop: 12,
  },
  sliderLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  buttonActive: {
    backgroundColor: '#14532d',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  rateButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    alignItems: 'center',
  },
  loopCountText: {
    color: '#94a3b8',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  presetButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '500',
  },
  hintText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  buttonPrimary: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  volumeSliderWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  volumeValue: {
    color: '#94a3b8',
    fontSize: 12,
    width: 36,
    textAlign: 'right',
  },
  fullscreenButton: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
});

export default SimpleVideoPlayer;
