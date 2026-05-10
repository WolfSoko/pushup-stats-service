import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { TypePieComponent, PieDatum } from './type-pie.component';

describe('TypePieComponent', () => {
  let fixture: ComponentFixture<TypePieComponent>;
  let component: TypePieComponent;

  const sevenTypes: PieDatum[] = [
    { label: 'Standard', value: 100 },
    { label: 'Diamond', value: 80 },
    { label: 'Wide', value: 60 },
    { label: 'Decline', value: 40 },
    { label: 'Knee', value: 30 },
    { label: 'Spider', value: 20 },
    { label: 'Clap', value: 10 },
  ];

  beforeEach(async () => {
    // Given: a TypePieComponent rendered with 7 types ordered by descending value.
    await TestBed.configureTestingModule({
      imports: [TypePieComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TypePieComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', sevenTypes);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('preselects the top 5 highest-value ids by default', () => {
    // Then
    expect([...component.selectedIds()]).toEqual([
      'Standard',
      'Diamond',
      'Wide',
      'Decline',
      'Knee',
    ]);
    // Selected types fill the pie 100% — no synthetic Other arc.
    expect(component.visibleSegments()).toHaveLength(5);
    expect(component.visibleSegments().some((s) => s.id === '__other__')).toBe(
      false
    );
  });

  it('selectedTotal sums only the selected types', () => {
    // Default top-5: 100+80+60+40+30 = 310, vs. grand total 340.
    expect(component.selectedTotal()).toBe(310);
    expect(component.total()).toBe(340);
  });

  it('renders the selected total in the donut center', () => {
    const host: HTMLElement = fixture.nativeElement;
    const total = host.querySelector('[data-testid="type-pie-total"]');
    expect(total).toBeTruthy();
    expect(total!.textContent?.replace(/\s+/g, '')).toContain('310');
  });

  it('selected types fill the pie 100% (sum of dash fractions ≈ 100)', () => {
    const sumDash = component.visibleSegments().reduce((sum, seg) => {
      const visible = parseFloat(seg.dasharray.split(' ')[0]);
      return sum + visible;
    }, 0);
    expect(sumDash).toBeCloseTo(100, 5);
  });

  it('legend percentages for selected types are relative to the selected total', () => {
    // selected total = 310; Standard contributes 100/310 ≈ 32%.
    expect(component.legendPercent('Standard')).toBe(
      Math.round((100 / 310) * 100)
    );
    expect(component.legendPercent('Diamond')).toBe(
      Math.round((80 / 310) * 100)
    );
    // Spider is unselected → no percent (legend falls back to raw count).
    expect(component.legendPercent('Spider')).toBeNull();
  });

  it('focusing a slice surfaces its info in the donut center', () => {
    // When: a slice is focused programmatically
    component.focusSegment('Standard');
    fixture.detectChanges();

    // Then: focusedSegment exposes the slice payload
    const focused = component.focusedSegment();
    expect(focused?.id).toBe('Standard');
    expect(focused?.value).toBe(100);

    // And the rendered center swaps the total for the slice info
    const host: HTMLElement = fixture.nativeElement;
    const value = host.querySelector('[data-testid="type-pie-focused-value"]');
    const label = host.querySelector('[data-testid="type-pie-focused-label"]');
    const pct = host.querySelector('[data-testid="type-pie-focused-percent"]');
    expect(value?.textContent?.replace(/\s+/g, '')).toContain('100');
    expect(label?.textContent).toContain('Standard');
    expect(pct?.textContent).toContain('%');
    // Total label is hidden while a slice is focused.
    expect(host.querySelector('[data-testid="type-pie-total"]')).toBeNull();
  });

  it('clicking the same slice twice clears the focus and restores the total', () => {
    component.focusSegment('Standard');
    expect(component.focusedSegment()?.id).toBe('Standard');

    component.focusSegment('Standard');
    expect(component.focusedSegment()).toBeNull();

    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="type-pie-total"]')).toBeTruthy();
  });

  it('clicking a slice in the SVG focuses it via the (click) handler', () => {
    const host: HTMLElement = fixture.nativeElement;
    const slice = host.querySelector(
      '[data-testid="type-pie-slice-Diamond"]'
    ) as SVGElement | null;
    expect(slice).toBeTruthy();
    slice!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.focusedSegment()?.id).toBe('Diamond');
  });

  it('focuses a slice via Enter keydown', () => {
    const host: HTMLElement = fixture.nativeElement;
    const slice = host.querySelector(
      '[data-testid="type-pie-slice-Diamond"]'
    ) as SVGElement | null;
    expect(slice).toBeTruthy();

    slice!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    fixture.detectChanges();

    expect(component.focusedSegment()?.id).toBe('Diamond');
  });

  it('focuses a slice via Space keydown', () => {
    const host: HTMLElement = fixture.nativeElement;
    const slice = host.querySelector(
      '[data-testid="type-pie-slice-Wide"]'
    ) as SVGElement | null;
    expect(slice).toBeTruthy();

    slice!.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );
    fixture.detectChanges();

    expect(component.focusedSegment()?.id).toBe('Wide');
  });

  it('toggling off the focused type clears the focus', () => {
    component.focusSegment('Standard');
    expect(component.focusedSegment()?.id).toBe('Standard');

    // Standard becomes unselected; the focused detail can no longer apply.
    component.toggle('Standard');
    expect(component.focusedSegment()).toBeNull();
  });

  it('does not dim slices when the parent swaps data and evicts the focused id', () => {
    // Given: Standard is focused
    component.focusSegment('Standard');
    fixture.detectChanges();
    expect(component.focusedSegment()?.id).toBe('Standard');

    // When: data swaps to a set that no longer contains Standard
    fixture.componentRef.setInput('data', [
      { label: 'Diamond', value: 80 },
      { label: 'Wide', value: 60 },
    ]);
    fixture.detectChanges();

    // Then: effective focusedId reports null and no rendered slice is dimmed
    expect(component.focusedSegment()).toBeNull();
    expect(component.focusedId()).toBeNull();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll('.seg.dimmed')).toHaveLength(0);
    // Total label is restored too.
    expect(host.querySelector('[data-testid="type-pie-total"]')).toBeTruthy();
  });

  it('renders 0% (not raw count) for a selected slice whose share rounds to zero', () => {
    // Given: a tiny slice that rounds to 0% of the selected total
    fixture.componentRef.setInput('data', [
      { label: 'Standard', value: 1000 },
      { label: 'Spider', value: 2 },
    ]);
    fixture.detectChanges();

    // Spider is selected (top-5 default covers both) but rounds to 0%.
    expect(component.isSelected('Spider')).toBe(true);
    expect(component.legendPercent('Spider')).toBe(0);

    // The legend pct cell renders "0%" instead of falling into the
    // unselected/raw-count branch.
    const host: HTMLElement = fixture.nativeElement;
    const pct = host
      .querySelector('[data-testid="type-pie-toggle-Spider"]')
      ?.closest('.row')
      ?.querySelector('.pct');
    expect(pct?.textContent).toContain('0%');
    expect(pct?.classList.contains('count')).toBe(false);
  });

  it('toggling a checkbox removes the type and drops its slice from the pie', () => {
    // When: Diamond is toggled off
    component.toggle('Diamond');

    // Then: Diamond drops out and the remaining slices still sum to 100%
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.visibleSegments().some((s) => s.id === 'Diamond')).toBe(
      false
    );

    // When: Diamond is re-toggled
    component.toggle('Diamond');

    // Then: it re-enters the selection
    expect(component.isSelected('Diamond')).toBe(true);
  });

  it('toggling a previously-hidden type adds it to the visible set', () => {
    // Given: Spider is initially hidden (rank 6, not in default top 5)
    expect(component.isSelected('Spider')).toBe(false);

    // When: the user opts Spider in
    component.toggle('Spider');

    // Then: Spider is visible and contributes a real slice
    expect(component.isSelected('Spider')).toBe(true);
    expect(component.visibleSegments().some((s) => s.id === 'Spider')).toBe(
      true
    );
  });

  it('clicking a mat-checkbox in the legend wires through to toggle()', async () => {
    // Given: a harness loader for the rendered checkboxes
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const diamondCheckbox = await loader.getHarness(
      MatCheckboxHarness.with({
        selector: '[data-testid="type-pie-toggle-Diamond"]',
      })
    );

    // When: the user toggles the Diamond checkbox via Material's public API
    await diamondCheckbox.toggle();

    // Then: the component's (change) binding flips selection
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);
  });

  it('uses the stable id (not the localized label) for selection and test selectors', () => {
    // Given: data whose label simulates a localized display name
    fixture.componentRef.setInput('data', [
      { id: 'standard', label: 'Standard-Liegestütze', value: 50 },
      { id: 'diamond', label: 'Diamant-Liegestütze', value: 30 },
    ]);
    fixture.detectChanges();

    // Then: selection is keyed by id; data-testids carry the canonical id
    expect([...component.selectedIds()]).toEqual(['standard', 'diamond']);
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="type-pie-toggle-standard"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="type-pie-toggle-diamond"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="type-pie-slice-standard"]')
    ).toBeTruthy();
  });

  it('renders one legend row with checkbox per type plus the Top 5 preset', () => {
    // Then: 7 type rows + 1 preset row
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll(
      '[data-testid="type-pie-legend"] mat-checkbox'
    );
    expect(rows).toHaveLength(8);
  });

  it('legend container caps its height so the list scrolls when many types are present', () => {
    // Given: the legend element rendered for the 7 types in beforeEach
    const host: HTMLElement = fixture.nativeElement;
    const legend = host.querySelector(
      '[data-testid="type-pie-legend"]'
    ) as HTMLElement | null;

    // Then: it has a bounded height with vertical overflow auto so users can scroll
    expect(legend).toBeTruthy();
    const styles = getComputedStyle(legend!);
    expect(styles.overflowY).toBe('auto');
    expect(styles.maxHeight).not.toBe('none');
  });

  it('shows the empty placeholder when total is zero', () => {
    // When: every datum has value 0
    fixture.componentRef.setInput('data', [
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ]);
    fixture.detectChanges();

    // Then
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Keine Daten'
    );
  });

  it('keeps stable colors per index sorted by descending value', () => {
    // Then
    const segments = component.allSegments();
    expect(segments[0].label).toBe('Standard');
    expect(segments[0].color).toBe('#1976d2');
    expect(segments[1].label).toBe('Diamond');
    expect(segments[1].color).toBe('#9c27b0');
  });

  it('renders a Top 5 preset checkbox at the top of the legend, checked by default', () => {
    // Then: the preset row exists and reflects the default top-5 selection
    const host: HTMLElement = fixture.nativeElement;
    const preset = host.querySelector(
      '[data-testid="type-pie-top5"]'
    ) as HTMLElement | null;
    expect(preset).toBeTruthy();
    expect(component.isTopFiveActive()).toBe(true);
  });

  it('clicking the Top 5 preset on a custom subset restores exactly the top-5 ids', () => {
    // Given: user has narrowed selection to a non-top-5 subset
    fixture.componentRef.setInput('data', sevenTypes);
    fixture.detectChanges();
    component.toggle('Spider');
    component.toggle('Standard');
    expect(component.isTopFiveActive()).toBe(false);

    // When: the user activates the Top 5 preset
    component.onTopFiveChange(true);

    // Then: selection collapses back to exactly the 5 highest-value ids
    expect(component.isTopFiveActive()).toBe(true);
    expect([...component.selectedIds()].sort()).toEqual(
      ['Decline', 'Diamond', 'Knee', 'Standard', 'Wide'].sort()
    );
  });

  it('unchecking the Top 5 preset expands the selection so selectedTotal equals the grand total', () => {
    // Given: default state (top 5 active)
    expect(component.isTopFiveActive()).toBe(true);

    // When: user unchecks the preset
    component.onTopFiveChange(false);

    // Then: every type contributes; selected total equals the grand total
    expect(component.selectedIds().size).toBe(7);
    expect(component.selectedTotal()).toBe(component.total());
    expect(component.isTopFiveActive()).toBe(false);
  });

  it('Top 5 preset checkbox harness toggles selection', async () => {
    // Given: user narrowed to one type
    component.toggle('Diamond');
    component.toggle('Wide');
    component.toggle('Decline');
    component.toggle('Knee');
    expect(component.selectedIds().size).toBe(1);

    // When: the preset checkbox is toggled via Material's harness
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const top5 = await loader.getHarness(
      MatCheckboxHarness.with({
        selector: '[data-testid="type-pie-top5"]',
      })
    );
    await top5.toggle();
    fixture.detectChanges();

    // Then: selection snaps back to the top 5
    expect(component.isTopFiveActive()).toBe(true);
  });

  it('removing the last selected type empties the pie and shows the no-selection placeholder', () => {
    // When: the user unchecks every default-selected type
    for (const id of [...component.selectedIds()]) {
      component.toggle(id);
    }
    fixture.detectChanges();

    // Then: the pie has no slices, the selected total is zero, and the
    // donut center shows the no-selection placeholder.
    expect(component.selectedIds().size).toBe(0);
    expect(component.visibleSegments()).toHaveLength(0);
    expect(component.selectedTotal()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Keine Auswahl'
    );
  });
});
