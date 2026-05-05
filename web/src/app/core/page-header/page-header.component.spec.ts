import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `
    <app-page-header icon="insights" variant="analysis">
      <h1 page-title>Analyse</h1>
      <p page-subtitle>Trends und Streaks</p>
      <button page-actions type="button">Teilen</button>
    </app-page-header>
  `,
})
class HostComponent {}

@Component({
  imports: [PageHeaderComponent],
  template: `
    <app-page-header>
      <h1 page-title>Standard</h1>
    </app-page-header>
  `,
})
class BareHostComponent {}

describe('PageHeaderComponent', () => {
  it('given a host providing projected slots, when rendered, then projects title, subtitle and actions', async () => {
    await render(HostComponent);

    expect(screen.getByRole('heading', { name: 'Analyse' })).toBeTruthy();
    expect(screen.getByText('Trends und Streaks')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Teilen' })).toBeTruthy();
    expect(screen.getByText('Pushup Stats')).toBeTruthy();
  });

  it('given a variant input, when rendered, then exposes the variant via data-variant for theming', async () => {
    await render(HostComponent);
    const header = document.querySelector('.page-header');
    expect(header?.getAttribute('data-variant')).toBe('analysis');
  });

  it('given an icon input, when rendered, then renders a mat-icon inside the header', async () => {
    await render(HostComponent);
    const icon = document.querySelector('.page-header-icon mat-icon');
    expect(icon?.textContent?.trim()).toBe('insights');
  });

  it('given no icon input, when rendered, then omits the icon span', async () => {
    await render(BareHostComponent);
    expect(document.querySelector('.page-header-icon')).toBeNull();
  });

  it('given no variant input, when rendered, then exposes the default variant', async () => {
    await render(BareHostComponent);
    const header = document.querySelector('.page-header');
    expect(header?.getAttribute('data-variant')).toBe('default');
  });
});
