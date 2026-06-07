import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { QuickAddFabCoachmarkComponent } from './quick-add-fab-coachmark.component';

describe('QuickAddFabCoachmarkComponent', () => {
  it('should render the tutorial title and body', async () => {
    // given / when
    await render(QuickAddFabCoachmarkComponent);

    // then
    expect(screen.getByText('Schnellerfassung')).toBeTruthy();
    expect(
      screen.getByText(/erfasst du Übungen blitzschnell/i)
    ).toBeTruthy();
  });

  it('should emit dismiss when the primary button is clicked', async () => {
    // given
    const dismiss = jest.fn();
    await render(QuickAddFabCoachmarkComponent, {
      on: { dismiss },
    });

    // when
    await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }));

    // then
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('should emit dismiss when the close icon is clicked', async () => {
    // given
    const dismiss = jest.fn();
    await render(QuickAddFabCoachmarkComponent, {
      on: { dismiss },
    });

    // when
    await userEvent.click(
      screen.getByRole('button', { name: 'Tutorial schließen' })
    );

    // then
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
