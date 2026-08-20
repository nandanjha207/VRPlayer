import {
  DRMType,
  FairPlayLicenseResponseFormat,
} from '@ttn/vr-rn-player-sdk';
import {buildKeyOSDrmConfigWithCallback} from '../components/drm/keyosDrm';
import {drmConfigurationForContent} from '../components/drm/drmConfigurationForContent';

describe('buildKeyOSDrmConfigWithCallback', () => {
  it('returns FairPlay v4 KeyOS config with getLicenseRequest callback', () => {
    const customData = 'dGVzdC10b2tlbg==';
    const drm = buildKeyOSDrmConfigWithCallback(customData);

    expect(drm.type).toBe(DRMType.FAIRPLAY);
    expect(drm.licenseServer).toBe(
      'https://fairplay.keyos.com/api/v4/getLicense',
    );
    expect(drm.certificateUrl).toContain('fairplay.keyos.com/api/v4/getCertificate');
    expect(drm.headers).toEqual({customdata: customData});
    expect(drm.customCKCMetaData?.licenseResponseFormat).toBe(
      FairPlayLicenseResponseFormat.BASE64_TEXT,
    );
    expect(drm.customCKCMetaData?.ckcRequestHeaderFields).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const body = drm.getLicenseRequest?.({
      assetId: 'skd://abc-asset-id',
      spc: 'base64-spc',
    });
    expect(body).toBe('spc=base64-spc&assetId=abc-asset-id');
  });
});

describe('drmConfigurationForContent', () => {
  it('returns pre-built drm when set', () => {
    const preset = buildKeyOSDrmConfigWithCallback('token');
    expect(
      drmConfigurationForContent({drm: preset, description: 'other'}),
    ).toBe(preset);
  });

  it('builds KeyOS drm when description matches TTNTEST and customData is provided', () => {
    const drm = drmConfigurationForContent(
      {description: '(hls|live|fairplay|keyos) TTNTEST'},
      'token',
    );
    expect(drm?.type).toBe(DRMType.FAIRPLAY);
    expect(drm?.headers).toEqual({customdata: 'token'});
  });

  it('returns undefined when no drm match', () => {
    expect(drmConfigurationForContent({description: 'clear hls'})).toBeUndefined();
  });
});
