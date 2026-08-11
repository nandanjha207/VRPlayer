import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';
import {castLog} from './castDebugLog';

type CastModule = {
  presentCastDialog?: () => void;
  stopCasting?: () => void;
  /** Stop receiver media without ending the Cast session. */
  clearCastMedia?: () => void;
  isCasting?: () => Promise<boolean>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

export type VRCastSessionEventName =
  | 'starting'
  | 'started'
  | 'start_failed'
  | 'ending'
  | 'ended'
  | 'resuming'
  | 'resumed'
  | 'resume_failed'
  | 'suspended';

export type VRCastSessionEvent = {
  event: VRCastSessionEventName;
  deviceName?: string;
  sessionId?: string;
  errorCode?: number;
  playerState?: number;
};

export const VRCAST_SESSION_EVENT = 'VRCastSessionEvent';

function sdkCastModule(): CastModule | undefined {
  return NativeModules.RNVideoGoogleCast as CastModule | undefined;
}

/** Sample-app fallback when SDK AAR strips @ReactMethod bridges (Android only). */
function fallbackCastModule(): CastModule | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  return NativeModules.VRCast as CastModule | undefined;
}

function logModuleAvailability(): void {
  const sdk = NativeModules.RNVideoGoogleCast;
  castLog('native module check', {
    platform: Platform.OS,
    hasRNVideoGoogleCast: sdk != null,
    presentCastDialogType: typeof sdk?.presentCastDialog,
    hasVRCast: NativeModules.VRCast != null,
    vrcastPresentType: typeof NativeModules.VRCast?.presentCastDialog,
  });
}

/**
 * Opens the Google Cast device picker. Uses optional chaining — never calls
 * GoogleCast.startCasting() (unsafe when presentCastDialog is stripped from AAR).
 */
export function presentCastDialog(): void {
  castLog('presentCastDialog requested');
  const sdk = sdkCastModule();
  if (typeof sdk?.presentCastDialog === 'function') {
    castLog('presentCastDialog → RNVideoGoogleCast (SDK)');
    sdk.presentCastDialog();
    return;
  }

  const fallback = fallbackCastModule();
  if (typeof fallback?.presentCastDialog === 'function') {
    castLog('presentCastDialog → VRCast (sample-app fallback)');
    fallback.presentCastDialog();
    return;
  }

  logModuleAvailability();
  castLog(
    'presentCastDialog FAILED',
    'no callable native method — SDK AAR ProGuard or Cast not linked',
  );
}

export function stopCasting(): void {
  castLog('stopCasting requested');
  const sdk = sdkCastModule();
  if (typeof sdk?.stopCasting === 'function') {
    castLog('stopCasting → RNVideoGoogleCast (SDK)');
    sdk.stopCasting();
    return;
  }

  const fallback = fallbackCastModule();
  if (typeof fallback?.stopCasting === 'function') {
    castLog('stopCasting → VRCast (sample-app fallback)');
    fallback.stopCasting();
    return;
  }

  castLog('stopCasting FAILED', 'no callable native stopCasting');
}

/** Clears TV media; keeps Cast session so a later supported item can load. */
export function clearCastMedia(): void {
  castLog('clearCastMedia requested');
  const sdk = sdkCastModule();
  if (typeof sdk?.clearCastMedia === 'function') {
    castLog('clearCastMedia → RNVideoGoogleCast (SDK)');
    sdk.clearCastMedia();
    return;
  }

  const fallback = fallbackCastModule();
  if (typeof fallback?.clearCastMedia === 'function') {
    castLog('clearCastMedia → VRCast (sample-app fallback)');
    fallback.clearCastMedia();
    return;
  }

  castLog('clearCastMedia FAILED', 'no callable native clearCastMedia');
}

export async function checkIsCasting(): Promise<boolean> {
  const sdk = sdkCastModule();
  if (typeof sdk?.isCasting === 'function') {
    const value = await sdk.isCasting();
    castLog('isCasting (SDK)', {connected: value});
    return value;
  }

  const fallback = fallbackCastModule();
  if (typeof fallback?.isCasting === 'function') {
    const value = await fallback.isCasting();
    castLog('isCasting (VRCast)', {connected: value});
    return value;
  }

  castLog('isCasting', {connected: false, note: 'no native module'});
  return false;
}

/**
 * Android sample-app fallback: VRCast emits session lifecycle when the SDK AAR
 * does not bridge onGoogleCastEvent to JS.
 */
export function subscribeVRCastSessionEvents(
  listener: (event: VRCastSessionEvent) => void,
): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  const module = NativeModules.VRCast as CastModule | undefined;
  if (module == null) {
    return () => {};
  }

  const subscription = DeviceEventEmitter.addListener(
    VRCAST_SESSION_EVENT,
    listener,
  );
  return () => subscription.remove();
}
