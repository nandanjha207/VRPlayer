/**
 * Lightweight video player for testing playback controls and react-native-video behavior.
 * Uses functional components, hooks, and react-native-video v6 callbacks.
 */

import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Video, {
  type OnBufferData,
  type OnLoadData,
  type OnProgressData,
  type VideoRef,
} from 'react-native-video';

/** Public playback states shown in the UI. */
export type PlaybackState = 'Playing' | 'Paused' | 'Buffering' | 'Ended';


export const SAMPLE_MP4_URL =
  'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

const SEEK_STEP_SECONDS = 10;
const VIDEO_HORIZONTAL_PADDING = 32;
const VIDEO_ASPECT_RATIO = 16 / 9;

export type SimpleVideoPlayerProps = {
  /** Remote or local video URI. */
  sourceUri?: string;
};

/** Builds a react-native-video source object (adds type for HLS). */
function buildVideoSource(uri: string) {
  if (uri.toLowerCase().includes('.m3u8')) {
    return {uri, type: 'm3u8' as const};
  }
  return {uri};
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

  // Playback control
  const [paused, setPaused] = useState(true);
  /** Required by custom react-native-video: native play() only runs when this is true. */
  const [isContentPlaying, setIsContentPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  /**
   * onLoad — fired when the media is ready; provides duration and track metadata.
   */
  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setCurrentTime(data.currentTime);
    setSeekSliderValue(data.currentTime);
    setHasEnded(false);
    setIsBuffering(false);
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
   */
  const handleEnd = useCallback(() => {
    setHasEnded(true);
    setPaused(true);
    setIsBuffering(false);
    if (duration > 0) {
      setCurrentTime(duration);
      setSeekSliderValue(duration);
    }
  }, [duration]);

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
    videoRef.current?.seek(target);
  }, [currentTime, duration]);

  /** Backward 10s — uses player.seek() on the ref. */
  const skipBackward = useCallback(() => {
    const target = Math.max(currentTime - SEEK_STEP_SECONDS, 0);
    setHasEnded(false);
    setSeekSliderValue(target);
    setCurrentTime(target);
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
    videoRef.current?.seek(value);
  }, []);

  /** Fullscreen — native fullscreen via VideoRef (iOS & Android). */
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      videoRef.current?.dismissFullscreenPlayer();
    } else {
      videoRef.current?.presentFullscreenPlayer();
    }
  }, [isFullscreen]);

  const showReplay = hasEnded;
  const maxSeek = duration > 0 ? duration : 1;

  return (
    <View style={styles.container}>
      <View style={[styles.videoWrapper, videoLayoutStyle]}>
        <Video
          ref={videoRef}
          source={buildVideoSource(sourceUri)}
          style={videoLayoutStyle}
          resizeMode="contain"
          paused={paused}
          isContentPlaying={isContentPlaying}
          muted={muted}
          volume={volume}
          fullscreen={isFullscreen}
          controls={false}
          playInBackground={false}
          playWhenInactive={false}
          useTextureView={Platform.OS === 'android'}
          progressUpdateInterval={250}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onEnd={handleEnd}
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

      {/* Fullscreen toggle */}
      <Pressable style={styles.fullscreenButton} onPress={toggleFullscreen}>
        <Text style={styles.buttonText}>
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
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
