import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PointerEventsCheckLevel } from '@testing-library/user-event';
import {
  QuickAddFabComponent,
  type QuickAddGoalItem,
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
    goalItems?: QuickAddGoalItem[];
  }) {
    const quickAdd = jest.fn();
    const openDialog = jest.fn();
    const openFeedback = jest.fn();
    const fillToGoal = jest.fn();
    const openAutoCount = jest.fn();
    const openExerciseTimer = jest.fn();
    const fillGoalItem = jest.fn();
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
        goalItems: inputs.goalItems ?? [],
      },
      on: {
        quickAdd,
        openDialog,
        openFeedback,
        fillToGoal,
        openAutoCount,
        openExerciseTimer,
        fillGoalItem,
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
      fillGoalItem,
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

describe('QuickAddFabComponent — goal submenu', () => {
  async function renderWithGoals(goalItems: QuickAddGoalItem[]) {
    const fillGoalItem = jest.fn();
    const fillToGoal = jest.fn();
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await render(QuickAddFabComponent, {
      inputs: {
        suggestions: [],
        remainingToGoal: 0,
        goalReached: false,
        fillToGoalInFlight: false,
        autoCountEnabled: false,
        goalItems,
      },
      on: { fillGoalItem, fillToGoal },
    });
    await user.click(
      screen.getByRole('button', { name: /Schnellerfassung öffnen/i })
    );
    return { user, fillGoalItem, fillToGoal };
  }

  function goal(overrides: Partial<QuickAddGoalItem> = {}): QuickAddGoalItem {
    return {
      id: 'g1',
      label: 'Liegestütze +40',
      ariaLabel: '40 Liegestütze bis zum Tagesziel hinzufügen',
      reached: false,
      disabled: false,
      ...overrides,
    };
  }

  it('should offer a submenu instead of a single fill button when several goals apply', async () => {
    // given two daily goals
    const { user } = await renderWithGoals([
      goal(),
      goal({ id: 'g2', label: 'Kniebeugen +20', ariaLabel: '20 Kniebeugen' }),
    ]);

    // when the goal entry is opened
    expect(screen.queryByTestId('quick-add-goal-submenu')).toBeNull();
    await user.click(screen.getByTestId('quick-add-goal-menu-toggle'));

    // then every goal is listed
    expect(screen.getByTestId('quick-add-goal-submenu')).toBeTruthy();
    expect(screen.getAllByTestId('quick-add-goal-submenu-item').length).toBe(2);
    expect(screen.getByText('Liegestütze +40')).toBeTruthy();
    expect(screen.getByText('Kniebeugen +20')).toBeTruthy();
  });

  it('should emit the picked goal id and close the dial', async () => {
    // given an open submenu
    const { user, fillGoalItem } = await renderWithGoals([
      goal(),
      goal({ id: 'g2', label: 'Kniebeugen +20', ariaLabel: '20 Kniebeugen' }),
    ]);
    await user.click(screen.getByTestId('quick-add-goal-menu-toggle'));

    // when a goal is picked
    await user.click(screen.getByText('Kniebeugen +20'));

    // then the id round-trips back and the dial closes
    expect(fillGoalItem).toHaveBeenCalledWith('g2');
    expect(screen.queryByTestId('quick-add-goal-submenu')).toBeNull();
  });

  it('should render a goal that cannot be filled as disabled', async () => {
    // given one reached and one manual-entry-only goal
    const { user, fillGoalItem } = await renderWithGoals([
      goal({ reached: true, disabled: true }),
      goal({ id: 'g2', label: 'Laufen +2.00 km', disabled: true }),
    ]);
    await user.click(screen.getByTestId('quick-add-goal-menu-toggle'));

    // when a disabled goal is clicked
    const items = screen.getAllByTestId(
      'quick-add-goal-submenu-item'
    ) as HTMLButtonElement[];
    expect(items.every((b) => b.disabled)).toBe(true);
    await user.click(items[1]);

    // then nothing is emitted
    expect(fillGoalItem).not.toHaveBeenCalled();
  });

  it("should fill the day's only goal in its own measurement", async () => {
    // given exactly one goal, and no pushup gap of its own
    const fillGoalItem = jest.fn();
    const fillToGoal = jest.fn();
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await render(QuickAddFabComponent, {
      inputs: {
        suggestions: [],
        remainingToGoal: 0,
        goalReached: false,
        fillToGoalInFlight: false,
        autoCountEnabled: false,
        goalItems: [goal({ id: 'squats', label: 'Kniebeugen +20' })],
      },
      on: { fillGoalItem, fillToGoal },
    });
    await user.click(
      screen.getByRole('button', { name: /Schnellerfassung öffnen/i })
    );

    // when the goal entry is used
    await user.click(screen.getByTestId('quick-add-goal-single'));

    // then the goal itself is filled, not the legacy pushup gap
    expect(fillGoalItem).toHaveBeenCalledWith('squats');
    expect(fillToGoal).not.toHaveBeenCalled();
  });

  it('should keep the legacy fill button when no goal breakdown is available', async () => {
    // given a single goal and an open pushup gap
    const fillToGoal = jest.fn();
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    });
    await render(QuickAddFabComponent, {
      inputs: {
        suggestions: [],
        remainingToGoal: 42,
        goalReached: false,
        fillToGoalInFlight: false,
        autoCountEnabled: false,
        goalItems: [],
      },
      on: { fillToGoal },
    });
    await user.click(
      screen.getByRole('button', { name: /Schnellerfassung öffnen/i })
    );

    // when the goal entry is clicked
    await user.click(
      screen.getByRole('button', { name: /Liegestütze bis zum Tagesziel/i })
    );

    // then the legacy one-tap fill still runs
    expect(fillToGoal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('quick-add-goal-submenu')).toBeNull();
  });
});
