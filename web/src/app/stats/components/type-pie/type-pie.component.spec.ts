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

  it('defaults to Top 5 mode and selects the five highest-value ids', () => {
    // Then
    expect(component.mode()).toBe('top5');
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

  it('switches to Alle mode when toggled, selecting every id and dropping the Other arc', () => {
    // When
    component.setMode('all');

    // Then
    expect(component.selectedIds().size).toBe(7);
    expect(component.visibleSegments()).toHaveLength(7);
    expect(component.otherPercent()).toBe(0);
  });

  it('toggling a checkbox switches mode to custom and updates the subset', () => {
    // When: Diamond is toggled
    component.toggle('Diamond');

    // Then: mode flips to custom and Diamond drops out
    expect(component.mode()).toBe('custom');
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);

    // When: Diamond is re-toggled
    component.toggle('Diamond');

    // Then: it re-enters the selection
    expect(component.isSelected('Diamond')).toBe(true);
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

    // Then: the component's (change) binding flips mode and selection
    expect(component.mode()).toBe('custom');
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);
  });

  it('seeds custom selection from the current visible set when entering Auswahl via the toggle', () => {
    // When: switching directly from Top 5 to custom
    component.setMode('custom');

    // Then: the top-5 selection is preserved instead of starting empty,
    // and the Other arc still completes the circle.
    expect(component.mode()).toBe('custom');
    expect([...component.selectedIds()]).toEqual([
      'Standard',
      'Diamond',
      'Wide',
      'Decline',
      'Knee',
    ]);
    expect(component.visibleSegments()).toHaveLength(6);
    expect(component.visibleSegments().at(-1)?.id).toBe('__other__');
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

  it('switching from Alle to Auswahl seeds custom selection with every label', () => {
    // When
    component.setMode('all');
    component.setMode('custom');

    // Then
    expect(component.selectedIds().size).toBe(7);
  });

  it('renders one legend row with checkbox per type, regardless of mode', () => {
    // Then
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll(
      '[data-testid="type-pie-legend"] mat-checkbox'
    );
    expect(rows).toHaveLength(7);
  });

  it('exposes toggle hooks per label so the legend can drive subset selection', () => {
    // Then
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="type-pie-toggle-Standard"]')
    ).toBeTruthy();
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
});
