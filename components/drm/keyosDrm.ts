/**
 * KeyOS FairPlay DRM — Harmonic VOS360 / TTNTEST live HLS.
 * SDK fetches cert (customdata header), builds SPC, calls getLicenseRequest, POSTs to KeyOS.
 */

import {
  DRMType,
  FairPlayLicenseResponseFormat,
  type Drm,
} from '@ttn/vr-rn-player-sdk';

/** Base64 KeyOS Authentication XML — rotate via your KeyOS portal / backend when expired. */
export const KEYOS_CUSTOMDATA =
  'PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxLZXlPU0F1dGhlbnRpY2F0aW9uWE1MPjxEYXRhPjxXaWRldmluZVBvbGljeSBmbF9DYW5QZXJzaXN0PSJmYWxzZSIgZmxfQ2FuUGxheT0idHJ1ZSIvPjxXaWRldmluZUNvbnRlbnRLZXlTcGVjIFRyYWNrVHlwZT0iSEQiPjxTZWN1cml0eUxldmVsPjE8L1NlY3VyaXR5TGV2ZWw+PC9XaWRldmluZUNvbnRlbnRLZXlTcGVjPjxGYWlyUGxheVBvbGljeSBwZXJzaXN0ZW50PSJmYWxzZSIvPjxMaWNlbnNlIHR5cGU9InNpbXBsZSIvPjxHZW5lcmF0aW9uVGltZT4yMDI2LTAxLTI2IDE4OjAyOjEzLjAwMDwvR2VuZXJhdGlvblRpbWU+PEV4cGlyYXRpb25UaW1lPjIwNDEtMDEtMjYgMTg6MDI6MTMuMDAwPC9FeHBpcmF0aW9uVGltZT48VW5pcXVlSWQ+NzFmZTdhYmNjMzE4ZDE2M2EwYTJmOWE4NDVjOGI2ZTk8L1VuaXF1ZUlkPjxSU0FQdWJLZXlJZD43ZTExNDAwYzdkY2NkMjlkMDE3NGM2NzQzOTdkOTlkZDwvUlNBUHViS2V5SWQ+PC9EYXRhPjxTaWduYXR1cmU+WWZXR2VJSmpNYjRLOEVWWGRUck9OM1h5SVJlM1Uwams5YU1jVkVoVFluc1FKMTI3NUdmNlF3VzZ6SkVQUjNtYlNwU2crWEVVcVNEVm5wQVcwY1lQUWpiM21Hcjl4clJLR0xrcVJUU0VYR25JblpzSWJuc3VlOHZweXcycTRRVUo5OHpwV0J3NFhzeDY2b2NrV2R2dUFoTkFydHpSZHAvUDhuekdWdXc1eE5scy9tSEswMmxmb09rVGY4ZHc3M2RLTkx4SXZ6TjdyWnRHWlVGbSs1VTNtVjB2SzNybUE3TmF3dkltSEwzUFJVbXFEUjBWKytHVDFZMU5wRHZCOTNPb1hIK0FKWGhOOGhxWTEzMzRKQnVIdGtuQXJjRlh5MW5LVlFQbzZGd1VsVmJzNFBzOS9rL3ltZ0h0UXV4bGZ1SWFOcUtadEtlRXNSbnl4eWFLRytvOVBnPT08L1NpZ25hdHVyZT48L0tleU9TQXV0aGVudGljYXRpb25YTUw+Cg==';

const KEYOS_FP_LICENSE =
  'https://fairplay.keyos.com/api/v4/getLicense';
const KEYOS_FP_CERT =
  'https://fairplay.keyos.com/api/v4/getCertificate?certHash=5448ec23a7492e3cb26596acea7b0d6b2a91206a';

export function buildKeyOSDrmConfigWithCallback(customData: string): Drm {
  return {
    type: DRMType.FAIRPLAY,
    licenseServer: KEYOS_FP_LICENSE,
    certificateUrl: KEYOS_FP_CERT,
    headers: {customdata: customData},
    customCKCMetaData: {
      ckcRequestHeaderFields: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      licenseResponseFormat: FairPlayLicenseResponseFormat.BASE64_TEXT,
    },
    getLicenseRequest: ({assetId, spc}) =>
      `spc=${spc}&assetId=${assetId.replace(/^skd:\/\//i, '')}`,
  };
}
