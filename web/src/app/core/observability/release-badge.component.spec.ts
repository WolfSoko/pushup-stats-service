import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { BuildInfo, UNKNOWN_BUILD_INFO } from '../../../build-info';
import { BuildInfoService } from './build-info.service';
import { ReleaseBadgeComponent } from './release-badge.component';

const deployed: BuildInfo = {
  release: 'e34d12c',
  version: '0.0.0-e34d12c',
  builtAt: '2026-08-13T09:00:00.000Z',
};

async function renderBadge(info: BuildInfo) {
  return render(ReleaseBadgeComponent, {
    providers: [
      {
        provide: BuildInfoService,
        useValue: {
          buildInfo: signal(info).asReadonly(),
          isKnown: signal(info.release !== UNKNOWN_BUILD_INFO.release),
        },
      },
    ],
  });
}

describe('ReleaseBadgeComponent', () => {
  it('should show the version of the running deployment', async () => {
    // given a deployment that reports its build info
    // when the badge renders
    await renderBadge(deployed);

    // then the released version is on screen
    expect(screen.getByText('0.0.0-e34d12c')).toBeTruthy();
  });

  it('should name commit and build time in the tooltip', async () => {
    // given a deployment that reports its build info
    // when the badge renders
    const { fixture } = await renderBadge(deployed);

    // then the tooltip carries the details that do not fit in the badge.
    //   The date itself is rendered by `formatDate` in the active locale, so
    //   only its presence is asserted, not its formatting.
    const tooltip = fixture.componentInstance.tooltip();
    expect(tooltip).toContain('Commit e34d12c');
    expect(tooltip).toMatch(/gebaut am \S+/);
  });

  it('should fall back to the commit alone when no build time is known', async () => {
    // given a deployment that only injected GIT_SHA
    // when the badge renders
    const { fixture } = await renderBadge({
      release: 'e34d12c',
      version: 'e34d12c',
      builtAt: '',
    });

    // then the tooltip names the commit without an empty date fragment
    expect(fixture.componentInstance.tooltip()).toBe('Commit e34d12c');
  });

  it('should say so when the deployment ships no build info', async () => {
    // given a local build or dev server without build-info.json
    // when the badge renders
    const { fixture } = await renderBadge(UNKNOWN_BUILD_INFO);

    // then it reads "unknown" rather than showing a misleading version
    expect(screen.getByText('unbekannt')).toBeTruthy();
    expect(fixture.componentInstance.tooltip()).toContain(
      'Build-Informationen'
    );
  });
});
