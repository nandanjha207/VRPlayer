/**
 * Minimal Google IMA (client-side) test harness using react-native-video `source.ad`.
 * Requires native flags: Android `useExoplayerIMA`, iOS `$RNVideoUseGoogleIMA` (see docs/video-ads-ima.md).
 *
 * This fork’s Android player ties resume to `isContentPlaying` — see docs/video-ads-ima.md.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  OnLoadData,
  OnProgressData,
  OnReceiveAdEventData,
  ReactVideoSource,
} from 'react-native-video';
import {AdEvent} from 'react-native-video';
import {
  GOOGLE_IMA_LONG_SAMPLE_CONTENT_URI,
  GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS,
  GOOGLE_IMA_SAMPLE_CONTENT_URI,
  GOOGLE_IMA_TEST_PRESETS,
} from './googleImaSampleConfig';
import {VideoPlayer} from './videoFork';

export {GOOGLE_IMA_SAMPLE_CONTENT_URI, GOOGLE_IMA_TEST_PRESETS};

const AD_LOG_CAP = 24;
const GAM_REQUEST_TIMEOUT_MS = 15000;
/** Default to preset 3 so mid-roll QA opens on the right scenario. */
const DEFAULT_PRESET_INDEX = 2;

function formatAdEvent(e: OnReceiveAdEventData): string {
  const t = new Date().toISOString().slice(11, 23);
  const data =
    e.data != null && Object.keys(e.data as object).length > 0
      ? ` ${JSON.stringify(e.data)}`
      : '';
  return `${e.event} ${t}${data}`;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ImaAdTestPlayer() {
  const {width} = useWindowDimensions();
  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET_INDEX);
  const [adLog, setAdLog] = useState<string[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [contentCurrentTime, setContentCurrentTime] = useState(0);
  const [contentDuration, setContentDuration] = useState(0);

  const preset = GOOGLE_IMA_TEST_PRESETS[presetIndex]!;

  const source: ReactVideoSource = useMemo(() => {
    const useLongContent = preset.needsLongContent === true;
    const contentUri = useLongContent
      ? GOOGLE_IMA_LONG_SAMPLE_CONTENT_URI
      : GOOGLE_IMA_SAMPLE_CONTENT_URI;

    return {
      uri: contentUri,
      ...(Platform.OS === 'android' && !useLongContent ? {type: 'mkv' as const} : {}),
      ad: {
        adBreaks: preset.adBreaks,
        adLanguage: 'en',
        gamRequestTimeoutMs: GAM_REQUEST_TIMEOUT_MS,
      },
    };
  }, [preset]);

  const remountPlayer = useCallback((nextPresetIndex?: number) => {
    if (nextPresetIndex != null) {
      setPresetIndex(nextPresetIndex);
    }
    setContentCurrentTime(0);
    setContentDuration(0);
    setAdLog([]);
    setReloadNonce(n => n + 1);
  }, []);

  const onLoad = useCallback((data: OnLoadData) => {
    setContentDuration(data.duration);
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    setContentCurrentTime(data.currentTime);
  }, []);

  const onReceiveAdEvent = useCallback((e: OnReceiveAdEventData) => {
    if (__DEV__) {
      console.log('[IMA]', e.event, e.data);
    }
    setAdLog(prev => {
      const next = [formatAdEvent(e), ...prev];
      return next.slice(0, AD_LOG_CAP);
    });
  }, []);

  const notableEvents = useMemo(
    () =>
      new Set<string>([
        AdEvent.STARTED,
        AdEvent.COMPLETED,
        AdEvent.ALL_ADS_COMPLETED,
        AdEvent.SKIPPED,
        AdEvent.ERROR,
        AdEvent.LOG,
        AdEvent.AD_METADATA,
        AdEvent.CONTENT_PAUSE_REQUESTED,
        AdEvent.CONTENT_RESUME_REQUESTED,
        AdEvent.AD_BREAK_STARTED,
        AdEvent.AD_BREAK_ENDED,
        AdEvent.AD_BREAK_READY,
        'AD_BREAK_FETCH_ERROR',
      ]),
    [],
  );

  const nextMidCue = useMemo(() => {
    if (!preset.needsLongContent) {
      return null;
    }
    return (
      GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS.find(
        cue => contentCurrentTime < cue - 0.25,
      ) ?? null
    );
  }, [contentCurrentTime, preset.needsLongContent]);

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Preset 3: mid-rolls fire at content {GOOGLE_IMA_PREMIDPOST_MIDROLL_CUE_SECONDS.join('s / ')}s
        (after preroll ends). Do not seek past cues. Content playhead is shown below — it must advance.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}>
        {GOOGLE_IMA_TEST_PRESETS.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={() => remountPlayer(i)}
            style={[
              styles.presetChip,
              i === presetIndex && styles.presetChipSelected,
            ]}>
            <Text
              style={[
                styles.presetChipText,
                i === presetIndex && styles.presetChipTextSelected,
              ]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => remountPlayer()}
          style={styles.reloadChip}>
          <Text style={styles.reloadChipText}>Reload player</Text>
        </Pressable>
      </ScrollView>
      <Text style={styles.playhead}>
        Content playhead: {formatClock(contentCurrentTime)}
        {contentDuration > 0 ? ` / ${formatClock(contentDuration)}` : ''}
        {nextMidCue != null ? ` · next mid-roll @ ${nextMidCue}s` : ''}
      </Text>
      <VideoPlayer
        key={`${preset.id}-${reloadNonce}`}
        source={source}
        style={[styles.video, {width: width - 32}]}
        controls
        resizeMode="contain"
        paused={false}
        isContentPlaying
        progressUpdateInterval={250}
        onLoad={onLoad}
        onProgress={onProgress}
        onReceiveAdEvent={onReceiveAdEvent}
      />
      <Text style={styles.sectionTitle}>Ad events (latest first)</Text>
      <ScrollView style={styles.logBox} nestedScrollEnabled>
        {adLog.length === 0 ? (
          <Text style={styles.logPlaceholder}>
            Waiting for IMA… (STARTED / CONTENT_PAUSE_REQUESTED / AD_BREAK_* / ERROR)
          </Text>
        ) : (
          adLog.map((line, idx) => {
            const head = line.split(' ')[0];
            const highlight =
              head != null && notableEvents.has(head) ? styles.logLineBold : null;
            return (
              <Text key={`${idx}-${line}`} style={[styles.logLine, highlight]}>
                {line}
              </Text>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  playhead: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  presetChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  presetChipSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
  },
  presetChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: '#f0f9ff',
  },
  reloadChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reloadChipText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  video: {
    aspectRatio: 16 / 9,
    alignSelf: 'center',
    backgroundColor: '#020617',
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  logBox: {
    flex: 1,
    maxHeight: 220,
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logPlaceholder: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
  },
  logLine: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
    marginBottom: 4,
  },
  logLineBold: {
    color: '#fbbf24',
    fontWeight: '600',
  },
});
