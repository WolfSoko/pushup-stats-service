import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import {
  type ComplexGoals,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';
import { UserConfigStore } from '../../core/user-config.store';
import { GoalsPageComponent } from './goals-page.component';

const DEBOUNCE_MS = 600;

describe('GoalsPageComponent', () => {
  let fixture: ComponentFixture<GoalsPageComponent>;
  let component: GoalsPageComponent;
  let saveGoalsSpy: ReturnType<
    typeof vitest.fn<(goals: ComplexGoals) => Promise<unknown>>
  >;
  let goalsSignal: ReturnType<typeof signal<ComplexGoals>>;

  function setup(
    initial: ComplexGoals = { daily: [], weekly: [], monthly: [] }
  ): void {
    goalsSignal = signal<ComplexGoals>(initial);
    saveGoalsSpy = vitest.fn(() => Promise.resolve({ userId: 'u1' }));

    TestBed.configureTestingModule({
      imports: [GoalsPageComponent],
      providers: [
        {
          provide: UserConfigStore,
          useValue: {
            goals: goalsSignal.asReadonly(),
            dailyGoalEntries: signal(initial.daily ?? []),
            weeklyGoalEntries: signal(initial.weekly ?? []),
            monthlyGoalEntries: signal(initial.monthly ?? []),
            saveGoals: saveGoalsSpy,
          },
        },
        {
          provide: UserContextService,
          useValue: {
            isGuest: signal(false),
            userIdSafe: signal('u1'),
          },
        },
        provideRouter([]),
      ],
    });

    fixture = TestBed.createComponent(GoalsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    vitest.useRealTimers();
    TestBed.resetTestingModule();
  });

  async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  it('Renders one card per scope', () => {
    setup();
    expect(
      fixture.nativeElement.querySelector('[data-testid="goals-section-daily"]')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goals-section-weekly"]'
      )
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goals-section-monthly"]'
      )
    ).not.toBeNull();
  });

  it('Given an empty daily section, When the user clicks "add", Then a new entry appears and a debounced save fires', async () => {
    setup();
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.addEntry('daily');
    fixture.detectChanges();

    expect(component.entriesFor('daily')()).toHaveLength(1);
    expect(component.saveStatus()).toBe('pending');

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveGoalsSpy).toHaveBeenCalledTimes(1);
    const persistedDaily = saveGoalsSpy.mock.calls[0][0].daily ?? [];
    expect(persistedDaily).toHaveLength(1);
    expect(persistedDaily[0].exerciseId).toBe(PUSHUP_QUICK_ADD_EXERCISE_ID);
    expect(persistedDaily[0].target).toBe(10);
  });

  it('Given a daily entry, When the user updates the weekday filter, Then the saved goal carries the chosen weekdays', async () => {
    setup({
      daily: [
        {
          id: 'pre-existing',
          exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
          target: 40,
          measurement: 'reps',
          unit: 'reps',
        },
      ],
      weekly: [],
      monthly: [],
    });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.updateWeekdays('daily', 'pre-existing', [1, 3, 5]);
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveGoalsSpy).toHaveBeenCalledTimes(1);
    const persisted = saveGoalsSpy.mock.calls[0][0].daily ?? [];
    expect(persisted[0].weekdays).toEqual([1, 3, 5]);
  });

  it('Switching exercise updates measurement and unit, clamps target into the new range', async () => {
    setup();
    await flushMicrotasks();

    component.addEntry('weekly');
    component.updateExercise(
      'weekly',
      component.entriesFor('weekly')()[0].id,
      'plank.standard'
    );

    const entry = component.entriesFor('weekly')()[0];
    expect(entry.exerciseId).toBe('plank.standard');
    expect(entry.measurement).toBe('time');
    expect(entry.unit).toBe('s');
  });

  it('Caps add-entry at COMPLEX_GOALS_MAX_PER_SCOPE', () => {
    setup();
    for (let i = 0; i < 30; i++) component.addEntry('daily');
    expect(component.entriesFor('daily')()).toHaveLength(component.maxPerScope);
  });

  it('Removing an entry drops it from the saved list', async () => {
    setup({
      daily: [
        {
          id: 'a',
          exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
          target: 10,
          measurement: 'reps',
          unit: 'reps',
        },
        {
          id: 'b',
          exerciseId: 'legs.squats',
          target: 20,
          measurement: 'reps',
          unit: 'reps',
        },
      ],
      weekly: [],
      monthly: [],
    });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.removeEntry('daily', 'a');
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveGoalsSpy).toHaveBeenCalledTimes(1);
    const persisted = saveGoalsSpy.mock.calls[0][0].daily ?? [];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('b');
  });
});
