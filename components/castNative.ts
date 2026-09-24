import {NativeModules, Platform} from 'react-native';
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

function sdkCastModule(): CastModule | undefined {
  return NativeModules.RNVideoGoogleCast as CastModule | undefined;
}

function logModuleAvailability(): void {
  const sdk = NativeModules.RNVideoGoogleCast;
  castLog('native module check', {
    platform: Platform.OS,
    hasRNVideoGoogleCast: sdk != null,
    presentCastDialogType: typeof sdk?.presentCastDialog,
  });
}

/**
 * Opens the Google Cast device picker via SDK RNVideoGoogleCast.
 */
export function presentCastDialog(): void {
  castLog('presentCastDialog requested');
  const sdk = sdkCastModule();
  if (typeof sdk?.presentCastDialog === 'function') {
    castLog('presentCastDialog → RNVideoGoogleCast (SDK)');
    sdk.presentCastDialog();
    return;
  }

  logModuleAvailability();
  castLog(
    'presentCastDialog FAILED',
    'no callable native method — Cast not linked or SDK bridge missing',
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

  castLog('clearCastMedia FAILED', 'no callable native clearCastMedia');
}

export async function checkIsCasting(): Promise<boolean> {
  const sdk = sdkCastModule();
  if (typeof sdk?.isCasting === 'function') {
    const value = await sdk.isCasting();
    castLog('isCasting (SDK)', {connected: value});
    return value;
  }

  castLog('isCasting', {connected: false, note: 'no native module'});
  return false;
}
