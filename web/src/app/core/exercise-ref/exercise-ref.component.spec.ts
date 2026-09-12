import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ExerciseRefComponent } from './exercise-ref.component';

interface ExerciseRefInputs {
  exerciseId?: string;
  variantId?: string | null;
  label?: string | null;
  showIcon?: boolean;
  variant?: 'text' | 'chip';
}

async function setup(inputs: ExerciseRefInputs = {}) {
  await render(ExerciseRefComponent, {
    inputs: { exerciseId: 'legs.squats', ...inputs },
    providers: [provideRouter([])],
  });
}

describe('ExerciseRefComponent', () => {
  it('should render the resolved exercise name as a link to its wiki entry', async () => {
    // given / when
    await setup();
    // then
    const link = screen.getByRole('link', { name: 'Kniebeugen' });
    expect(link.getAttribute('href')).toBe('/wiki/uebungen/squats');
  });

  it('should prefer an explicit label over the resolved name', async () => {
    // given / when
    await setup({ label: 'Kniebeugen · Sumo' });
    // then
    expect(screen.getByText('Kniebeugen · Sumo')).toBeTruthy();
  });

  it('should show a help icon by default', async () => {
    // given / when
    await setup();
    // then
    expect(document.querySelector('mat-icon')).toBeTruthy();
  });

  it('should route pushup entries to the pushup-types wiki', async () => {
    // given / when
    await setup({ exerciseId: 'pushup', variantId: 'diamond' });
    // then
    const link = screen.getByRole('link', { name: 'Diamant-Liegestütze' });
    expect(link.getAttribute('href')).toBe('/wiki/liegestuetz-typen/diamant');
  });

  it('should hide the help icon when showIcon is false', async () => {
    // given / when
    await setup({ showIcon: false });
    // then
    expect(document.querySelector('mat-icon')).toBeNull();
  });
});
