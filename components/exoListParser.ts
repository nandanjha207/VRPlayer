/**
 * Parses Google ExoPlayer demo `media.exolist.json` into a flat playlist
 * with DRM / live / ads flags for the catalog UI.
 */

import {Platform} from 'react-native';

export type ExoListSample = {
  name: string;
  uri?: string;
  drm_scheme?: string;
  drm_license_uri?: string;
  drm_force_default_license_uri?: boolean;
  drm_session_for_clear_content?: boolean;
  ad_tag_uri?: string;
  playlist?: ExoListSample[];
  subtitle_uri?: string;
  subtitle_mime_type?: string;
  subtitle_language?: string;
  extension?: string;
};

export type ExoListCategory = {
  name: string;
  samples: ExoListSample[];
};

export type StreamTag = 'clear' | 'drm' | 'live' | 'ads' | 'dai';

export type CatalogStreamItem = {
  id: string;
  category: string;
  title: string;
  uri: string;
  drmScheme?: string;
  drmLicenseUri?: string;
  drmSessionForClearContent?: boolean;
  adTagUri?: string;
  /** FairPlay (KeyOS): FPS application certificate URL. */
  fairPlayCertificateUrl?: string;
  /** KeyOS authentication XML, base64 — sent as `customdata` header on license POST. */
  fairPlayCustomData?: string;
  /** Optional; derived from `skd://` in manifest when omitted. */
  fairPlayContentId?: string;
  /** Optional poster / thumbnail for playlist row. */
  thumbnailUri?: string;
  tags: StreamTag[];
  /** False for ssai://, unknown schemes, or PlayReady on iOS. */
  playable: boolean;
  unsupportedHint?: string;
};

function inferTags(
  category: string,
  sampleName: string,
  uri: string,
  drmScheme?: string,
  adTag?: string,
): StreamTag[] {
  const tags = new Set<StreamTag>();
  const lower = `${category} ${sampleName} ${uri}`.toLowerCase();

  if (drmScheme) {
    tags.add('drm');
  } else if (!uri.startsWith('ssai://')) {
    tags.add('clear');
  }

  if (
    uri.startsWith('ssai://') ||
    (lower.includes('live') &&
      (uri.includes('dai.google') || uri.startsWith('ssai://')))
  ) {
    tags.add('live');
  }

  if (uri.startsWith('ssai://')) {
    tags.add('dai');
  }

  if (adTag) {
    tags.add('ads');
  }

  return [...tags];
}

function playability(
  uri: string,
  drmScheme?: string,
): {playable: boolean; hint?: string} {
  if (!uri || uri.startsWith('ssai://')) {
    return {
      playable: false,
      hint: 'Google DAI (ssai://) needs the IMA DAI stack — not wired in this demo.',
    };
  }

  if (drmScheme === 'playready' && Platform.OS === 'ios') {
    return {
      playable: false,
      hint: 'PlayReady SmoothStreaming is not supported on iOS AVPlayer.',
    };
  }

  return {playable: true};
}

function pushItem(
  out: CatalogStreamItem[],
  category: string,
  title: string,
  uri: string,
  sample: ExoListSample,
) {
  const drmScheme = sample.drm_scheme?.toLowerCase();
  const drmLicenseUri = sample.drm_license_uri;
  const tags = inferTags(category, title, uri, drmScheme, sample.ad_tag_uri);
  const {playable, hint} = playability(uri, drmScheme);

  out.push({
    id: `exo-${out.length}`,
    category,
    title,
    uri,
    drmScheme,
    drmLicenseUri,
    drmSessionForClearContent: sample.drm_session_for_clear_content,
    adTagUri: sample.ad_tag_uri,
    tags,
    playable,
    unsupportedHint: hint,
  });
}

function flattenSample(
  out: CatalogStreamItem[],
  category: string,
  sample: ExoListSample,
  parentLabel?: string,
) {
  const baseTitle = parentLabel
    ? `${parentLabel} › ${sample.name}`
    : sample.name;

  if (sample.playlist?.length) {
    sample.playlist.forEach((child, idx) => {
      if (child.playlist?.length) {
        flattenSample(out, category, child, `${baseTitle} #${idx + 1}`);
        return;
      }
      if (child.uri) {
        pushItem(out, category, `${baseTitle} [${idx + 1}]`, child.uri, {
          ...child,
          name: child.name ?? `${sample.name} item ${idx + 1}`,
        });
      }
    });
    return;
  }

  if (sample.uri) {
    pushItem(out, category, baseTitle, sample.uri, sample);
  }
}

export function flattenExoList(categories: ExoListCategory[]): CatalogStreamItem[] {
  const out: CatalogStreamItem[] = [];
  for (const cat of categories) {
    for (const sample of cat.samples ?? []) {
      flattenSample(out, cat.name, sample);
    }
  }
  return out;
}
