import type {Drm} from '@ttn/vr-rn-player-sdk';
import {buildKeyOSDrmConfigWithCallback} from './keyosDrm';

export type DrmContentDescriptor = Readonly<{
  /** Playlist / catalog description used to detect KeyOS streams (e.g. TTNTEST). */
  description?: string;
  /** Pre-built DRM config — returned as-is when set. */
  drm?: Drm;
}>;

/**
 * Resolves DRM for a catalog row.
 * - Pre-set `content.drm` wins.
 * - KeyOS FairPlay when description mentions keyos/TTNTEST and customData is provided.
 */
export function drmConfigurationForContent(
  content: DrmContentDescriptor,
  customData?: string,
): Drm | undefined {
  if (content.drm) {
    return content.drm;
  }

  const description = content.description ?? '';
  const lower = description.toLowerCase();
  if (
    customData &&
    (lower.includes('keyos') || lower.includes('ttntest'))
  ) {
    return buildKeyOSDrmConfigWithCallback(customData);
  }

  return undefined;
}
