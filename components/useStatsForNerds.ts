import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  DeviceEventEmitter,
  Dimensions,
  NativeModules,
  PixelRatio,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import type {
  OnAudioTracksData,
  OnBandwidthUpdateData,
  OnBufferData,
  OnExternalPlaybackChangeData,
  OnLoadData,
  OnLoadStartData,
  OnPlaybackStateChangedData,
  OnProgressData,
  OnTextTrackDataChangedData,
  OnTextTracksData,
  OnVideoTracksData,
  ReactVideoSource,
} from 'react-native-video';

export type StatsSource = 'SDK' | 'Device';

export type StatsRow = {
  label: string;
  value: string;
  source: StatsSource;
};

export type StatsSnapshot = {
  playbackRows: StatsRow[];
  deviceRows: StatsRow[];
};

const UNAVAILABLE = '—';
const PROGRESS_THROTTLE_MS = 500;
const LOG_PREFIX = '[StatsForNerds]';

type PlaybackFields = {
  playbackState: string;
  stream: string;
  resolution: string;
  videoCodec: string;
  audioCodec: string;
  currentBitrate: string;
  indicatedBitrate: string;
  bufferAhead: string;
  airPlay: string;
  externalPlayback: string;
  drm: string;
  audioLanguage: string;
  subtitle: string;
  network: string;
};

type DeviceFields = {
  hardwareId: string;
  deviceClass: string;
  deviceName: string;
  osVersion: string;
  osBuild: string;
  appInfo: string;
  architecture: string;
  ram: string;
  locale: string;
  systemLanguages: string;
  timeZone: string;
  thermalState: string;
  lowPowerMode: string;
  vendorId: string;
  screenResolution: string;
};

const INITIAL_PLAYBACK: PlaybackFields = {
  playbackState: UNAVAILABLE,
  stream: UNAVAILABLE,
  resolution: UNAVAILABLE,
  videoCodec: UNAVAILABLE,
  audioCodec: UNAVAILABLE,
  currentBitrate: UNAVAILABLE,
  indicatedBitrate: UNAVAILABLE,
  bufferAhead: UNAVAILABLE,
  airPlay: UNAVAILABLE,
  externalPlayback: UNAVAILABLE,
  drm: UNAVAILABLE,
  audioLanguage: UNAVAILABLE,
  subtitle: UNAVAILABLE,
  network: UNAVAILABLE,
};

const INITIAL_DEVICE: DeviceFields = {
  hardwareId: UNAVAILABLE,
  deviceClass: UNAVAILABLE,
  deviceName: UNAVAILABLE,
  osVersion: UNAVAILABLE,
  osBuild: UNAVAILABLE,
  appInfo: UNAVAILABLE,
  architecture: UNAVAILABLE,
  ram: UNAVAILABLE,
  locale: UNAVAILABLE,
  systemLanguages: UNAVAILABLE,
  timeZone: UNAVAILABLE,
  thermalState: UNAVAILABLE,
  lowPowerMode: UNAVAILABLE,
  vendorId: UNAVAILABLE,
  screenResolution: UNAVAILABLE,
};

function formatMbps(bitrateBps: number): string {
  if (!bitrateBps || bitrateBps <= 0) {
    return UNAVAILABLE;
  }
  return `${(bitrateBps / 1_000_000).toFixed(2)} Mbps`;
}

function pickSelectedTrack<T extends {selected?: boolean}>(
  tracks: T[] | undefined,
): T | undefined {
  if (!tracks?.length) {
    return undefined;
  }
  return tracks.find(t => t.selected) ?? tracks[0];
}

function formatResolution(width?: number, height?: number): string {
  if (!width || !height) {
    return UNAVAILABLE;
  }
  return `${Math.round(width)}×${Math.round(height)}`;
}

function logFieldChange(field: string, value: string) {
  console.log(`${LOG_PREFIX} ${field}: ${value}`);
}

function patchPlayback(
  prev: PlaybackFields,
  patch: Partial<PlaybackFields>,
): PlaybackFields {
  const next = {...prev};
  for (const [key, value] of Object.entries(patch) as [
    keyof PlaybackFields,
    string,
  ][]) {
    if (value !== undefined && prev[key] !== value) {
      logFieldChange(key, value);
      next[key] = value;
    }
  }
  return next;
}

