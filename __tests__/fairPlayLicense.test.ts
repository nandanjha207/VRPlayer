import {
  base64ToBytes,
  extractAssetIdFromSkdUri,
  fetchBrightcoveFairPlayLicense,
  fetchKeyOsFairPlayLicense,
  normalizeSpcBase64,
  parseFairPlayLicenseResponse,
  resolveFairPlayLicenseEndpoint,
} from '../components/fairPlayLicense';

describe('resolveFairPlayLicenseEndpoint', () => {
  it('uses http(s) licenseUrl when provided', () => {
    expect(
      resolveFairPlayLicenseEndpoint(
        'https://license.example/lic',
        'https://fallback.example/lic',
      ),
    ).toBe('https://license.example/lic');
  });

  it('ignores skd:// manifest URIs and uses license server', () => {
    expect(
      resolveFairPlayLicenseEndpoint(
        'skd://drmtoday?assetId=123',
        'https://license.live.brightcove.com/lic/fp?token=abc',
      ),
    ).toBe('https://license.live.brightcove.com/lic/fp?token=abc');
  });
});

describe('extractAssetIdFromSkdUri', () => {
  it('parses assetId from skd key URI', () => {
    expect(
      extractAssetIdFromSkdUri(
        'skd://drmtoday?assetId=6387929198112&keyId=abc',
      ),
    ).toBe('6387929198112');
  });

  it('returns plain content ids unchanged', () => {
    expect(extractAssetIdFromSkdUri('6387929198112')).toBe('6387929198112');
  });
});

describe('base64ToBytes', () => {
  it('decodes normalized base64', () => {
    const bytes = base64ToBytes('dGVzdA==');
    expect(Array.from(bytes)).toEqual([116, 101, 115, 116]);
  });

  it('throws on empty input', () => {
    expect(() => base64ToBytes('   ')).toThrow(/empty/i);
  });
});

describe('normalizeSpcBase64', () => {
  it('strips whitespace', () => {
    expect(normalizeSpcBase64(' ab cd ')).toBe('abcd');
  });
});

describe('parseFairPlayLicenseResponse', () => {
  it('extracts ckc from JSON', () => {
    expect(parseFairPlayLicenseResponse('{"ckc":"abc123"}')).toBe('abc123');
  });

  it('returns plain text CKC unchanged', () => {
    expect(parseFairPlayLicenseResponse('plain-ckc-base64')).toBe(
      'plain-ckc-base64',
    );
  });

  it('throws on empty body', () => {
    expect(() => parseFairPlayLicenseResponse('   ')).toThrow(/empty/i);
  });
});

describe('fetchBrightcoveFairPlayLicense', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs raw SPC bytes first, then JSON fallback', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"bad binary"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {get: () => 'application/json'},
        text: async () => '{"ckc":"license-bytes"}',
      }) as unknown as typeof fetch;

    const ckc = await fetchBrightcoveFairPlayLicense(
      'dGVzdA==',
      'https://license.example/lic/fp?token=abc',
      'skd://drmtoday?assetId=6387929198112',
    );

    expect(ckc).toBe('license-bytes');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://license.example/lic/fp?token=abc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://license.example/lic/fp?token=abc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          spc: 'dGVzdA==',
          assetId: '6387929198112',
        }),
      }),
    );
  });
});

describe('fetchKeyOsFairPlayLicense', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs form body with customdata header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'keyos-ckc',
    }) as unknown as typeof fetch;

    const ckc = await fetchKeyOsFairPlayLicense(
      'spc',
      'asset-1',
      'https://keyos.example/getkey',
      'custom-xml-b64',
    );

    expect(ckc).toBe('keyos-ckc');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://keyos.example/getkey',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          customdata: 'custom-xml-b64',
        }),
        body: 'spc=spc&assetId=asset-1',
      }),
    );
  });
});
