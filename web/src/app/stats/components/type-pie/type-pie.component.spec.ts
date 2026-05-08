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
