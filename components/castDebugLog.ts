import type {OnGoogleCastEventData} from 'react-native-video';

/** Set false to silence Cast logs in dev. */
export const CAST_DEBUG = __DEV__;

const TAG = '[Cast]';

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export function castLog(
  phase: string,
  detail?: Record<string, unknown> | string,
): void {
  if (!CAST_DEBUG) {
    return;
  }
  if (detail === undefined) {
    console.log(`${TAG} ${timestamp()} ${phase}`);
    return;
  }
  if (typeof detail === 'string') {
    console.log(`${TAG} ${timestamp()} ${phase} — ${detail}`);
    return;
  }
  console.log(`${TAG} ${timestamp()} ${phase}`, detail);
}

export function castLogNativeEvent(e: OnGoogleCastEventData): void {
  if (!CAST_DEBUG) {
    return;
  }
  const eventName = e.event ?? 'unknown';
  const payload: Record<string, unknown> = {event: eventName};
  if (e.reason != null) {
    payload.reason = e.reason;
  }
  if (e.message != null) {
    payload.message = e.message;
  }
  if (e.deviceName != null) {
    payload.deviceName = e.deviceName;
  }
  if (e.data != null && typeof e.data === 'object') {
    payload.data = e.data;
  }
  castLog(`native event: ${eventName}`, payload);
}

export function castLogSource(
  action: string,
  source?: {uri?: string; type?: string; castFriendly?: boolean},
): void {
  if (!CAST_DEBUG) {
    return;
  }
  castLog(action, {
    uri: source?.uri ?? '(none)',
    type: source?.type ?? '(inferred)',
    castFriendly: source?.castFriendly,
  });
}

/**
 * Android Studio Logcat:
 *   tag:VRCast | tag:ReactNativeJS
 * Terminal:
 *   adb logcat -s VRCast:I ReactNativeJS:V
 */
export function castLogHelp(): void {
  if (!CAST_DEBUG) {
    return;
  }
  castLog(
    'debug help',
    'Filter Logcat: tag:VRCast OR ReactNativeJS, search [Cast]. ' +
      'Phases: picker → session started → source load → play/buffer → stop/idle.',
  );
}
