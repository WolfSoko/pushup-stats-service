import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PointerEventsCheckLevel } from '@testing-library/user-event';
import { QuickAddFabComponent } from './quick-add-fab.component';

describe('QuickAddFabComponent — goal dial item', () => {
  async function renderFab(inputs: {
    suggestions?: number[];
    remainingToGoal?: number;
    goalReached?: boolean;
    fillToGoalInFlight?: boolean;
  }) {
    const quickAdd = jest.fn();
    const openDialog = jest.fn();
    const openFeedback = jest.fn();
    const fillToGoal = jest.fn();

    // Material disabled buttons set pointer-events:none; skip that check so
    // userEvent.click() doesn't throw when verifying disabled state.
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });

    const view = await render(QuickAddFabComponent, {
      inputs: {
        suggestions: inputs.suggestions ?? [5, 10, 15],
        remainingToGoal: inputs.remainingToGoal ?? 0,
        goalReached: inputs.goalReached ?? false,
        fillToGoalInFlight: inputs.fillToGoalInFlight ?? false,
      },
      on: { quickAdd, openDialog, openFeedback, fillToGoal },
    });

    const mainFab = screen.getByRole('button', {
      name: /Schnellerfassung öffnen/i,
    });
    await user.click(mainFab);

    return { view, user, quickAdd, openDialog, openFeedback, fillToGoal };
  }

  it('Given remainingToGoal=42 and goalReached=false, Then goal item renders with label containing 42', async () => {
    await renderFab({ remainingToGoal: 42, goalReached: false });

    expect(screen.getByText(/\+42 bis zum Ziel/)).toBeTruthy();
  });

  it('Given remainingToGoal=42, When the goal item is clicked, Then fillToGoal is emitted and dial closes', async () => {
    const { user, fillToGoal } = await renderFab({ remainingToGoal: 42 });

    const button = screen.getByRole('button', {
      name: /Liegestütze bis zum Tagesziel/i,
    });
    await user.click(button);

    expect(fillToGoal).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/\+42 bis zum Ziel/)).toBeNull();
  });

  it('Given goalReached=true, Then the goal item is rendered but disabled', async () => {
    const { user, fillToGoal } = await renderFab({
      remainingToGoal: 0,
      goalReached: true,
    });

    const button = screen.getByRole('button', {
      name: /Tagesziel bereits erreicht/i,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(fillToGoal).not.toHaveBeenCalled();
  });

  it('Given remainingToGoal=0 and goalReached=false, Then no goal item is rendered', async () => {
    await renderFab({ remainingToGoal: 0, goalReached: false });

    expect(screen.queryByText(/bis zum Ziel/)).toBeNull();
    expect(screen.queryByText(/Ziel erreicht/)).toBeNull();
  });

  it('Given fillToGoalInFlight=true, Then the goal item is disabled', async () => {
    const { user, fillToGoal } = await renderFab({
      remainingToGoal: 42,
      fillToGoalInFlight: true,
    });

    const button = screen.getByRole('button', {
      name: /Liegestütze bis zum Tagesziel/i,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(fillToGoal).not.toHaveBeenCalled();
  });

  it('Given suggestions, Then the three quick-rep items still render', async () => {
    await renderFab({
      suggestions: [5, 10, 15],
      remainingToGoal: 42,
    });

    expect(screen.getByText('+5 Reps')).toBeTruthy();
    expect(screen.getByText('+10 Reps')).toBeTruthy();
    expect(screen.getByText('+15 Reps')).toBeTruthy();
  });
});