function toPlaybackRows(
  playback: PlaybackFields,
  networkSource: StatsSource,
): StatsRow[] {
  return [
    {label: 'Playback State', value: playback.playbackState, source: 'SDK'},
    {label: 'Stream', value: playback.stream, source: 'SDK'},
    {label: 'Resolution', value: playback.resolution, source: 'SDK'},
    {label: 'Video Codec', value: playback.videoCodec, source: 'SDK'},
    {label: 'Audio Codec', value: playback.audioCodec, source: 'SDK'},
    {label: 'Current Bitrate', value: playback.currentBitrate, source: 'SDK'},
    {
      label: 'Indicated Bitrate',
      value: playback.indicatedBitrate,
      source: 'SDK',
    },
    {label: 'Buffer Ahead', value: playback.bufferAhead, source: 'SDK'},
    {label: 'AirPlay', value: playback.airPlay, source: 'SDK'},
    {
      label: 'External Playback',
      value: playback.externalPlayback,
      source: 'SDK',
    },
    {label: 'DRM', value: playback.drm, source: 'SDK'},
    {label: 'Audio Language', value: playback.audioLanguage, source: 'SDK'},
    {label: 'Subtitle', value: playback.subtitle, source: 'SDK'},
    {label: 'Network', value: playback.network, source: networkSource},
  ];
}

function toDeviceRows(device: DeviceFields): StatsRow[] {
  return [
    {label: 'Hardware id', value: device.hardwareId, source: 'Device'},
    {
      label: 'Device class / model',
      value: device.deviceClass,
      source: 'Device',
    },
    {label: 'Device name', value: device.deviceName, source: 'Device'},
    {label: 'OS version', value: device.osVersion, source: 'Device'},
    {label: 'OS build', value: device.osBuild, source: 'Device'},
    {
      label: 'App version + build + bundle',
      value: device.appInfo,
      source: 'Device',
    },
    {label: 'Architecture', value: device.architecture, source: 'Device'},
    {label: 'RAM', value: device.ram, source: 'Device'},
    {label: 'Locale', value: device.locale, source: 'Device'},
    {
      label: 'System languages',
      value: device.systemLanguages,
      source: 'Device',
    },
    {label: 'Time zone', value: device.timeZone, source: 'Device'},
    {label: 'Thermal state', value: device.thermalState, source: 'Device'},
    {label: 'Low power mode', value: device.lowPowerMode, source: 'Device'},
    {label: 'Vendor ID', value: device.vendorId, source: 'Device'},
    {
      label: 'Screen resolution',
      value: device.screenResolution,
      source: 'Device',
    },
  ];
}

function derivePlaybackState(
  isBuffering: boolean,
  isPlaying: boolean | null,
  isSeeking: boolean | null,
): string {
  if (isBuffering) {
    return 'Buffering';
  }
  if (isSeeking) {
    return 'Seeking';
  }
  if (isPlaying === true) {
    return 'Playing';
  }
  if (isPlaying === false) {
    return 'Paused';
  }
  return UNAVAILABLE;
}

function formatStream(data: OnLoadStartData): string {
  const type = data.type?.trim() ? data.type : 'UNKNOWN';
  const network = data.isNetwork ? 'network' : 'local';
  const uri = data.uri ?? UNAVAILABLE;
  return `${type} (${network}) ${uri}`;
}

function formatAndroidNetwork(
  data: Record<string, string | undefined>,
): string {
  const reachability = data.reachability ?? UNAVAILABLE;
  const speed = data.downloadSpeedKBps;
  if (speed) {
    return `${reachability} (${speed} KB/s)`;
  }
  return reachability;
}

function formatIosNetwork(
  type: string | null,
  isConnected: boolean | null,
): string {
  if (!isConnected) {
    return 'Offline';
  }
  return type ?? UNAVAILABLE;
}

