import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PointerEventsCheckLevel } from '@testing-library/user-event';
import {
  QuickAddFabComponent,
  type QuickAddSuggestion,
} from './quick-add-fab.component';

function pushupSuggestion(reps: number): QuickAddSuggestion {
  return {
    key: `pushup:${reps}`,
    reps,
    label: `+${reps} Liegestütze`,
    ariaLabel: `${reps} Liegestütze hinzufügen`,
    exerciseId: 'pushup',
  };
}

describe('QuickAddFabComponent — goal dial item', () => {
  async function renderFab(inputs: {
    suggestions?: QuickAddSuggestion[];
    remainingToGoal?: number;
    goalReached?: boolean;
    fillToGoalInFlight?: boolean;
    autoCountEnabled?: boolean;
  }) {
    const quickAdd = jest.fn();
    const openDialog = jest.fn();
    const openFeedback = jest.fn();
    const fillToGoal = jest.fn();
    const openAutoCount = jest.fn();
    const openExerciseTimer = jest.fn();
    const opened = jest.fn();

    // Material disabled buttons set pointer-events:none; skip that check so
    // userEvent.click() doesn't throw when verifying disabled state.
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });

    const view = await render(QuickAddFabComponent, {
      inputs: {
        suggestions:
          inputs.suggestions ?? [5, 10, 15].map((r) => pushupSuggestion(r)),
        remainingToGoal: inputs.remainingToGoal ?? 0,
        goalReached: inputs.goalReached ?? false,
        fillToGoalInFlight: inputs.fillToGoalInFlight ?? false,
        autoCountEnabled: inputs.autoCountEnabled ?? false,
      },
      on: {
        quickAdd,
        openDialog,
        openFeedback,
        fillToGoal,
        openAutoCount,
        openExerciseTimer,
        opened,
      },
    });

    const mainFab = screen.getByRole('button', {
      name: /Schnellerfassung öffnen/i,
    });
    await user.click(mainFab);

    return {
      view,
      user,
      quickAdd,
      openDialog,
      openFeedback,
      fillToGoal,
      openAutoCount,
      openExerciseTimer,
      opened,
    };
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
      suggestions: [5, 10, 15].map((r) => pushupSuggestion(r)),
      remainingToGoal: 42,
    });

    expect(screen.getByText('+5 Liegestütze')).toBeTruthy();
    expect(screen.getByText('+10 Liegestütze')).toBeTruthy();
    expect(screen.getByText('+15 Liegestütze')).toBeTruthy();
  });

  it('Given a non-pushup suggestion, Then its localised label renders without an exercise icon', async () => {
    const situps: QuickAddSuggestion = {
      key: 'abs.situps:10',
      reps: 10,
      label: '+10 Sit-ups',
      ariaLabel: '10 Sit-ups hinzufügen',
      exerciseId: 'abs.situps',
    };
    await renderFab({ suggestions: [situps] });

    expect(screen.getByText('+10 Sit-ups')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: /10 Sit-ups hinzufügen/i,
    });
    expect(button).toBeTruthy();
    expect(button.querySelector('mat-icon')).toBeNull();
  });

  it('When a quick item is clicked, Then the full suggestion is emitted', async () => {
    const situps: QuickAddSuggestion = {
      key: 'abs.situps:10',
      reps: 10,
      label: '+10 Sit-ups',
      ariaLabel: '10 Sit-ups hinzufügen',
      exerciseId: 'abs.situps',
    };
    const { user, quickAdd } = await renderFab({ suggestions: [situps] });

    const button = screen.getByRole('button', {
      name: /10 Sit-ups hinzufügen/i,
    });
    await user.click(button);

    expect(quickAdd).toHaveBeenCalledTimes(1);
    expect(quickAdd).toHaveBeenCalledWith(situps);
  });

  it('When the main FAB opens the dial, Then opened is emitted once', async () => {
    const { opened } = await renderFab({ remainingToGoal: 42 });

    // renderFab already clicked once to open the dial.
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('When the main FAB closes the dial, Then opened is not emitted', async () => {
    const { user, opened } = await renderFab({ remainingToGoal: 42 });
    opened.mockClear();

    const closeFab = screen.getByRole('button', {
      name: /Schnellerfassung schließen/i,
    });
    await user.click(closeFab);

    expect(opened).not.toHaveBeenCalled();
  });

  it('Given autoCountEnabled=false, Then no auto-count item is rendered', async () => {
    await renderFab({ autoCountEnabled: false });

    expect(
      screen.queryByRole('button', {
        name: /Liegestütze automatisch zählen/i,
      })
    ).toBeNull();
  });

  it('Given autoCountEnabled=true, When the auto-count item is clicked, Then openAutoCount is emitted and dial closes', async () => {
    const { user, openAutoCount } = await renderFab({
      autoCountEnabled: true,
    });

    const button = screen.getByRole('button', {
      name: /Liegestütze automatisch zählen/i,
    });
    await user.click(button);

    expect(openAutoCount).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', {
        name: /Liegestütze automatisch zählen/i,
      })
    ).toBeNull();
  });

  it('When the exercise-timer item is clicked, Then openExerciseTimer is emitted and the dial closes', async () => {
    const { user, openExerciseTimer } = await renderFab({});

    const button = screen.getByRole('button', {
      name: /Halteübungs-Timer öffnen/i,
    });
    await user.click(button);

    expect(openExerciseTimer).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', {
        name: /Halteübungs-Timer öffnen/i,
      })
    ).toBeNull();
  });

  it('When the dial is opened a second time, Then opened is emitted again', async () => {
    const { user, opened } = await renderFab({ remainingToGoal: 42 });
    // Close.
    await user.click(
      screen.getByRole('button', { name: /Schnellerfassung schließen/i })
    );
    opened.mockClear();

    // Re-open.
    await user.click(
      screen.getByRole('button', { name: /Schnellerfassung öffnen/i })
    );

    expect(opened).toHaveBeenCalledTimes(1);
  });
});
