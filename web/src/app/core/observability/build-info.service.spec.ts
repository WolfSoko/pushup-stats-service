import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BuildInfoService } from './build-info.service';
import { BUILD_INFO_URL, UNKNOWN_BUILD_INFO } from '../../../build-info';

/** Flush pending microtasks (Promise callbacks) */
const flushMicrotasks = () => new Promise((r) => process.nextTick(r));

const deployed = {
  release: 'e34d12c',
  version: '0.0.0-e34d12c',
  builtAt: '2026-08-13T09:00:00.000Z',
};

function stubFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function createService(platformId: string): BuildInfoService {
  TestBed.configureTestingModule({
    providers: [{ provide: PLATFORM_ID, useValue: platformId }],
  });
  return TestBed.inject(BuildInfoService);
}

/** Flush the resource loader, mirroring the pattern in user-context.service.spec.ts */
async function settleResource(): Promise<void> {
  TestBed.tick();
  await flushMicrotasks();
  TestBed.tick();
}

describe('BuildInfoService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should expose the release of the running deployment', async () => {
    // given a deployment that serves build-info.json
    const fetchMock = stubFetch({ ok: true, json: async () => deployed });
    const service = createService('browser');

    // when the resource has loaded
    await settleResource();

    // then the deployed version is available to the admin readout
    expect(service.buildInfo()).toEqual(deployed);
    expect(service.isKnown()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(BUILD_INFO_URL, {
      cache: 'no-store',
    });
  });

  it('should report unknown when the deployment ships no build info', async () => {
    // given a host that answers the path with a 404
    stubFetch({ ok: false, json: async () => null });
    const service = createService('browser');

    // when the resource has loaded
    await settleResource();

    // then the placeholder is exposed instead of a half-filled readout
    expect(service.buildInfo()).toEqual(UNKNOWN_BUILD_INFO);
    expect(service.isKnown()).toBe(false);
  });

  it('should not request the build info during server-side rendering', async () => {
    // given the service is instantiated on the server
    const fetchMock = stubFetch({ ok: true, json: async () => deployed });
    const service = createService('server');

    // when the resource has loaded
    await settleResource();

    // then no network call is made — the readout is a client-only concern
    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.buildInfo()).toEqual(UNKNOWN_BUILD_INFO);
  });
});
