import type {ReactVideoSource} from '@ttn/vr-rn-player-sdk';
import type {DvrTestSource} from './dvrTestSources';

/** Build a {@link ReactVideoSource} for DVR testing with `supportsDvr: true`. */
export function buildDvrTestVideoSource(
  testSource: DvrTestSource,
): ReactVideoSource | undefined {
  if (!testSource.playable || testSource.drmConfigMissing) {
    return undefined;
  }

  return {
    uri: testSource.uri,
    type: testSource.type,
    isLive: true,
    supportsDvr: true,
    ...(testSource.drm ? {drm: testSource.drm} : {}),
    metadata: {title: testSource.label},
  };
}