async function loadDeviceFields(): Promise<DeviceFields> {
  const window = Dimensions.get('window');
  const scale = PixelRatio.get();
  const points = `${Math.round(window.width)}×${Math.round(window.height)} pt @${scale}x`;

  const iosSettings = (
    NativeModules.SettingsManager as
      | {settings?: {AppleLocale?: string; AppleLanguages?: string[]}}
      | undefined
  )?.settings;

  const [
    deviceName,
    osVersion,
    osBuild,
    appVersion,
    buildNumber,
    bundleId,
    totalMemory,
    timezone,
    vendorId,
    model,
    brand,
    hardware,
    abis,
    powerState,
  ] = await Promise.all([
    DeviceInfo.getDeviceName(),
    Promise.resolve(DeviceInfo.getSystemVersion()),
    Platform.OS === 'ios'
      ? Promise.resolve(DeviceInfo.getBuildNumber())
      : DeviceInfo.getBuildId(),
    Promise.resolve(DeviceInfo.getVersion()),
    Promise.resolve(DeviceInfo.getBuildNumber()),
    Promise.resolve(DeviceInfo.getBundleId()),
    DeviceInfo.getTotalMemory(),
    Promise.resolve(Intl.DateTimeFormat().resolvedOptions().timeZone),
    DeviceInfo.getUniqueId(),
    Promise.resolve(DeviceInfo.getModel()),
    Promise.resolve(DeviceInfo.getBrand()),
    DeviceInfo.getHardware().catch(() => ''),
    DeviceInfo.supportedAbis(),
    DeviceInfo.getPowerState().catch(
      () => ({}) as {lowPowerMode?: boolean},
    ),
  ]);

  const platformConstants = Platform.constants as {
    interfaceIdiom?: string;
  };

  const deviceClass =
    Platform.OS === 'ios'
      ? `${platformConstants.interfaceIdiom ?? 'device'} / ${model}`
      : `${brand} ${model}`;

  const hardwareId = hardware || abis[0] || UNAVAILABLE;
  const architecture = abis.length ? abis.join(', ') : UNAVAILABLE;
  const locale =
    Platform.OS === 'ios'
      ? iosSettings?.AppleLocale ?? UNAVAILABLE
      : (NativeModules.I18nManager as {localeIdentifier?: string} | undefined)
          ?.localeIdentifier ?? UNAVAILABLE;
  const systemLanguages =
    Platform.OS === 'ios'
      ? iosSettings?.AppleLanguages?.join(', ') ?? locale
      : locale;
  const ramGb = totalMemory
    ? `${(totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : UNAVAILABLE;
  const lowPowerMode =
    powerState.lowPowerMode === true
      ? 'on'
      : powerState.lowPowerMode === false
        ? 'off'
        : UNAVAILABLE;

  return {
    hardwareId,
    deviceClass,
    deviceName: deviceName || UNAVAILABLE,
    osVersion: osVersion || UNAVAILABLE,
    osBuild: osBuild || UNAVAILABLE,
    appInfo: `${appVersion} (${buildNumber}) ${bundleId}`,
    architecture,
    ram: ramGb,
    locale,
    systemLanguages,
    timeZone: timezone || UNAVAILABLE,
    thermalState: Platform.OS === 'ios' ? UNAVAILABLE : 'N/A',
    lowPowerMode,
    vendorId: vendorId || UNAVAILABLE,
    screenResolution: points,
  };
}

function loadScreenResolution(): string {
  const window = Dimensions.get('window');
  const scale = PixelRatio.get();
  return `${Math.round(window.width)}×${Math.round(window.height)} pt @${scale}x`;
}

export function useStatsForNerds(videoSource?: ReactVideoSource) {
  const playbackRef = useRef<PlaybackFields>({...INITIAL_PLAYBACK});
  const deviceRef = useRef<DeviceFields>({...INITIAL_DEVICE});
  const [stats, setStats] = useState<StatsSnapshot>({
    playbackRows: toPlaybackRows(INITIAL_PLAYBACK, 'Device'),
    deviceRows: toDeviceRows(INITIAL_DEVICE),
  });

  const isBufferingRef = useRef(false);
  const isPlayingRef = useRef<boolean | null>(null);
  const isSeekingRef = useRef<boolean | null>(null);
  const progressThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingProgressRef = useRef<OnProgressData | null>(null);
  const networkSourceRef = useRef<StatsSource>(
    Platform.OS === 'android' ? 'SDK' : 'Device',
  );

  const drmLabel = useMemo(() => {
    const drmType = videoSource?.drm?.type;
    return drmType ? String(drmType) : 'none';
  }, [videoSource?.drm?.type]);

  const publishStats = useCallback(() => {
    setStats({
      playbackRows: toPlaybackRows(
        playbackRef.current,
        networkSourceRef.current,
      ),
      deviceRows: toDeviceRows(deviceRef.current),
    });
  }, []);

  const updatePlayback = useCallback(
    (patch: Partial<PlaybackFields>) => {
      playbackRef.current = patchPlayback(playbackRef.current, patch);
      publishStats();
    },
    [publishStats],
  );

  const updateDevice = useCallback(
    (patch: Partial<DeviceFields>) => {
      const next = {...deviceRef.current, ...patch};
      for (const [key, value] of Object.entries(patch) as [
        keyof DeviceFields,
        string,
      ][]) {
        if (deviceRef.current[key] !== value) {
          logFieldChange(`device.${key}`, value);
        }
      }
      deviceRef.current = next;
      publishStats();
    },
    [publishStats],
  );

  useEffect(() => {
    updatePlayback({drm: drmLabel});
  }, [drmLabel, updatePlayback]);

  useEffect(() => {
    let cancelled = false;

    loadDeviceFields()
      .then(fields => {
        if (!cancelled) {
          deviceRef.current = fields;
          publishStats();
        }
      })
      .catch(err => {
        console.warn(`${LOG_PREFIX} device info load failed`, err);
      });

    const dimSub = Dimensions.addEventListener('change', () => {
      updateDevice({screenResolution: loadScreenResolution()});
    });

    return () => {
      cancelled = true;
      dimSub.remove();
    };
  }, [publishStats, updateDevice]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = DeviceEventEmitter.addListener(
        'NetworkEventData',
        (data: Record<string, string | undefined>) => {
          updatePlayback({network: formatAndroidNetwork(data)});
        },
      );
      return () => sub.remove();
    }

    const unsubscribe = NetInfo.addEventListener(state => {
      updatePlayback({
        network: formatIosNetwork(state.type, state.isConnected),
      });
    });

    return () => unsubscribe();
  }, [updatePlayback]);

  const applyProgress = useCallback(
    (data: OnProgressData) => {
      const ahead = data.playableDuration - data.currentTime;
      const bufferAhead = ahead >= 0 ? `${ahead.toFixed(1)}s` : UNAVAILABLE;
      updatePlayback({bufferAhead});
    },
    [updatePlayback],
  );

  const onLoadStart = useCallback(
    (data: OnLoadStartData) => {
      updatePlayback({stream: formatStream(data)});
    },
    [updatePlayback],
  );

  const applyTrackMetadata = useCallback(
    (
      videoTracks?: OnLoadData['videoTracks'],
      audioTracks?: OnLoadData['audioTracks'],
      textTracks?: OnLoadData['textTracks'],
      naturalSize?: OnLoadData['naturalSize'],
    ) => {
      const videoTrack = pickSelectedTrack(videoTracks);
      const audioTrack = pickSelectedTrack(audioTracks);
      const textTrack = pickSelectedTrack(textTracks);

      const resolution =
        naturalSize?.width && naturalSize?.height
          ? formatResolution(naturalSize.width, naturalSize.height)
          : formatResolution(videoTrack?.width, videoTrack?.height);

      updatePlayback({
        resolution,
        videoCodec: videoTrack?.codecs ?? UNAVAILABLE,
        audioCodec: audioTrack?.type ?? UNAVAILABLE,
        audioLanguage: audioTrack?.language ?? UNAVAILABLE,
        subtitle: textTrack?.title ?? textTrack?.language ?? UNAVAILABLE,
      });
    },
    [updatePlayback],
  );

  const onLoad = useCallback(
    (data: OnLoadData) => {
      applyTrackMetadata(
        data.videoTracks,
        data.audioTracks,
        data.textTracks,
        data.naturalSize,
      );
    },
    [applyTrackMetadata],
  );

  const onVideoTracks = useCallback(
    (data: OnVideoTracksData) => {
      const videoTrack = pickSelectedTrack(data.videoTracks);
      if (videoTrack) {
        updatePlayback({
          resolution: formatResolution(videoTrack.width, videoTrack.height),
          videoCodec: videoTrack.codecs ?? UNAVAILABLE,
        });
      }
    },
    [updatePlayback],
  );

  const onAudioTracks = useCallback(
    (data: OnAudioTracksData) => {
      const audioTrack = pickSelectedTrack(data.audioTracks);
      if (audioTrack) {
        updatePlayback({
          audioCodec: audioTrack.type ?? UNAVAILABLE,
          audioLanguage: audioTrack.language ?? UNAVAILABLE,
        });
      }
    },
    [updatePlayback],
  );

  const onTextTracks = useCallback(
    (data: OnTextTracksData) => {
      const textTrack = pickSelectedTrack(data.textTracks);
      if (textTrack) {
        updatePlayback({
          subtitle: textTrack.title ?? textTrack.language ?? UNAVAILABLE,
        });
      }
    },
    [updatePlayback],
  );

  const onTextTrackDataChanged = useCallback(
    (data: OnTextTrackDataChangedData) => {
      const cue = data.subtitleTracks?.trim();
      if (cue) {
        updatePlayback({subtitle: cue});
      }
    },
    [updatePlayback],
  );

  const onProgress = useCallback(
    (data: OnProgressData) => {
      pendingProgressRef.current = data;
      if (progressThrottleTimerRef.current) {
        return;
      }
      applyProgress(data);
      progressThrottleTimerRef.current = setTimeout(() => {
        progressThrottleTimerRef.current = null;
        if (pendingProgressRef.current) {
          applyProgress(pendingProgressRef.current);
        }
      }, PROGRESS_THROTTLE_MS);
    },
    [applyProgress],
  );

  const onBuffer = useCallback(
    (data: OnBufferData) => {
      isBufferingRef.current = data.isBuffering;
      updatePlayback({
        playbackState: derivePlaybackState(
          data.isBuffering,
          isPlayingRef.current,
          isSeekingRef.current,
        ),
      });
    },
    [updatePlayback],
  );

  const onPlaybackStateChanged = useCallback(
    (data: OnPlaybackStateChangedData) => {
      isPlayingRef.current = data.isPlaying;
      isSeekingRef.current = data.isSeeking;
      updatePlayback({
        playbackState: derivePlaybackState(
          isBufferingRef.current,
          data.isPlaying,
          data.isSeeking,
        ),
      });
    },
    [updatePlayback],
  );

  const onBandwidthUpdate = useCallback(
    (data: OnBandwidthUpdateData) => {
      const current = formatMbps(data.bitrate);
      updatePlayback({currentBitrate: current});
      if (Platform.OS === 'ios') {
        updatePlayback({indicatedBitrate: current});
      } else {
        updatePlayback({
          indicatedBitrate: `${current} (estimate)`,
        });
      }
    },
    [updatePlayback],
  );

  const onExternalPlaybackChange = useCallback(
    (data: OnExternalPlaybackChangeData) => {
      const label = data.isExternalPlaybackActive ? 'active' : 'inactive';
      updatePlayback({
        airPlay: label,
        externalPlayback: label,
      });
    },
    [updatePlayback],
  );

  useEffect(() => {
    return () => {
      if (progressThrottleTimerRef.current) {
        clearTimeout(progressThrottleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      updatePlayback({
        airPlay: 'N/A',
        externalPlayback: 'N/A',
      });
    }
  }, [updatePlayback]);

  const videoCallbacks = useMemo(
    () => ({
      reportBandwidth: true as const,
      onLoadStart,
      onLoad,
      onProgress,
      onBuffer,
      onPlaybackStateChanged,
      onBandwidthUpdate,
      onExternalPlaybackChange,
      onVideoTracks,
      onAudioTracks,
      onTextTracks,
      onTextTrackDataChanged,
    }),
    [
      onLoadStart,
      onLoad,
      onProgress,
      onBuffer,
      onPlaybackStateChanged,
      onBandwidthUpdate,
      onExternalPlaybackChange,
      onVideoTracks,
      onAudioTracks,
      onTextTracks,
      onTextTrackDataChanged,
    ],
  );

  return {stats, videoCallbacks};
}
