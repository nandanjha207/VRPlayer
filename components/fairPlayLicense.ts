/**
 * FairPlay license exchange helpers for catalog DRM rows.
 */

export type FairPlayLicenseHandler = 'keyos' | 'brightcove';

/**
 * Native FairPlay passes the manifest `skd://` URI as `licenseUrl`.
 * Only http(s) endpoints are fetchable — fall back to configured license server.
 */
export function resolveFairPlayLicenseEndpoint(
  licenseUrl: string | undefined,
  licenseServer: string,
): string {
  const candidate = (licenseUrl ?? '').trim();
  if (
    candidate.startsWith('https://') ||
    candidate.startsWith('http://')
  ) {
    return candidate;
  }
  return licenseServer;
}

/** Normalize base64 from native (strip whitespace, URL-safe alphabet). */
export function normalizeSpcBase64(spcBase64: string): string {
  return spcBase64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
}

/** Decode SPC bytes from the base64 string native passes to `getLicense`. */
export function base64ToBytes(b64: string): Uint8Array {
  const normalized = normalizeSpcBase64(b64);
  if (!normalized) {
    throw new Error('FairPlay SPC: empty base64 payload from player');
  }

  let binary: string;
  try {
    binary = globalThis.atob(normalized);
  } catch {
    throw new Error('FairPlay SPC: player payload is not valid base64');
  }

  if (!binary.length) {
    throw new Error('FairPlay SPC: decoded to zero bytes');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)!;
  }
  return bytes;
}

/** Pull DRMtoday `assetId` from `skd://drmtoday?assetId=…` key URIs. */
export function extractAssetIdFromSkdUri(
  contentId: string | undefined,
): string | undefined {
  if (!contentId?.trim()) {
    return undefined;
  }
  const match = contentId.match(/(?:^|\?|&)assetId=([^&]+)/i);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return contentId;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary);
}

/** Parse CKC from Brightcove JSON (`{ ckc }`) or plain base64/text bodies. */
export function parseFairPlayLicenseResponse(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('FairPlay license: empty response body');
  }

  try {
    const json = JSON.parse(trimmed) as {ckc?: string; CKC?: string};
    const ckc = json.ckc ?? json.CKC;
    if (typeof ckc === 'string' && ckc.length > 0) {
      return ckc;
    }
  } catch {
    // Plain-text / base64 CKC payload.
  }

  return trimmed;
}

/** DRMtoday / KeyOS: form POST with `customdata` auth header. */
export async function fetchKeyOsFairPlayLicense(
  spcBase64: string,
  contentId: string,
  licenseUrl: string,
  customData: string,
): Promise<string> {
  const response = await fetch(licenseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      customdata: customData,
    },
    body: `spc=${encodeURIComponent(spcBase64)}&assetId=${encodeURIComponent(contentId)}`,
  });

  if (!response.ok) {
    throw new Error(
      `KeyOS license HTTP ${response.status}: ${response.statusText}`,
    );
  }

  return response.text();
}

async function readBrightcoveLicenseResponse(
  response: Response,
): Promise<string> {
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pkcs7')
  ) {
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
      throw new Error('Brightcove FairPlay license: empty binary CKC');
    }
    return bytesToBase64(new Uint8Array(buffer));
  }

  return parseFairPlayLicenseResponse(await response.text());
}

/**
 * Brightcove Live: JWT auth is in the license URL query string.
 * POST raw SPC bytes (`application/octet-stream`), then JSON `{ spc, assetId }`.
 */
export async function fetchBrightcoveFairPlayLicense(
  spcBase64: string,
  licenseEndpoint: string,
  nativeContentId?: string,
): Promise<string> {
  const normalizedSpc = normalizeSpcBase64(spcBase64);
  const spcBytes = base64ToBytes(spcBase64);
  const assetId = extractAssetIdFromSkdUri(nativeContentId);

  console.log(
    `[FairPlay] Brightcove license request: spcBytes=${spcBytes.length}, assetId=${assetId ?? 'n/a'}`,
  );

  const attempts: Array<{
    label: string;
    init: RequestInit;
  }> = [
    {
      label: 'octet-stream',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/json, application/octet-stream',
        },
        body: spcBytes,
      },
    },
    {
      label: 'json',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/octet-stream',
        },
        body: JSON.stringify({
          spc: normalizedSpc,
          ...(assetId ? {assetId} : {}),
        }),
      },
    },
  ];

  let lastDetail = 'unknown error';

  for (const attempt of attempts) {
    let response: Response;
    try {
      response = await fetch(licenseEndpoint, attempt.init);
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : 'network request failed';
      console.error(
        `[FairPlay] Brightcove ${attempt.label} license fetch failed: ${detail}`,
      );
      lastDetail = detail;
      continue;
    }

    if (response.ok) {
      return readBrightcoveLicenseResponse(response);
    }

    lastDetail = await response.text();
    console.error(
      `[FairPlay] Brightcove ${attempt.label} license HTTP ${response.status}: ${lastDetail}`,
    );
  }

  throw new Error(
    `Brightcove FairPlay license failed after all formats: ${lastDetail}`,
  );
}
