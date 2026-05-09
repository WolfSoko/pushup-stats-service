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
    // 5 selected + an explicit "Other" arc covering the unselected
    // remainder so the rendered pie always reads as a complete circle.
    expect(component.visibleSegments()).toHaveLength(6);
    expect(component.visibleSegments().at(-1)?.id).toBe('__other__');
    expect(component.otherPercent()).toBeGreaterThan(0);
  });

  it('toggling a checkbox removes the type and drops its slice from the pie', () => {
    // When: Diamond is toggled off
    component.toggle('Diamond');

    // Then: Diamond drops out, Standard remains
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);

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

    // Then: Spider is visible and contributes a real slice (not "Other")
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

  it('unchecking the Top 5 preset expands the selection to all types', () => {
    // Given: default state (top 5 active)
    expect(component.isTopFiveActive()).toBe(true);

    // When: user unchecks the preset
    component.onTopFiveChange(false);

    // Then: every type is selected, no Other arc
    expect(component.selectedIds().size).toBe(7);
    expect(component.otherPercent()).toBe(0);
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

  it('removing the last selected type empties the pie and treats all data as Other', () => {
    // When: the user unchecks every default-selected type
    for (const id of [...component.selectedIds()]) {
      component.toggle(id);
    }

    // Then: the visible set is just the synthetic Other arc covering 100%
    expect(component.selectedIds().size).toBe(0);
    expect(component.visibleSegments()).toHaveLength(1);
    expect(component.visibleSegments()[0].id).toBe('__other__');
    expect(component.otherPercent()).toBe(100);
  });
});
