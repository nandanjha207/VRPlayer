/**
 * ExoList-driven catalog + cinema-style controls (DRM, ads, live badges, playlist).
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Modal,
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
  DRMType,
  SelectedTrackType,
  type Drm,
  type OnBufferData,
  type OnLoadData,
  type OnProgressData,
  type OnTextTracksData,
  type OnVideoErrorData,
  type ReactVideoSource,
  type SelectedTrack,
  type TextTracks,
  type VideoRef,
} from 'react-native-video';
import {CURATED_PLAYLIST} from './curatedPlaylist';
import {type CatalogStreamItem} from './exoListParser';
import {
  inferManifestKind,
  loadManifestVideoRenditions,
  type ManifestVideoRendition,
} from './manifestQualities';
import {PlaylistThumbnail} from './PlaylistThumbnail';
import {
  SUBTITLE_PRESETS,
  resolveSubtitlePresetUri,
} from './subtitlePresets';
import {VideoPlayer} from './videoFork';

const SEEK_STEP_SECONDS = 10;
const VIDEO_HORIZONTAL_PADDING = 24;
const VIDEO_ASPECT_RATIO = 16 / 9;
const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;
const OVERLAY_HIDE_MS = 4500;

function inferVideoType(uri: string): string | undefined {
  const lower = uri.toLowerCase();
  if (lower.includes('.m3u8')) {
    return 'm3u8';
  }
  if (lower.includes('.mpd')) {
    return 'mpd';
  }
  if (lower.includes('.mkv')) {
    return 'mkv';
  }
  if (lower.includes('.ism/') || lower.endsWith('.ism')) {
    return 'ism';
  }
  return undefined;
}

function buildDrmConfig(item: CatalogStreamItem): Drm | undefined {
  if (!item.drmScheme) {
    return undefined;
  }
  const scheme = item.drmScheme.toLowerCase();

  if (scheme === 'fairplay') {
    const licenseServer = item.drmLicenseUri;
    const certificateUrl = item.fairPlayCertificateUrl;
    const customData = item.fairPlayCustomData;
    if (!licenseServer || !certificateUrl) {
      return undefined;
    }
    return {
      type: DRMType.FAIRPLAY,
      licenseServer,
      certificateUrl,
      contentId: item.fairPlayContentId,
      ...(customData
        ? {
            getLicense: (
              spcBase64: string,
              contentId: string,
              licenseUrl: string,
            ) =>
              fetch(licenseUrl || licenseServer, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  customdata: customData,
                },
                body: `spc=${encodeURIComponent(spcBase64)}&assetId=${encodeURIComponent(contentId)}`,
              }).then(response => {
                if (!response.ok) {
                  throw new Error(
                    `KeyOS license HTTP ${response.status}: ${response.statusText}`,
                  );
                }
                return response.text();
              }),
          }
        : {}),
    };
  }

  if (!item.drmLicenseUri) {
    return undefined;
  }

  if (scheme === 'widevine') {
    return {
      type: DRMType.WIDEVINE,
      licenseServer: item.drmLicenseUri,
    };
  }
  if (scheme === 'playready') {
    return {
      type: DRMType.PLAYREADY,
      licenseServer: item.drmLicenseUri,
    };
  }
  if (scheme === 'clearkey') {
    return {
      type: DRMType.CLEARKEY,
      licenseServer: item.drmLicenseUri,
    };
  }
  return undefined;
}

function buildCatalogSource(
  item: CatalogStreamItem,
  videoUri: string,
  sidecarTextTracks?: TextTracks,
): ReactVideoSource {
  const type = inferVideoType(videoUri);
  const drm = buildDrmConfig(item);
  const ad = item.adTagUri ? {adTagUrl: item.adTagUri} : undefined;

  return {
    uri: videoUri,
    ...(type ? {type} : {}),
    ...(drm ? {drm} : {}),
    ...(ad ? {ad} : {}),
    ...(item.headers ? {headers: item.headers} : {}),
    ...(sidecarTextTracks?.length ? {textTracks: sidecarTextTracks} : {}),
  };
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

function formatTextTrackLabel(
  track: OnLoadData['textTracks'][number],
  index: number,
): string {
  const parts = [track.language, track.title].filter(Boolean);
  return parts.length > 0 ? parts.join(' – ') : `Track ${index}`;
}

function formatAudioTrackLabel(
  track: OnLoadData['audioTracks'][number],
  index: number,
): string {
  const parts = [track.language, track.title].filter(Boolean);
  return parts.length > 0 ? parts.join(' – ') : `Audio ${index}`;
}

function tagLabel(tag: string): string {
  switch (tag) {
    case 'drm':
      return 'DRM';
    case 'live':
      return 'LIVE';
    case 'dai':
      return 'DAI';
    case 'ads':
      return 'ADS';
    case 'clear':
      return 'CLEAR';
    default:
      return tag.toUpperCase();
  }
}

function tagChipStyle(tag: string) {
  switch (tag) {
    case 'drm':
      return styles.chipDrm;
    case 'live':
    case 'dai':
      return styles.chipLive;
    case 'ads':
      return styles.chipAds;
    default:
      return styles.chipClear;
  }
}

export function MediaCatalogPlayer() {
  const {width: windowWidth} = useWindowDimensions();
  const videoWidth = Math.max(0, windowWidth - VIDEO_HORIZONTAL_PADDING);
  const videoHeight = videoWidth / VIDEO_ASPECT_RATIO;
  const videoLayoutStyle = {width: videoWidth, height: videoHeight};

  const catalogItems = useMemo(() => CURATED_PLAYLIST, []);

  const defaultItem = useMemo(() => {
    return catalogItems.find(i => i.playable) ?? catalogItems[0];
  }, [catalogItems]);

  const [selectedId, setSelectedId] = useState(defaultItem?.id ?? '');
  const selectedItem = useMemo(
    () => catalogItems.find(i => i.id === selectedId) ?? defaultItem,
    [catalogItems, selectedId, defaultItem],
  );

  const videoRef = useRef<VideoRef>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  /** Blocks onProgress from overwriting the slider until seek settles. */
  const isSeekingRef = useRef(false);
  const seekTargetRef = useRef<number | null>(null);
  const seekReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resumeSeekAfterQualityRef = useRef<number | null>(null);
  const wasPlayingBeforeBackgroundRef = useRef(false);
  const playbackSnapshotRef = useRef({
    paused: true,
    isContentPlaying: false,
    hasEnded: false,
  });
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [paused, setPaused] = useState(true);
  const [isContentPlaying, setIsContentPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipHint, setSkipHint] = useState<'back' | 'fwd' | null>(null);

  const [subtitlePresetId, setSubtitlePresetId] = useState('main');
  const [availableTextTracks, setAvailableTextTracks] = useState<
    OnLoadData['textTracks']
  >([]);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<
    OnLoadData['audioTracks']
  >([]);
  const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack>(
    {type: SelectedTrackType.DISABLED},
  );
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack>({
    type: SelectedTrackType.SYSTEM,
  });
  /** Video renditions parsed from HLS/DASH manifest; empty if N/A or loading. */
  const [manifestRenditions, setManifestRenditions] = useState<
    ManifestVideoRendition[]
  >([]);
  /** null = Auto (adaptive master); otherwise ManifestVideoRendition.id */
  const [selectedQualityRenditionId, setSelectedQualityRenditionId] = useState<
    string | null
  >(null);
  const [subtitleFontSize, setSubtitleFontSize] = useState(16);
  const [subtitleOpacity, setSubtitleOpacity] = useState(1);

  const subtitleVideoStyle = useMemo(
    () => ({
      fontSize: subtitleFontSize,
      opacity: subtitleOpacity,
      paddingBottom: 10,
    }),
    [subtitleFontSize, subtitleOpacity],
  );
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekSliderValue, setSeekSliderValue] = useState(0);

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const volumeBeforeMuteRef = useRef(1);

  const [modal, setModal] = useState<
    'none' | 'settings' | 'speed' | 'quality' | 'textAudio'
  >('none');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    const row = catalogItems.find(i => i.id === selectedId);
    if (!row?.playable) {
      setManifestRenditions([]);
      setSelectedQualityRenditionId(null);
      return;
    }
    const preset =
      SUBTITLE_PRESETS.find(p => p.id === subtitlePresetId) ??
      SUBTITLE_PRESETS[0];
    const resolvedUri = resolveSubtitlePresetUri(preset, row.uri);
    if (!inferManifestKind(resolvedUri)) {
      setManifestRenditions([]);
      setSelectedQualityRenditionId(null);
      return;
    }
    const ac = new AbortController();
    loadManifestVideoRenditions(resolvedUri, row.headers, ac.signal)
      .then(list => {
        if (ac.signal.aborted) {
          return;
        }
        setManifestRenditions(list);
        setSelectedQualityRenditionId(null);
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setManifestRenditions([]);
        }
      });
    return () => ac.abort();
  }, [catalogItems, selectedId, subtitlePresetId]);

  useEffect(() => {
    if (modal === 'quality' && manifestRenditions.length <= 1) {
      setModal('none');
    }
  }, [modal, manifestRenditions.length]);

  const activeSubtitlePreset =
    SUBTITLE_PRESETS.find(p => p.id === subtitlePresetId) ??
    SUBTITLE_PRESETS[0];
  const playbackUri = useMemo(() => {
    if (!selectedItem) {
      return '';
    }
    const baseUri = resolveSubtitlePresetUri(
      activeSubtitlePreset,
      selectedItem.uri,
    );
    if (
      !selectedQualityRenditionId ||
      manifestRenditions.length <= 1
    ) {
      return baseUri;
    }
    const picked = manifestRenditions.find(
      r => r.id === selectedQualityRenditionId,
    );
    return picked?.uri ?? baseUri;
  }, [
    selectedItem,
    selectedQualityRenditionId,
    manifestRenditions,
    activeSubtitlePreset,
  ]);
  const videoSource = useMemo(() => {
    if (!selectedItem?.playable || !playbackUri) {
      return undefined;
    }
    return buildCatalogSource(
      selectedItem,
      playbackUri,
      activeSubtitlePreset.textTracks,
    );
  }, [selectedItem, playbackUri, activeSubtitlePreset.textTracks]);

  const releaseSeekLock = useCallback(() => {
    if (seekReleaseTimerRef.current) {
      clearTimeout(seekReleaseTimerRef.current);
      seekReleaseTimerRef.current = null;
    }
    isSeekingRef.current = false;
    seekTargetRef.current = null;
  }, []);

  const resetPlaybackForStreamChange = useCallback(() => {
    releaseSeekLock();
    setPaused(true);
    setIsContentPlaying(false);
    setHasEnded(false);
    setIsBuffering(false);
    setDuration(0);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setSeekSliderValue(0);
    setAvailableTextTracks([]);
    setAvailableAudioTracks([]);
    setManifestRenditions([]);
    setSelectedQualityRenditionId(null);
    resumeSeekAfterQualityRef.current = null;
    setSelectedTextTrack({type: SelectedTrackType.DISABLED});
    setSelectedAudioTrack({type: SelectedTrackType.SYSTEM});
    setLastError(null);
  }, [releaseSeekLock]);

  const scheduleHideOverlay = useCallback(() => {
    if (hideOverlayTimerRef.current) {
      clearTimeout(hideOverlayTimerRef.current);
    }
    hideOverlayTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
      hideOverlayTimerRef.current = null;
    }, OVERLAY_HIDE_MS);
  }, []);

  const showOverlay = useCallback(() => {
    setControlsVisible(true);
    scheduleHideOverlay();
  }, [scheduleHideOverlay]);

  useEffect(() => {
    showOverlay();
    return () => {
      if (hideOverlayTimerRef.current) {
        clearTimeout(hideOverlayTimerRef.current);
      }
    };
  }, [selectedId, showOverlay]);

  useEffect(() => {
    playbackSnapshotRef.current = {paused, isContentPlaying, hasEnded};
  }, [paused, isContentPlaying, hasEnded]);

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
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [resumePlaybackAfterForeground]);

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
    if (data.audioTracks?.length) {
      setAvailableAudioTracks(data.audioTracks);
    }
    const resumeAt = resumeSeekAfterQualityRef.current;
    if (resumeAt !== null && resumeAt > 0) {
      resumeSeekAfterQualityRef.current = null;
      setTimeout(() => {
        videoRef.current?.seek(resumeAt);
        currentTimeRef.current = resumeAt;
        setCurrentTime(resumeAt);
        setSeekSliderValue(resumeAt);
      }, 0);
    }
  }, []);

  const handleTextTracks = useCallback((data: OnTextTracksData) => {
    if (data.textTracks?.length) {
      setAvailableTextTracks(data.textTracks as OnLoadData['textTracks']);
    }
  }, []);

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (isSeekingRef.current) {
        const target = seekTargetRef.current;
        if (
          target !== null &&
          Math.abs(data.currentTime - target) < 1.5
        ) {
          releaseSeekLock();
        } else {
          return;
        }
      }
      setCurrentTime(data.currentTime);
      currentTimeRef.current = data.currentTime;
      setSeekSliderValue(data.currentTime);
    },
    [releaseSeekLock],
  );

  const handleBuffer = useCallback((data: OnBufferData) => {
    setIsBuffering(data.isBuffering);
  }, []);

  const handleError = useCallback((e: OnVideoErrorData) => {
    const msg =
      typeof e.error === 'string'
        ? e.error
        : (e.error as {localizedDescription?: string})?.localizedDescription ??
          JSON.stringify(e.error ?? e);
    setLastError(msg);
    setIsBuffering(false);
  }, []);

  const handleEnd = useCallback(() => {
    if (loopEnabled) {
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
    const d = durationRef.current;
    if (d > 0) {
      currentTimeRef.current = d;
      setCurrentTime(d);
      setSeekSliderValue(d);
    }
  }, [loopEnabled]);

  const togglePlayPause = useCallback(() => {
    if (!selectedItem?.playable || hasEnded) {
      return;
    }
    if (paused) {
      setIsContentPlaying(true);
      setPaused(false);
    } else {
      setPaused(true);
    }
    showOverlay();
  }, [hasEnded, paused, selectedItem?.playable, showOverlay]);

  const commitSeek = useCallback(
    (target: number) => {
      setHasEnded(false);
      setSeekSliderValue(target);
      setCurrentTime(target);
      currentTimeRef.current = target;
      isSeekingRef.current = true;
      seekTargetRef.current = target;
      if (seekReleaseTimerRef.current) {
        clearTimeout(seekReleaseTimerRef.current);
      }
      seekReleaseTimerRef.current = setTimeout(() => {
        releaseSeekLock();
      }, 2500);
      videoRef.current?.seek(target);
    },
    [releaseSeekLock],
  );

  const handleReplay = useCallback(() => {
    setIsContentPlaying(true);
    setPaused(false);
    commitSeek(0);
    showOverlay();
  }, [commitSeek, showOverlay]);

  const skipForward = useCallback(() => {
    const d = durationRef.current;
    if (!d) {
      return;
    }
    const target = Math.min(currentTimeRef.current + SEEK_STEP_SECONDS, d);
    commitSeek(target);
    setSkipHint('fwd');
    setTimeout(() => setSkipHint(null), 600);
    showOverlay();
  }, [commitSeek, showOverlay]);

  const skipBackward = useCallback(() => {
    const target = Math.max(currentTimeRef.current - SEEK_STEP_SECONDS, 0);
    commitSeek(target);
    setSkipHint('back');
    setTimeout(() => setSkipHint(null), 600);
    showOverlay();
  }, [commitSeek, showOverlay]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      if (!prev) {
        volumeBeforeMuteRef.current = volume > 0 ? volume : 1;
        return true;
      }
      setVolume(volumeBeforeMuteRef.current);
      return false;
    });
    showOverlay();
  }, [volume, showOverlay]);

  const handleVolumeChange = useCallback(
    (value: number) => {
      setVolume(value);
      if (value > 0) {
        setMuted(false);
        volumeBeforeMuteRef.current = value;
      } else {
        setMuted(true);
      }
    },
    [],
  );

  const handleSeekStart = useCallback(() => {
    isSeekingRef.current = true;
    seekTargetRef.current = null;
  }, []);

  const handleSeekChange = useCallback((value: number) => {
    setSeekSliderValue(value);
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback(
    (value: number) => {
      commitSeek(value);
      showOverlay();
    },
    [commitSeek, showOverlay],
  );

  const toggleLoop = useCallback(() => {
    setLoopEnabled(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      videoRef.current?.dismissFullscreenPlayer();
    } else {
      videoRef.current?.presentFullscreenPlayer();
    }
    showOverlay();
  }, [isFullscreen, showOverlay]);

  const selectCatalogItem = useCallback((item: CatalogStreamItem) => {
    setSelectedId(item.id);
    setSubtitlePresetId('main');
    resetPlaybackForStreamChange();
  }, [resetPlaybackForStreamChange]);

  const selectSubtitlePreset = useCallback(
    (presetId: string) => {
      setSubtitlePresetId(presetId);
      resetPlaybackForStreamChange();
    },
    [resetPlaybackForStreamChange],
  );

  const selectTextTrack = useCallback((index: number | 'off') => {
    if (index === 'off') {
      setSelectedTextTrack({type: SelectedTrackType.DISABLED});
      return;
    }
    setSelectedTextTrack({type: SelectedTrackType.INDEX, value: index});
  }, []);

  const selectAudioTrack = useCallback((index: number) => {
    setSelectedAudioTrack({type: SelectedTrackType.INDEX, value: index});
  }, []);

  const showQualityControl = manifestRenditions.length > 1;

  const selectQualityRendition = useCallback((renditionId: 'auto' | string) => {
    resumeSeekAfterQualityRef.current = currentTimeRef.current;
    setSelectedQualityRenditionId(
      renditionId === 'auto' ? null : renditionId,
    );
    setModal('none');
  }, []);

  const maxSeek = duration > 0 ? duration : 1;
  const showReplay = hasEnded && !loopEnabled;
  const isTextOff = selectedTextTrack.type === SelectedTrackType.DISABLED;
  const isLiveLayout =
    selectedItem?.tags.includes('live') || selectedItem?.tags.includes('dai');

  const renderPlaylistRow = useCallback(
    ({item}: {item: CatalogStreamItem}) => {
      const active = item.id === selectedId;
      return (
        <Pressable
          style={[styles.listRow, active && styles.listRowActive]}
          onPress={() => selectCatalogItem(item)}>
          <PlaylistThumbnail item={item} />
          <View style={styles.listRowMain}>
            <Text style={styles.listTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.listCategory} numberOfLines={1}>
              {item.category}
            </Text>
            <View style={styles.chipRow}>
              {item.tags.map(t => (
                <View key={t} style={[styles.chip, tagChipStyle(t)]}>
                  <Text style={styles.chipText}>{tagLabel(t)}</Text>
                </View>
              ))}
              {!item.playable && (
                <View style={[styles.chip, styles.chipBlocked]}>
                  <Text style={styles.chipText}>N/A</Text>
                </View>
              )}
            </View>
            {item.unsupportedHint && !item.playable ? (
              <Text style={styles.listHint} numberOfLines={2}>
                {item.unsupportedHint}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.listChevron, styles.listChevronAlign]}>
            {active ? '●' : '›'}
          </Text>
        </Pressable>
      );
    },
    [selectedId, selectCatalogItem],
  );

  const videoKey = selectedItem
    ? `${selectedId}-${subtitlePresetId}-${playbackUri}-${
        selectedItem.drmLicenseUri ?? 'clear'
      }`
    : 'empty';

  return (
    <View style={styles.root}>
      <Pressable
        style={[styles.videoStage, videoLayoutStyle]}
        onPress={() => {
          if (controlsVisible) {
            setControlsVisible(false);
            if (hideOverlayTimerRef.current) {
              clearTimeout(hideOverlayTimerRef.current);
            }
          } else {
            showOverlay();
          }
        }}>
        {selectedItem?.playable && videoSource ? (
          <View style={styles.videoClip}>
            <VideoPlayer
              key={videoKey}
              ref={videoRef}
              source={videoSource}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              paused={paused}
              isContentPlaying={isContentPlaying}
              muted={muted}
              volume={volume}
              fullscreen={isFullscreen}
              repeat={loopEnabled}
              rate={playbackRate}
              selectedTextTrack={selectedTextTrack}
              selectedAudioTrack={selectedAudioTrack}
              subtitleStyle={subtitleVideoStyle}
              controls={false}
              playInBackground={false}
              playWhenInactive={false}
              useTextureView={false}
              progressUpdateInterval={250}
              onLoad={handleLoad}
              onProgress={handleProgress}
              onBuffer={handleBuffer}
              onEnd={handleEnd}
              onError={handleError}
              onTextTracks={handleTextTracks}
              onFullscreenPlayerDidPresent={() => setIsFullscreen(true)}
              onFullscreenPlayerDidDismiss={() => setIsFullscreen(false)}
            />
          </View>
        ) : (
          <View style={[styles.placeholder, StyleSheet.absoluteFill]}>
            <Text style={styles.placeholderTitle}>No preview</Text>
            <Text style={styles.placeholderBody}>
              {selectedItem?.unsupportedHint ??
                'Pick a playable stream from the list.'}
            </Text>
          </View>
        )}

        {skipHint && (
          <View style={styles.skipBadge} pointerEvents="none">
            <Text style={styles.skipBadgeText}>
              {skipHint === 'back' ? '−10s' : '+10s'}
            </Text>
          </View>
        )}

        {isBuffering && selectedItem?.playable && (
          <View style={styles.bufferOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {controlsVisible && selectedItem?.playable && (
          <View style={styles.overlayRoot} pointerEvents="box-none">
            <View style={styles.overlayTop}>
              <Text style={styles.overlayTitle} numberOfLines={1}>
                {selectedItem.title}
              </Text>
              <View style={styles.overlayTopIcons}>
                <Pressable
                  style={styles.iconHit}
                  onPress={() => {
                    setModal('textAudio');
                    showOverlay();
                  }}>
                  <Text style={styles.iconGlyph}>🅢</Text>
                </Pressable>
                <Pressable
                  style={styles.iconHit}
                  onPress={() => {
                    setModal('speed');
                    showOverlay();
                  }}>
                  <Text style={styles.iconGlyph}>⏱</Text>
                </Pressable>
                {showQualityControl ? (
                  <Pressable
                    style={styles.iconHit}
                    onPress={() => {
                      setModal('quality');
                      showOverlay();
                    }}>
                    <Text style={styles.iconGlyph}>⚙</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {isLiveLayout && (
              <View style={styles.livePill} pointerEvents="none">
                <Text style={styles.liveDot}>●</Text>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}

            <View style={styles.overlayCenter}>
              <Pressable style={styles.roundBtn} onPress={skipBackward}>
                <Text style={styles.roundBtnGlyph}>⏪</Text>
                <Text style={styles.roundBtnCap}>10</Text>
              </Pressable>
              {showReplay ? (
                <Pressable style={styles.playMain} onPress={handleReplay}>
                  <Text style={styles.playMainGlyph}>↻</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.playMain} onPress={togglePlayPause}>
                  <Text style={styles.playMainGlyph}>
                    {paused ? '▶' : '⏸'}
                  </Text>
                </Pressable>
              )}
              <Pressable style={styles.roundBtn} onPress={skipForward}>
                <Text style={styles.roundBtnGlyph}>⏩</Text>
                <Text style={styles.roundBtnCap}>10</Text>
              </Pressable>
            </View>

            <View style={styles.overlayBottom}>
              <View style={styles.timeRow}>
                <Text style={styles.timeMono}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeMono}>{formatTime(duration)}</Text>
              </View>
              <Slider
                style={styles.seekSlider}
                minimumValue={0}
                maximumValue={maxSeek}
                value={seekSliderValue}
                minimumTrackTintColor="#f8fafc"
                maximumTrackTintColor="rgba(255,255,255,0.35)"
                thumbTintColor="#fff"
                disabled={duration <= 0}
                onSlidingStart={handleSeekStart}
                onValueChange={handleSeekChange}
                onSlidingComplete={handleSeekComplete}
              />
              <View style={styles.overlayBottomRow}>
                <Pressable style={styles.iconHit} onPress={toggleMute}>
                  <Text style={styles.iconGlyph}>{muted ? '🔇' : '🔊'}</Text>
                </Pressable>
                <View style={styles.flexOne} />
                <Pressable style={styles.iconHit} onPress={toggleFullscreen}>
                  <Text style={styles.iconGlyph}>⛶</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Pressable>

      {lastError ? (
        <Text style={styles.errorBanner} numberOfLines={3}>
          Error: {lastError}
        </Text>
      ) : null}

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeader}>Playlist (curated QA)</Text>
        <Pressable
          onPress={() => {
            setModal('settings');
            showOverlay();
          }}>
          <Text style={styles.listHeaderLink}>More settings</Text>
        </Pressable>
      </View>

      <FlatList
        data={catalogItems}
        keyExtractor={i => i.id}
        renderItem={renderPlaylistRow}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Settings */}
      <Modal
        visible={modal === 'settings'}
        animationType="slide"
        transparent
        onRequestClose={() => setModal('none')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal('none')}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <Pressable onPress={() => setModal('none')}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSection}>Subtitle sample (sidecar)</Text>
              <View style={styles.presetWrap}>
                {SUBTITLE_PRESETS.map(preset => (
                  <Pressable
                    key={preset.id}
                    style={[
                      styles.presetButton,
                      subtitlePresetId === preset.id && styles.presetActive,
                    ]}
                    onPress={() => selectSubtitlePreset(preset.id)}>
                    <Text style={styles.presetBtnText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
              {activeSubtitlePreset.platforms === 'android' &&
                Platform.OS === 'ios' && (
                  <Text style={styles.modalHint}>
                    MKV / TTML presets are Android-first in ExoList.
                  </Text>
                )}

              <Text style={styles.modalSection}>Subtitle size</Text>
              <Slider
                style={styles.modalSlider}
                minimumValue={12}
                maximumValue={28}
                step={1}
                value={subtitleFontSize}
                minimumTrackTintColor="#a855f7"
                maximumTrackTintColor="#475569"
                thumbTintColor="#c084fc"
                onValueChange={setSubtitleFontSize}
              />

              <Text style={styles.modalSection}>Subtitle opacity</Text>
              <Slider
                style={styles.modalSlider}
                minimumValue={0.2}
                maximumValue={1}
                step={0.05}
                value={subtitleOpacity}
                minimumTrackTintColor="#a855f7"
                maximumTrackTintColor="#475569"
                thumbTintColor="#c084fc"
                onValueChange={setSubtitleOpacity}
              />

              <Text style={styles.modalSection}>Loop</Text>
              <Pressable
                style={[styles.fullBtn, loopEnabled && styles.presetActive]}
                onPress={toggleLoop}>
                <Text style={styles.fullBtnText}>
                  Loop: {loopEnabled ? 'ON' : 'OFF'}
                </Text>
              </Pressable>

              <Text style={styles.modalSection}>Volume</Text>
              <Slider
                style={styles.modalSlider}
                minimumValue={0}
                maximumValue={1}
                step={0.02}
                value={muted ? 0 : volume}
                minimumTrackTintColor="#22c55e"
                maximumTrackTintColor="#475569"
                thumbTintColor="#4ade80"
                onValueChange={handleVolumeChange}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Speed */}
      <Modal
        visible={modal === 'speed'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal('none')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal('none')}>
          <Pressable style={styles.modalSheetSm} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Speed</Text>
            <View style={styles.speedGrid}>
              {PLAYBACK_RATES.map(rate => (
                <Pressable
                  key={rate}
                  style={[
                    styles.speedCell,
                    playbackRate === rate && styles.presetActive,
                  ]}
                  onPress={() => {
                    setPlaybackRate(rate);
                    setModal('none');
                  }}>
                  <Text style={styles.speedCellText}>{rate}×</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Quality */}
      <Modal
        visible={modal === 'quality'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal('none')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal('none')}>
          <Pressable style={styles.modalSheetSm} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Quality</Text>
            {manifestRenditions.length > 1 ? (
              <>
                <Pressable
                  style={styles.qualityRow}
                  onPress={() => selectQualityRendition('auto')}>
                  <Text style={styles.qualityText}>
                    Auto (ABR master)
                    {selectedQualityRenditionId === null ? ' ✓' : ''}
                  </Text>
                </Pressable>
                {manifestRenditions.map(r => (
                  <Pressable
                    key={r.id}
                    style={styles.qualityRow}
                    onPress={() => selectQualityRendition(r.id)}>
                    <Text style={styles.qualityText}>
                      {r.label}
                      {selectedQualityRenditionId === r.id ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.modalHint}>
                  Renditions are read from the HLS or DASH manifest. Manual
                  selection loads a fixed variant URL; Auto uses the master
                  manifest.
                </Text>
              </>
            ) : (
              <Text style={styles.modalHint}>
                This stream has a single video rendition or is not HLS/DASH, so
                there is no quality selector.
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Subtitles + Audio */}
      <Modal
        visible={modal === 'textAudio'}
        transparent
        animationType="slide"
        onRequestClose={() => setModal('none')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModal('none')}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Subtitles & Audio</Text>
              <Pressable onPress={() => setModal('none')}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.colTitle}>Subtitles</Text>
                <Pressable
                  style={[styles.trackRow, isTextOff && styles.trackRowOn]}
                  onPress={() => selectTextTrack('off')}>
                  <Text style={styles.trackRowText}>Off</Text>
                </Pressable>
                {availableTextTracks.map((track, index) => (
                  <Pressable
                    key={`st-${track.index ?? index}`}
                    style={[
                      styles.trackRow,
                      selectedTextTrack.type === SelectedTrackType.INDEX &&
                        selectedTextTrack.value === index &&
                        styles.trackRowOn,
                    ]}
                    onPress={() => selectTextTrack(index)}>
                    <Text style={styles.trackRowText} numberOfLines={2}>
                      {formatTextTrackLabel(track, index)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.col}>
                <Text style={styles.colTitle}>Audio</Text>
                {availableAudioTracks.map((track, index) => (
                  <Pressable
                    key={`at-${track.index ?? index}`}
                    style={[
                      styles.trackRow,
                      selectedAudioTrack.type === SelectedTrackType.INDEX &&
                        selectedAudioTrack.value === index &&
                        styles.trackRowOn,
                    ]}
                    onPress={() => selectAudioTrack(index)}>
                    <Text style={styles.trackRowText} numberOfLines={2}>
                      {formatAudioTrackLabel(track, index)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  videoStage: {
    alignSelf: 'center',
    marginTop: 8,
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
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
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
  overlayTopIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconHit: {
    padding: 8,
  },
  iconGlyph: {
    color: '#f8fafc',
    fontSize: 18,
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
  overlayCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  roundBtn: {
    alignItems: 'center',
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
  overlayBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
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
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(127,29,29,0.5)',
    color: '#fecaca',
    fontSize: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  listHeader: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  listHeaderLink: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  flatList: {flex: 1},
  flatListContent: {paddingBottom: 32, paddingHorizontal: 12},
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  listRowActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
  },
  listRowMain: {flex: 1, paddingRight: 8},
  listTitle: {color: '#f1f5f9', fontSize: 13, fontWeight: '600'},
  listCategory: {color: '#64748b', fontSize: 11, marginTop: 2},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6},
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: {fontSize: 10, fontWeight: '800', color: '#0f172a'},
  chipDrm: {backgroundColor: '#c4b5fd'},
  chipLive: {backgroundColor: '#fca5a5'},
  chipAds: {backgroundColor: '#fdba74'},
  chipClear: {backgroundColor: '#86efac'},
  chipBlocked: {backgroundColor: '#94a3b8'},
  listHint: {color: '#94a3b8', fontSize: 10, marginTop: 4, fontStyle: 'italic'},
  listChevron: {color: '#94a3b8', fontSize: 18, fontWeight: '700'},
  listChevronAlign: {alignSelf: 'center', marginTop: 14},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '78%',
  },
  modalSheetSm: {
    backgroundColor: '#0f172a',
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 14,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {color: '#f8fafc', fontSize: 17, fontWeight: '700'},
  modalClose: {color: '#94a3b8', fontSize: 20, padding: 4},
  modalSection: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHint: {color: '#64748b', fontSize: 12, marginTop: 8},
  presetWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  presetActive: {
    backgroundColor: '#14532d',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  presetBtnText: {color: '#f8fafc', fontSize: 12, fontWeight: '600'},
  fullBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  fullBtnText: {color: '#f8fafc', fontWeight: '600'},
  modalSlider: {width: '100%', height: 40},
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  speedCell: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  speedCellText: {color: '#f8fafc', fontWeight: '700'},
  qualityRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  qualityText: {color: '#e2e8f0', fontSize: 15},
  twoCol: {flexDirection: 'row', gap: 12},
  col: {flex: 1},
  colTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  trackRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    marginBottom: 8,
  },
  trackRowOn: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  trackRowText: {color: '#f8fafc', fontSize: 13},
  flexOne: {flex: 1},
});

export default MediaCatalogPlayer;
