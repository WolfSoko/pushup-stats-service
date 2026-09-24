import { DOCUMENT, Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { PageReloadService } from './page-reload.service';

describe('PageReloadService', () => {
  let location: {
    reload: ReturnType<typeof vitest.fn>;
    assign: ReturnType<typeof vitest.fn>;
  };
  let calls: string[];

  function setup(swUpdate: Partial<SwUpdate> | null) {
    calls = [];
    location = {
      reload: vitest.fn(() => calls.push('reload')),
      assign: vitest.fn(() => calls.push('assign')),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { location } },
        {
          provide: Location,
          useValue: { prepareExternalUrl: (url: string) => `/de${url}` },
        },
        ...(swUpdate ? [{ provide: SwUpdate, useValue: swUpdate }] : []),
      ],
    });
    return TestBed.inject(PageReloadService);
  }

  it('should activate the waiting version before reloading', async () => {
    // given
    const service = setup({
      isEnabled: true,
      activateUpdate: vitest.fn(async () => {
        calls.push('activate');
        return true;
      }),
    });

    // when
    await service.reload();

    // then
    expect(calls).toEqual(['activate', 'reload']);
  });

  it('should still reload when activation fails', async () => {
    // given
    const service = setup({
      isEnabled: true,
      activateUpdate: vitest.fn().mockRejectedValue(new Error('no version')),
    });

    // when
    await service.reload();

    // then
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('should load the target URL under the base href', async () => {
    // given
    const service = setup(null);

    // when
    await service.reload('/history');

    // then
    expect(location.assign).toHaveBeenCalledWith('/de/history');
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('should reload only once when triggered twice', async () => {
    // given
    const service = setup(null);

    // when
    await Promise.all([service.reload(), service.reload('/history')]);

    // then
    expect(calls).toEqual(['reload']);
  });
});
