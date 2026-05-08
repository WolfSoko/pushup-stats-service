import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    await TestBed.configureTestingModule({
      imports: [TypePieComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TypePieComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', sevenTypes);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('defaults to Top 5 mode and selects the five highest-value labels', () => {
    expect(component.mode()).toBe('top5');
    const selected = [...component.selectedLabels()];
    expect(selected).toEqual([
      'Standard',
      'Diamond',
      'Wide',
      'Decline',
      'Knee',
    ]);
    expect(component.visibleSegments()).toHaveLength(5);
  });

  it('switches to Alle mode when toggled, selecting every label', () => {
    component.setMode('all');
    expect(component.selectedLabels().size).toBe(7);
    expect(component.visibleSegments()).toHaveLength(7);
  });

  it('toggling a checkbox switches mode to custom and updates the subset', () => {
    component.toggle('Diamond');

    expect(component.mode()).toBe('custom');
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);
    // Re-toggling re-selects.
    component.toggle('Diamond');
    expect(component.isSelected('Diamond')).toBe(true);
  });

  it('clicking a mat-checkbox in the legend wires through to toggle()', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    // mat-checkbox renders an inner native input — clicking it fires (change).
    const diamondInput = host.querySelector<HTMLInputElement>(
      '[data-testid="type-pie-toggle-Diamond"] input[type="checkbox"]'
    );
    expect(diamondInput).toBeTruthy();
    diamondInput?.click();
    fixture.detectChanges();

    expect(component.mode()).toBe('custom');
    expect(component.isSelected('Diamond')).toBe(false);
    expect(component.isSelected('Standard')).toBe(true);
  });

  it('seeds custom selection from the current visible set when entering Auswahl via the toggle', () => {
    // Switching directly from Top 5 to custom should preserve the top-5
    // selection so the pie doesn't render empty until the user toggles
    // anything manually.
    component.setMode('custom');

    expect(component.mode()).toBe('custom');
    expect([...component.selectedLabels()]).toEqual([
      'Standard',
      'Diamond',
      'Wide',
      'Decline',
      'Knee',
    ]);
    expect(component.visibleSegments()).toHaveLength(5);
  });

  it('switching from Alle to Auswahl seeds custom selection with every label', () => {
    component.setMode('all');
    component.setMode('custom');

    expect(component.selectedLabels().size).toBe(7);
  });

  it('renders one legend row with checkbox per type, regardless of mode', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll(
      '[data-testid="type-pie-legend"] mat-checkbox'
    );
    expect(rows).toHaveLength(7);
  });

  it('exposes toggle hooks per label so the legend can drive subset selection', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const standard = host.querySelector(
      '[data-testid="type-pie-toggle-Standard"]'
    );
    expect(standard).toBeTruthy();
  });

  it('shows the empty placeholder when total is zero', () => {
    fixture.componentRef.setInput('data', [
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ]);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Keine Daten');
  });

  it('keeps stable colors per index sorted by descending value', () => {
    const segments = component.allSegments();
    expect(segments[0].label).toBe('Standard');
    expect(segments[0].color).toBe('#1976d2');
    expect(segments[1].label).toBe('Diamond');
    expect(segments[1].color).toBe('#9c27b0');
  });
});
