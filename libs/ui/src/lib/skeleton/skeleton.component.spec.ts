import { render } from '@testing-library/angular';
import { SkeletonComponent } from './skeleton.component';

describe('SkeletonComponent', () => {
  it('should render one hidden shimmer bar as a text line by default', async () => {
    // given / when
    const { fixture } = await render(SkeletonComponent);
    const host = fixture.nativeElement as HTMLElement;

    // then
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList.contains('pu-skeleton--text')).toBe(true);
    expect(host.querySelectorAll('.pu-skeleton__bar')).toHaveLength(1);
  });

  it('should stack one bar per requested line and switch to the multiline layout', async () => {
    // given / when
    const { container, fixture } = await render(SkeletonComponent, {
      inputs: { lines: 3 },
    });

    // then
    expect(container.querySelectorAll('.pu-skeleton__bar')).toHaveLength(3);
    expect(
      (fixture.nativeElement as HTMLElement).classList.contains(
        'pu-skeleton--multiline'
      )
    ).toBe(true);
  });

  it('should keep the single-line layout for one line', async () => {
    // given / when
    const { fixture } = await render(SkeletonComponent);

    // then
    expect(
      (fixture.nativeElement as HTMLElement).classList.contains(
        'pu-skeleton--multiline'
      )
    ).toBe(false);
  });

  it('should apply the shape class and explicit dimensions to the host', async () => {
    // given / when
    const { fixture } = await render(SkeletonComponent, {
      inputs: { shape: 'circle', width: '48px', height: '48px' },
    });
    const host = fixture.nativeElement as HTMLElement;

    // then
    expect(host.classList.contains('pu-skeleton--circle')).toBe(true);
    expect(host.style.width).toBe('48px');
    expect(host.style.height).toBe('48px');
  });

  it('should accept the line count as a plain attribute string', async () => {
    // given / when
    const { container } = await render(SkeletonComponent, {
      inputs: { lines: '4' as unknown as number },
    });

    // then
    expect(container.querySelectorAll('.pu-skeleton__bar')).toHaveLength(4);
  });

  it('should never render zero bars', async () => {
    // given / when
    const { container } = await render(SkeletonComponent, {
      inputs: { lines: 0 },
    });

    // then
    expect(container.querySelectorAll('.pu-skeleton__bar')).toHaveLength(1);
  });
});
