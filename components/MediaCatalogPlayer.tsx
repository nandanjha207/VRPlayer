/**
 * ExoList-driven catalog + cinema-style controls (DRM, ads, live badges, playlist).
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
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
  SelectedVideoTrackType,
  type Drm,
  type OnAudioTracksData,
  type OnBufferData,
  type OnLoadData,
  type OnLoadStartData,
  type OnProgressData,
  type OnTextTracksData,
  type OnVideoErrorData,
  type ReactVideoSource,
  type SelectedTrack,
  type SelectedVideoTrack,
  type TextTracks,
  type OnGoogleCastEventData,
  type VideoRef,
  GoogleCastButton,
  CastEvent,
} from '@ttn/vr-rn-player-sdk';
import {CURATED_PLAYLIST} from './curatedPlaylist';
import {type CatalogStreamItem} from './exoListParser';
import {inferManifestKind} from './manifestQualities';
import {PlaylistThumbnail} from './PlaylistThumbnail';
import {ScrubStoryboardThumb} from './ScrubStoryboardThumb';
import {
  SUBTITLE_PRESETS,
  resolveSubtitlePresetUri,
} from './subtitlePresets';
import {
  findStoryboardCueAt,
  parseThumbnailStoryboardVtt,
  type ParsedStoryboardCue,
} from './thumbnailStoryboardVtt';
import {prepareVideoTracksForQualityUi} from './videoTrackQualityMenu';
import {AirPlayRoutePickerButton} from './AirPlayRoutePickerButton';
import {CastToast} from './CastToast';
import {checkIsCasting, clearCastMedia, presentCastDialog, subscribeVRCastSessionEvents} from './castNative';
import {castLog, castLogHelp, castLogNativeEvent} from './castDebugLog';
import {isCastFriendlySource} from './isCastFriendlySource';
import {drmConfigurationForContent} from './drm/drmConfigurationForContent';
import {buildKeyOSDrmConfigWithCallback} from './drm/keyosDrm';
import {VideoPlayer} from './videoFork';
import {StatsForNerdsOverlay} from './StatsForNerdsOverlay';
import {useStatsForNerds} from './useStatsForNerds';

const SEEK_STEP_SECONDS = 10;
const VIDEO_HORIZONTAL_PADDING = 24;
const VIDEO_ASPECT_RATIO = 16 / 9;
const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;
const OVERLAY_HIDE_MS = 4500;
const STATS_TAP_WINDOW_MS = 450;
/** Scrub tooltip: width used for horizontal clamping above the seek bar. */
const SCRUB_PREVIEW_WIDTH = 96;
const SCRUB_PREVIEW_HEIGHT = 54;

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

/**
 * When switching HLS quality, variant URLs often omit ".m3u8"; ExoPlayer must still
 * use the HLS pipeline or sniffing can load non-playlist bytes and throw ParserException.
 */
function inferCatalogPlaybackVideoType(
  playbackUri: string,
  catalogMasterUri: string,
): string | undefined {
  const kind = inferManifestKind(catalogMasterUri);
  if (kind === 'hls') {
    return 'm3u8';
  }
  return inferVideoType(playbackUri);
}

