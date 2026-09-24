import { render } from '@testing-library/angular';
import { SkeletonTableComponent } from './skeleton-table.component';

describe('SkeletonTableComponent', () => {
  it('should render the requested rows with one bar per column', async () => {
    // given / when
    const { container } = await render(SkeletonTableComponent, {
      inputs: { rows: 3, columns: 4 },
    });

    // then
    const rows = container.querySelectorAll('.pu-skeleton-table__row');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelectorAll('pu-skeleton')).toHaveLength(4);
    expect((rows[0] as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(4, minmax(0, 1fr))'
    );
  });

  it('should stay hidden from assistive tech', async () => {
    // given / when
    const { fixture } = await render(SkeletonTableComponent);

    // then
    expect(
      (fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')
    ).toBe('true');
  });
});
