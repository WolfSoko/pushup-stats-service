import {
  BUILD_INFO_URL,
  BuildInfo,
  UNKNOWN_BUILD_INFO,
  fetchBuildInfo,
  parseBuildInfo,
  resolveBuildInfo,
} from './build-info';

const deployed: BuildInfo = {
  release: 'e34d12c',
  version: '0.0.0-e34d12c',
  builtAt: '2026-08-13T09:00:00.000Z',
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe('parseBuildInfo', () => {
  it('should accept a complete build-info payload', () => {
    // given the JSON written by tools/src/write-build-info.mjs
    // when it is parsed
    const parsed = parseBuildInfo({ ...deployed });

    // then every field survives unchanged
    expect(parsed).toEqual(deployed);
  });

  it('should default a missing builtAt to an empty string', () => {
    // given a payload without a build timestamp
    // when it is parsed
    const parsed = parseBuildInfo({
      release: 'e34d12c',
      version: '0.0.0-e34d12c',
    });

    // then the version is still usable and builtAt is simply empty
    expect(parsed).toEqual({
      release: 'e34d12c',
      version: '0.0.0-e34d12c',
      builtAt: '',
    });
  });

  it.each([
    ['null', null],
    ['a string', 'e34d12c'],
    ['an empty release', { release: '', version: '0.0.0-e34d12c' }],
    ['a missing version', { release: 'e34d12c' }],
    ['a non-string version', { release: 'e34d12c', version: 42 }],
  ])('should reject %s', (_label, raw) => {
    // given a payload that does not carry a usable version
    // when it is parsed
    // then it is rejected instead of surfacing a half-filled readout
    expect(parseBuildInfo(raw)).toBeNull();
  });
});

describe('resolveBuildInfo', () => {
  it('should prefer the build-info file shipped inside the artifact', () => {
    // given both the artifact file and a GIT_SHA env var
    // when the SSR process resolves its build info
    const resolved = resolveBuildInfo(JSON.stringify(deployed), 'deadbee');

    // then the file wins — it was produced by the build being served
    expect(resolved).toEqual(deployed);
  });

  it('should fall back to GIT_SHA when no build-info file exists', () => {
    // given an environment that injects the commit instead of the file
    // when the SSR process resolves its build info
    const resolved = resolveBuildInfo(null, 'deadbee');

    // then the commit is reported as both release and version
    expect(resolved).toEqual({
      release: 'deadbee',
      version: 'deadbee',
      builtAt: '',
    });
  });

  it.each([
    ['malformed JSON', 'not-json{'],
    ['JSON without a version', '{"release":"e34d12c"}'],
  ])('should fall back to unknown for %s without a GIT_SHA', (_label, raw) => {
    // given an unusable build-info file and no env fallback (local dev)
    // when the SSR process resolves its build info
    // then it reports unknown rather than crashing the server startup
    expect(resolveBuildInfo(raw, undefined)).toEqual(UNKNOWN_BUILD_INFO);
  });
});

describe('fetchBuildInfo', () => {
  it('should read the deployed version from the build-info endpoint', async () => {
    // given a deployment that serves build-info.json
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(deployed));

    // when the build info is fetched
    const result = await fetchBuildInfo(fetchImpl as unknown as typeof fetch);

    // then the deployed version is returned, bypassing the browser cache
    expect(result).toEqual(deployed);
    expect(fetchImpl).toHaveBeenCalledWith(BUILD_INFO_URL, {
      cache: 'no-store',
    });
  });

  it('should report unknown when the file is not deployed', async () => {
    // given a 404 (dev server, or a host without the artifact file)
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false));

    // when the build info is fetched
    const result = await fetchBuildInfo(fetchImpl as unknown as typeof fetch);

    // then the caller gets the unknown placeholder instead of an error
    expect(result).toEqual(UNKNOWN_BUILD_INFO);
  });

  it('should report unknown when the request fails outright', async () => {
    // given an offline client
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));

    // when the build info is fetched
    const result = await fetchBuildInfo(fetchImpl as unknown as typeof fetch);

    // then the failure is swallowed — a version readout must never break a page
    expect(result).toEqual(UNKNOWN_BUILD_INFO);
  });

  it('should report unknown when the response body is not build info', async () => {
    // given a host that answers the path with an SPA shell / unrelated JSON
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ foo: 'bar' }));

    // when the build info is fetched
    const result = await fetchBuildInfo(fetchImpl as unknown as typeof fetch);

    // then the payload is rejected rather than displayed
    expect(result).toEqual(UNKNOWN_BUILD_INFO);
  });
});