function buildDrmConfig(item: CatalogStreamItem): Drm | undefined {
  const fromDescriptor = drmConfigurationForContent(
    {description: item.description ?? item.title, drm: item.drm},
    item.fairPlayCustomData,
  );
  if (fromDescriptor) {
    return fromDescriptor;
  }

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
    if (customData) {
      return buildKeyOSDrmConfigWithCallback(customData);
    }
    return {
      type: DRMType.FAIRPLAY,
      licenseServer,
      certificateUrl,
      contentId: item.fairPlayContentId,
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
  catalogMasterUri: string,
  sidecarTextTracks?: TextTracks,
): ReactVideoSource {
  const type = inferCatalogPlaybackVideoType(videoUri, catalogMasterUri);
  const drm = buildDrmConfig(item);
  const ad = item.adTagUri ? {adTagUrl: item.adTagUri} : undefined;
  const isLive = item.tags.includes('live');

  return {
    uri: videoUri,
    ...(type ? {type} : {}),
    ...(isLive ? {isLive: true} : {}),
    ...(drm ? {drm} : {}),
    ...(ad ? {ad} : {}),
    ...(item.headers ? {headers: item.headers} : {}),
    ...(sidecarTextTracks?.length ? {textTracks: sidecarTextTracks} : {}),
    metadata: {
      title: item.title,
      ...(item.thumbnailUri ? {imageUri: item.thumbnailUri} : {}),
    },
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

type VideoTrackRow = OnLoadData['videoTracks'][number];

function formatVideoTrackLabel(track: VideoTrackRow, listIndex: number): string {
  const w = track.width;
  const h = track.height;
  const bw = track.bitrate;
  if (h && w) {
    return `${h}p (${w}×${h})`;
  }
  if (h) {
    return `${h}p`;
  }
  if (w) {
    return `${w}w`;
  }
  if (bw && bw >= 1_000_000) {
    return `${(bw / 1_000_000).toFixed(1)} Mbps`;
  }
  if (bw) {
    return `${Math.round(bw / 1000)} kbps`;
  }
  return `Quality ${listIndex + 1}`;
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

/** Chromecast receiver fetches the manifest directly — phone-only headers may not apply. */
function castReceiverWarning(item: CatalogStreamItem | undefined): string | null {
  if (!item) {
    return null;
  }
  if (item.headers && Object.keys(item.headers).length > 0) {
    return (
      'This stream uses custom HTTP headers on the phone. The TV receiver may still block it ' +
      '(CDN User-Agent / Referer). If TV stays on Connecting…, try a stream without headers.'
    );
  }
  if (item.uri.toLowerCase().includes('bipbop')) {
    return (
      'Apple BipBop multi-variant VOD may stall on VR Cast receiver 41A25E4F. ' +
      'Try Forstreet Live HLS, or play from the start before casting.'
    );
  }
  return null;
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
  const wasPlayingBeforeBackgroundRef = useRef(false);
  const playbackSnapshotRef = useRef({
    paused: true,
    isContentPlaying: false,
    hasEnded: false,
  });
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const statsTapCountRef = useRef(0);
  const statsTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  /** From ExoPlayer / AVPlayer after manifest is mapped (adaptive HLS/DASH). */
  const [availableVideoTracks, setAvailableVideoTracks] = useState<
    OnLoadData['videoTracks']
  >([]);
  const [castStatus, setCastStatus] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [castToastMessage, setCastToastMessage] = useState<string | null>(null);
  /** True after user presses Play; cleared only on stream reset — used for Cast autoplay. */
  const castPlayIntentRef = useRef(false);
  /** `auto` = ABR; otherwise native video track `index` for fixed quality. */
  const [videoQualitySelection, setVideoQualitySelection] = useState<
    'auto' | number
  >('auto');
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
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [seekTrackWidth, setSeekTrackWidth] = useState(0);
  const [scrubPosterLoadFailed, setScrubPosterLoadFailed] = useState(false);
  const [storyboardCues, setStoryboardCues] = useState<ParsedStoryboardCue[]>(
    [],
  );

  const [volume, setVolume] = useState(0.1);
  const [muted, setMuted] = useState(false);
  const volumeBeforeMuteRef = useRef(0.1);

  const [modal, setModal] = useState<
    'none' | 'settings' | 'speed' | 'quality' | 'textAudio'
  >('none');
  const [lastError, setLastError] = useState<string | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    setScrubPosterLoadFailed(false);
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!selectedItem) {
      setStoryboardCues([]);
      return;
    }
    const inline = selectedItem.thumbnailStoryboardVttText;
    const uri = selectedItem.thumbnailStoryboardVttUri;
    const streamLabel = `${selectedItem.id}: ${selectedItem.title}`;
    if (inline) {
      const cues = parseThumbnailStoryboardVtt(
        inline,
        uri ?? 'https://dash.akamaized.net/akamai/bbb_30fps/storyboard.vtt',
      );
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(
          '[storyboard] inline VTT parsed',
          streamLabel,
          'cues:',
          cues.length,
        );
      }
      setStoryboardCues(cues);
      return;
    }
    if (!uri) {
      setStoryboardCues([]);
      return;
    }
    const ac = new AbortController();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[storyboard] VTT fetch start', streamLabel, uri);
    }
    const fetchHeaders = selectedItem.headers;
    (async () => {
      try {
        const res = await fetch(uri, {
          ...(fetchHeaders ? {headers: fetchHeaders} : {}),
          signal: ac.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (ac.signal.aborted) {
          return;
        }
        const cues = parseThumbnailStoryboardVtt(text, res.url || uri);
        if (__DEV__) {
          const first = cues[0];
          // eslint-disable-next-line no-console
          console.log(
            '[storyboard] VTT fetch OK',
            streamLabel,
            uri,
            'cues:',
            cues.length,
            first
              ? `first image=${first.imageUri} region=${JSON.stringify(first.region)} spriteBounds=${JSON.stringify(first.spriteBounds)}`
              : '(no cues)',
          );
        }
        setStoryboardCues(cues);
      } catch (e) {
        if (!ac.signal.aborted) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[storyboard] VTT fetch failed', streamLabel, uri, e);
          }
          setStoryboardCues([]);
        }
      }
    })();
    return () => ac.abort();
  }, [
    selectedItem?.id,
    selectedItem?.title,
    selectedItem?.thumbnailStoryboardVttText,
    selectedItem?.thumbnailStoryboardVttUri,
    selectedItem?.headers,
  ]);

  useEffect(() => {
    if (videoQualitySelection === 'auto') {
      return;
    }
    const ok = availableVideoTracks.some(t => t.index === videoQualitySelection);
    if (!ok) {
      setVideoQualitySelection('auto');
    }
  }, [availableVideoTracks, videoQualitySelection]);

  useEffect(() => {
    if (modal === 'quality' && availableVideoTracks.length <= 1) {
      setModal('none');
    }
  }, [modal, availableVideoTracks.length]);

  const activeSubtitlePreset =
    SUBTITLE_PRESETS.find(p => p.id === subtitlePresetId) ??
    SUBTITLE_PRESETS[0];
  const playbackUri = useMemo(() => {
    if (!selectedItem) {
      return '';
    }
    return resolveSubtitlePresetUri(
      activeSubtitlePreset,
      selectedItem.uri,
    );
  }, [selectedItem, activeSubtitlePreset]);

  const selectedVideoTrackProp = useMemo((): SelectedVideoTrack => {
    if (videoQualitySelection === 'auto') {
      return {type: SelectedVideoTrackType.AUTO};
    }
    return {
      type: SelectedVideoTrackType.INDEX,
      value: videoQualitySelection,
    };
  }, [videoQualitySelection]);
  const videoSource = useMemo(() => {
    if (!selectedItem?.playable || !playbackUri) {
      return undefined;
    }
    const catalogMasterUri = resolveSubtitlePresetUri(
      activeSubtitlePreset,
      selectedItem.uri,
    );
    return buildCatalogSource(
      selectedItem,
      playbackUri,
      catalogMasterUri,
      activeSubtitlePreset.textTracks,
    );
  }, [selectedItem, playbackUri, activeSubtitlePreset]);

  // Keep Cast session across channel changes (SDK BasicExample pattern).
  // Supported → setSource → native Cast reloads TV.
  // Unsupported → clear TV media (do not leave last item playing) + no local Video.
  useEffect(() => {
    if (!videoSource) {
      return;
    }
    const castFriendly = isCastFriendlySource(videoSource);
    castLog('source change', {
      uri: typeof videoSource.uri === 'string' ? videoSource.uri : undefined,
      type: videoSource.type,
      castFriendly,
    });

    (async () => {
      const casting = await checkIsCasting();
      if (casting && !castFriendly) {
        castLog('unsupported while casting → clearCastMedia (keep session)');
        clearCastMedia();
        setPaused(true);
        setIsContentPlaying(false);
        castPlayIntentRef.current = false;
        setCastToastMessage("This video can't be cast to TV");
        return;
      }

      videoRef.current?.setSource(videoSource);
      if (casting && castFriendly) {
        // isContentPlaying drives Cast autoplay; keep paused=true so local
        // ExoPlayer does not resume (setPaused(false) while casting flips
        // native isPaused and wakes the phone surface after setSrc).
        setIsContentPlaying(true);
        setHasEnded(false);
        castPlayIntentRef.current = true;
      }
    })();
  }, [videoSource]);

  useEffect(() => {
    castLogHelp();
  }, []);

  const refreshCastingState = useCallback(async () => {
    try {
      const casting = await checkIsCasting();
      setIsCasting(casting);
    } catch {
      setIsCasting(false);
    }
  }, []);

  const {stats, videoCallbacks} = useStatsForNerds(videoSource);

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
    castPlayIntentRef.current = false;
    setHasEnded(false);
    setIsBuffering(false);
    setDuration(0);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setSeekSliderValue(0);
    setAvailableTextTracks([]);
    setAvailableAudioTracks([]);
    setAvailableVideoTracks([]);
    setVideoQualitySelection('auto');
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

  const handleStatsTripleTap = useCallback(() => {
    statsTapCountRef.current += 1;
    if (statsTapTimerRef.current) {
      clearTimeout(statsTapTimerRef.current);
    }
    statsTapTimerRef.current = setTimeout(() => {
      if (statsTapCountRef.current >= 3) {
        setStatsVisible(visible => !visible);
      }
      statsTapCountRef.current = 0;
      statsTapTimerRef.current = null;
    }, STATS_TAP_WINDOW_MS);
  }, []);

  useEffect(() => {
    showOverlay();
    return () => {
      if (hideOverlayTimerRef.current) {
        clearTimeout(hideOverlayTimerRef.current);
      }
      if (statsTapTimerRef.current) {
        clearTimeout(statsTapTimerRef.current);
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
      if (nextAppState === 'active') {
        refreshCastingState();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [resumePlaybackAfterForeground, refreshCastingState]);

  useEffect(() => {
    refreshCastingState();
  }, [refreshCastingState]);

  const handleLoad = useCallback(
    (data: OnLoadData) => {
      videoCallbacks.onLoad(data);
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
      if (data.videoTracks !== undefined) {
        if (data.videoTracks.length > 0) {
          setAvailableVideoTracks(
            prepareVideoTracksForQualityUi(data.videoTracks),
          );
        } else {
          setAvailableVideoTracks([]);
        }
      }
    },
    [videoCallbacks],
  );

  const handleLoadStart = useCallback(
    (data: OnLoadStartData) => {
      videoCallbacks.onLoadStart(data);
    },
    [videoCallbacks],
  );

  const handleAudioTracks = useCallback(
    (data: OnAudioTracksData) => {
      videoCallbacks.onAudioTracks(data);
      if (data.audioTracks?.length) {
        setAvailableAudioTracks(data.audioTracks);
      }
    },
    [videoCallbacks],
  );

  const handleTextTracks = useCallback(
    (data: OnTextTracksData) => {
      videoCallbacks.onTextTracks(data);
      if (data.textTracks?.length) {
        setAvailableTextTracks(data.textTracks as OnLoadData['textTracks']);
      }
    },
    [videoCallbacks],
  );

  const handleVideoTracks = useCallback(
    (data: {videoTracks: OnLoadData['videoTracks']}) => {
      videoCallbacks.onVideoTracks(data);
      if (data.videoTracks !== undefined) {
        if (data.videoTracks.length > 0) {
          setAvailableVideoTracks(
            prepareVideoTracksForQualityUi(data.videoTracks),
          );
        } else {
          setAvailableVideoTracks([]);
        }
      }
    },
    [videoCallbacks],
  );

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      videoCallbacks.onProgress(data);
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
    [releaseSeekLock, videoCallbacks],
  );

  const handleBuffer = useCallback(
    (data: OnBufferData) => {
      videoCallbacks.onBuffer(data);
      setIsBuffering(data.isBuffering);
    },
    [videoCallbacks],
  );

  const handleError = useCallback((e: OnVideoErrorData) => {
    const msg =
      typeof e.error === 'string'
        ? e.error
        : (e.error as {localizedDescription?: string})?.localizedDescription ??
          JSON.stringify(e.error ?? e);
    setLastError(msg);
    setIsBuffering(false);
  }, []);

  const syncCastReceiverPlayback = useCallback(() => {
    castLog('syncCastReceiverPlayback', {
      action: 'set isContentPlaying=true for TV handoff (keep paused for local)',
    });
    // VR fork / Cast load uses isContentPlaying (or !isPaused) for autoplay.
    // Do NOT setPaused(false) here — while casting that only flips native
    // isPaused and lets local ExoPlayer start after the next setSrc.
    setIsContentPlaying(true);
    setHasEnded(false);
    castPlayIntentRef.current = true;
  }, []);

  useEffect(() => {
    return subscribeVRCastSessionEvents(event => {
      castLog('VRCast session event', event);
      if (event.event === 'starting') {
        setCastStatus('connecting…');
        return;
      }
      if (event.event === 'started') {
        setIsCasting(true);
        setCastStatus('connected');
        // Do not setSource here — that restarts local playback on the phone.
        // SDK loads TV media + pauseLocalPlaybackForCast() on session start.
        syncCastReceiverPlayback();
        return;
      }
      if (event.event === 'start_failed') {
        setIsCasting(false);
        setCastStatus('failed');
        setCastToastMessage(
          `Cast failed to start (code ${event.errorCode ?? 'unknown'}). Retry Cast.`,
        );
        return;
      }
      if (event.event === 'ended') {
        setIsCasting(false);
        setCastStatus(null);
        setCastToastMessage(
          'Cast session ended. Tap Cast, then Play to watch on TV again.',
        );
      }
    });
  }, [syncCastReceiverPlayback]);

  const handleGoogleCastEvent = useCallback((e: OnGoogleCastEventData) => {
    castLogNativeEvent(e);
    const eventName = e.event ?? 'unknown';
    if (eventName === CastEvent.STARTED) {
      castLog('session STARTED — SDK loads TV media; not calling setSource');
      setIsCasting(true);
      syncCastReceiverPlayback();
      setCastStatus(eventName);
      return;
    }
    if (eventName === CastEvent.AVAILABLE) {
      castLog('cast device AVAILABLE on network');
      setCastStatus(eventName);
      return;
    }
    if (
      eventName === CastEvent.PLAY_STARTED ||
      eventName === CastEvent.BUFFERING
    ) {
      castLog(
        eventName === CastEvent.PLAY_STARTED
          ? 'receiver PLAY_STARTED — media playing on TV'
          : 'receiver BUFFERING',
      );
      setIsCasting(true);
      return;
    }
    if (eventName === CastEvent.STOPPED || eventName === CastEvent.IDLE) {
      castLog(
        eventName === CastEvent.STOPPED
          ? 'session STOPPED'
          : 'session IDLE (no active media on receiver)',
        {
          reason: typeof e.reason === 'string' ? e.reason : undefined,
          message: typeof e.message === 'string' ? e.message : undefined,
        },
      );
      setIsCasting(false);
      setCastStatus(null);
      const reason =
        typeof e.reason === 'string' ? e.reason : undefined;
      const message =
        typeof e.message === 'string' ? e.message : undefined;
      if (reason === 'session_ended') {
        setCastToastMessage(
          'Cast session ended. Tap Cast, then Play to watch on TV again.',
        );
      } else if (reason === 'error') {
        const sslHint =
          message?.toLowerCase().includes('ssl') ||
          message?.toLowerCase().includes('certificate');
        setCastToastMessage(
          sslHint
            ? 'Cast failed: SSL not trusted. Turn off VPN/proxy, check device date/time, then retry.'
            : 'Cast disconnected due to an error. Tap Cast to try again.',
        );
      }
      return;
    }
    if (eventName === CastEvent.ERROR) {
      castLog('session ERROR', {
        message: e.message ?? 'unknown',
      });
      setIsCasting(false);
      setCastStatus(e.message ?? 'Cast error');
      setCastToastMessage(e.message ?? 'Cast error. Tap Cast to try again.');
      return;
    }
    castLog(`unhandled cast event: ${eventName}`);
    setCastStatus(eventName);
  }, [syncCastReceiverPlayback]);

  const handleCastPress = useCallback(() => {
    castLog('cast icon pressed', {
      paused,
      isContentPlaying,
      isCasting,
      hasPlayIntent: castPlayIntentRef.current,
      note: isCasting
        ? 'will open Cast controller (volume + disconnect)'
        : 'will open device picker',
    });

    const receiverWarning = castReceiverWarning(selectedItem);
    if (receiverWarning) {
      castLog('cast receiver warning', receiverWarning);
      setCastToastMessage(receiverWarning);
    }

    // When already casting, presentCastDialog opens the controller (volume/stop).
    // When not casting, prime play intent then show the device picker.
    if (!isCasting) {
      if (paused) {
        castLog('auto-starting playback before cast handoff (was paused)');
      }
      syncCastReceiverPlayback();
    }
    presentCastDialog();
  }, [isCasting, isContentPlaying, paused, selectedItem, syncCastReceiverPlayback]);

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
      castPlayIntentRef.current = true;
      setIsContentPlaying(true);
      setPaused(false);
    } else {
      setPaused(true);
      castPlayIntentRef.current = false;
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
    castPlayIntentRef.current = true;
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
        volumeBeforeMuteRef.current = volume > 0 ? volume : 0.1;
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
    setIsScrubbing(true);
    showOverlay();
  }, [showOverlay]);

  const handleSeekChange = useCallback((value: number) => {
    setSeekSliderValue(value);
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback(
    (value: number) => {
      setIsScrubbing(false);
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

  const showQualityControl = availableVideoTracks.length > 1;

  const selectVideoQuality = useCallback((qv: 'auto' | number) => {
    const resumeAt = currentTimeRef.current;
    setVideoQualitySelection(qv);
    setModal('none');
    if (resumeAt > 0.05) {
      setTimeout(() => {
        videoRef.current?.seek(resumeAt);
        currentTimeRef.current = resumeAt;
        setCurrentTime(resumeAt);
        setSeekSliderValue(resumeAt);
      }, 120);
    }
  }, []);

  const maxSeek = duration > 0 ? duration : 1;
  const scrubStoryboardCue = useMemo(() => {
    if (!isScrubbing || duration <= 0 || storyboardCues.length === 0) {
      return null;
    }
    return findStoryboardCueAt(storyboardCues, seekSliderValue);
  }, [duration, isScrubbing, seekSliderValue, storyboardCues]);
  const scrubPreviewLeft = useMemo(() => {
    if (seekTrackWidth <= 0 || maxSeek <= 0) {
      return 0;
    }
    const ratio = seekSliderValue / maxSeek;
    const centerX = ratio * seekTrackWidth;
    const half = SCRUB_PREVIEW_WIDTH / 2;
    return Math.min(
      Math.max(0, centerX - half),
      Math.max(0, seekTrackWidth - SCRUB_PREVIEW_WIDTH),
    );
  }, [seekTrackWidth, maxSeek, seekSliderValue]);
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

  const hideLocalWhileCastUnsupported =
    isCasting &&
    !!videoSource &&
    !isCastFriendlySource(videoSource);

  return (
    <View style={styles.root}>
      <CastToast
        message={castToastMessage}
        onDismiss={() => setCastToastMessage(null)}
      />
      <View
        style={[styles.videoStage, videoLayoutStyle]}
        pointerEvents="box-none">
        {selectedItem?.playable && videoSource && !hideLocalWhileCastUnsupported ? (
          <View style={styles.videoClip} pointerEvents="none">
            <VideoPlayer
              // Stable instance — remounting on channel change drops Cast provider.
              // Channel switches go through setSource (SDK BasicExample pattern).
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
              selectedVideoTrack={selectedVideoTrackProp}
              subtitleStyle={subtitleVideoStyle}
              controls={false}
              allowsExternalPlayback={true}
              playInBackground={false}
              playWhenInactive={false}
              useTextureView={false}
              progressUpdateInterval={250}
              reportBandwidth={videoCallbacks.reportBandwidth}
              onLoadStart={handleLoadStart}
              onLoad={handleLoad}
              onProgress={handleProgress}
              onBuffer={handleBuffer}
              onPlaybackStateChanged={videoCallbacks.onPlaybackStateChanged}
              onBandwidthUpdate={videoCallbacks.onBandwidthUpdate}
              onExternalPlaybackChange={
                videoCallbacks.onExternalPlaybackChange
              }
              onEnd={handleEnd}
              onError={handleError}
              onAudioTracks={handleAudioTracks}
              onTextTracks={handleTextTracks}
              onTextTrackDataChanged={videoCallbacks.onTextTrackDataChanged}
              onVideoTracks={handleVideoTracks}
              onGoogleCastEvent={handleGoogleCastEvent}
              onFullscreenPlayerDidPresent={() => setIsFullscreen(true)}
              onFullscreenPlayerDidDismiss={() => setIsFullscreen(false)}
            />
            <StatsForNerdsOverlay visible={statsVisible} stats={stats} />
          </View>
        ) : (
          <View
            style={[styles.placeholder, StyleSheet.absoluteFill]}
            pointerEvents="none">
            <Text style={styles.placeholderTitle}>
              {hideLocalWhileCastUnsupported ? 'Not on TV' : 'No preview'}
            </Text>
            <Text style={styles.placeholderBody}>
              {hideLocalWhileCastUnsupported
                ? "This video can't be cast. TV media was cleared — pick a castable stream or stop casting to play on phone."
                : selectedItem?.unsupportedHint ??
                  'Pick a playable stream from the list.'}
            </Text>
          </View>
        )}

        {selectedItem?.playable && (
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
        )}

        {selectedItem?.playable && (
          <Pressable
            style={styles.statsTapZone}
            onPress={handleStatsTripleTap}
            accessibilityLabel="Stats for nerds toggle"
          />
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
            <View style={styles.overlayTop} pointerEvents="box-none">
              <Text
                style={styles.overlayTitle}
                pointerEvents="none"
                numberOfLines={1}>
                {selectedItem.title}
              </Text>
              <View style={styles.overlayTopIcons} pointerEvents="box-none">
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
                <Pressable
                  style={styles.iconHit}
                  accessibilityRole="button"
                  accessibilityLabel="Cast"
                  onPress={handleCastPress}>
                  <View pointerEvents="none">
                    <GoogleCastButton style={styles.castButton} />
                  </View>
                </Pressable>
                <View style={styles.iconHit}>
                  <AirPlayRoutePickerButton />
                </View>
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

            {castStatus ? (
              <View style={styles.castPill} pointerEvents="none">
                <Text style={styles.castPillText}>Cast: {castStatus}</Text>
              </View>
            ) : null}

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

            <View
              style={styles.overlayBottom}
              onLayout={e => setSeekTrackWidth(e.nativeEvent.layout.width)}>
              {isScrubbing && duration > 0 ? (
                <View
                  style={[
                    styles.scrubPreviewBubble,
                    {left: scrubPreviewLeft, width: SCRUB_PREVIEW_WIDTH},
                  ]}
                  pointerEvents="none">
                  {scrubStoryboardCue ? (
                    <ScrubStoryboardThumb
                      key={`scrub-img-${scrubStoryboardCue.imageUri}`}
                      imageUri={scrubStoryboardCue.imageUri}
                      region={scrubStoryboardCue.region}
                      boxWidth={SCRUB_PREVIEW_WIDTH}
                      boxHeight={SCRUB_PREVIEW_HEIGHT}
                      imageRequestHeaders={selectedItem?.headers}
                      spriteBounds={scrubStoryboardCue.spriteBounds}
                    />
                  ) : selectedItem?.thumbnailUri && !scrubPosterLoadFailed ? (
                    <Image
                      source={
                        selectedItem.headers &&
                        Object.keys(selectedItem.headers).length > 0
                          ? {
                              uri: selectedItem.thumbnailUri,
                              headers: selectedItem.headers,
                            }
                          : {uri: selectedItem.thumbnailUri}
                      }
                      style={styles.scrubPreviewImage}
                      resizeMode="cover"
                      onError={() => setScrubPosterLoadFailed(true)}
                    />
                  ) : (
                    <View style={styles.scrubPreviewPlaceholder}>
                      <Text style={styles.scrubPreviewPlaceholderGlyph}>▶</Text>
                    </View>
                  )}
                  <Text style={styles.scrubPreviewTime}>
                    {formatTime(seekSliderValue)}
                  </Text>
                </View>
              ) : null}
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
      </View>

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
            {availableVideoTracks.length > 1 ? (
              <>
                <Pressable
                  style={styles.qualityRow}
                  onPress={() => selectVideoQuality('auto')}>
                  <Text style={styles.qualityText}>
                    Auto (ABR)
                    {videoQualitySelection === 'auto' ? ' ✓' : ''}
                  </Text>
                </Pressable>
                {availableVideoTracks.map((track, listIndex) => (
                  <Pressable
                    key={`vt-${track.index ?? listIndex}`}
                    style={styles.qualityRow}
                    onPress={() => {
                      if (track.index !== undefined) {
                        selectVideoQuality(track.index);
                      }
                    }}>
                    <Text style={styles.qualityText}>
                      {formatVideoTrackLabel(track, listIndex)}
                      {videoQualitySelection === track.index ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.modalHint}>
                  Quality uses the native video tracks from the player (one master
                  URL). Works for adaptive HLS/DASH from any feed without
                  hard-coding rendition URLs.
                </Text>
              </>
            ) : (
              <Text style={styles.modalHint}>
                This stream exposes a single video track (or none yet). Try again
                after playback starts, or the asset may be progressive / non-ABR.
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
  overlayTapCatcher: {
    ...StyleSheet.absoluteFill,
  },
  statsTapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 72,
    height: 72,
    zIndex: 50,
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
  overlayTopIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconHit: {
    padding: 8,
  },
  castButton: {
    width: 28,
    height: 28,
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
  castPill: {
    position: 'absolute',
    right: 12,
    bottom: 108,
    backgroundColor: 'rgba(15,23,42,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.6)',
  },
  castPillText: {
    color: '#bfdbfe',
    fontWeight: '700',
    fontSize: 11,
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
    bottom: 100,
    zIndex: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  scrubPreviewImage: {
    width: '100%',
    height: SCRUB_PREVIEW_HEIGHT,
  },
  scrubPreviewPlaceholder: {
    width: '100%',
    height: SCRUB_PREVIEW_HEIGHT,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubPreviewPlaceholderGlyph: {
    color: '#64748b',
    fontSize: 22,
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
