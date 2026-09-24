import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { WorkoutsApiService } from '@pu-stats/data-access';
import type { Workout, WorkoutInput } from '@pu-stats/models';
import { BehaviorSubject, Subject } from 'rxjs';

import { WorkoutShareApiService } from './workout-share-api.service';
import { WorkoutsStore } from './workouts.store';

const WORKOUT: Workout = {
  id: 'w1',
  ownerId: 'u1',
  title: 'Kurz',
  description: '',
  exercises: [{ exerciseId: 'pushup', target: 20 }],
  onProfile: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const VALID_INPUT: WorkoutInput = {
  title: 'Neu',
  description: '',
  exercises: [{ exerciseId: 'pushup', target: 10 }],
  onProfile: false,
};

function setup(
  options: { userId?: string; workouts?: Workout[]; pending?: boolean } = {}
) {
  const list$ = options.pending
    ? new Subject<ReadonlyArray<Workout>>()
    : new BehaviorSubject<ReadonlyArray<Workout>>(
        options.workouts ?? [WORKOUT]
      );
  const api = {
    listWorkouts: vitest.fn(() => list$.asObservable()),
    createWorkout: vitest.fn().mockResolvedValue('new-id'),
    updateWorkout: vitest.fn().mockResolvedValue(undefined),
    deleteWorkout: vitest.fn().mockResolvedValue(undefined),
    setOnProfile: vitest.fn().mockResolvedValue(undefined),
  };
  const share = { share: vitest.fn().mockResolvedValue({ ok: true, sent: 2 }) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: WorkoutsApiService, useValue: api },
      { provide: WorkoutShareApiService, useValue: share },
      {
        provide: UserContextService,
        useValue: { userIdSafe: () => options.userId ?? 'u1' },
      },
    ],
  });
  return { store: TestBed.inject(WorkoutsStore), api, share, list$ };
}

async function flush(): Promise<void> {
  TestBed.tick();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  TestBed.tick();
}

describe('WorkoutsStore', () => {
  it('should mirror the live list and find a workout by id', async () => {
    // given
    const { store } = setup();

    // when
    await flush();

    // then
    expect(store.loaded()).toBe(true);
    expect(store.count()).toBe(1);
    expect(store.workoutById('w1')).toEqual(WORKOUT);
    expect(store.workoutById('nope')).toBeNull();
  });

  it('should create a valid workout and hand back its id', async () => {
    // given
    const { store, api } = setup();
    await flush();

    // when
    const id = await store.create(VALID_INPUT);

    // then
    expect(id).toBe('new-id');
    expect(api.createWorkout).toHaveBeenCalledWith('u1', VALID_INPUT);
    expect(store.lastRejection()).toBeUndefined();
  });

  it('should refuse an invalid workout before it reaches Firestore', async () => {
    // given
    const { store, api } = setup();
    await flush();

    // when
    const id = await store.create({ ...VALID_INPUT, exercises: [] });

    // then
    expect(id).toBeNull();
    expect(store.lastRejection()).toBe('no-exercises');
    expect(api.createWorkout).not.toHaveBeenCalled();
  });

  it('should not count the workout being edited against the limit', async () => {
    // given — 50 workouts, one of them under edit
    const many = Array.from({ length: 50 }, (_, i) => ({
      ...WORKOUT,
      id: `w${i}`,
    }));
    const { store, api } = setup({ workouts: many });
    await flush();

    // when
    const updated = await store.update('w3', VALID_INPUT);
    const created = await store.create(VALID_INPUT);

    // then
    expect(updated).toBe(true);
    expect(api.updateWorkout).toHaveBeenCalledWith('u1', 'w3', VALID_INPUT);
    expect(created).toBeNull();
    expect(store.lastRejection()).toBe('limit');
  });

  it('should report a thrown write as failed', async () => {
    // given
    const { store, api } = setup();
    await flush();
    api.deleteWorkout.mockRejectedValueOnce(new Error('offline'));

    // when
    const ok = await store.remove('w1');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('failed');
    expect(store.isBusy('remove:w1')).toBe(false);
  });

  it('should keep only the pressed action busy until its write settles', async () => {
    // given — a delete Firestore has not acknowledged yet
    let settle: () => void = () => undefined;
    const { store, api } = setup();
    await flush();
    api.deleteWorkout.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );

    // when
    const done = store.remove('w1');

    // then — this card's delete spins; its other buttons and other cards do not
    expect(store.isBusy('remove:w1')).toBe(true);
    expect(store.busyKeys().has('remove:w1')).toBe(true);
    expect(store.isBusy('share:w1')).toBe(false);
    expect(store.isBusy('remove:w2')).toBe(false);

    // when
    settle();
    await done;

    // then
    expect(store.isBusy('remove:w1')).toBe(false);
    expect(store.busyKeys().size).toBe(0);
  });

  it('should key a create and an update apart from each other', async () => {
    // given
    const { store, api } = setup();
    await flush();
    api.createWorkout.mockReturnValue(new Promise(() => undefined));

    // when
    void store.create(VALID_INPUT);

    // then
    expect(store.isBusy('create')).toBe(true);
    expect(store.isBusy('update:w1')).toBe(false);
  });

  it('should share through the callable and remember how many got it', async () => {
    // given
    const { store, share } = setup();
    await flush();

    // when
    const ok = await store.share('w1', ['f1', 'f2']);

    // then
    expect(ok).toBe(true);
    expect(share.share).toHaveBeenCalledWith('w1', ['f1', 'f2']);
    expect(store.lastShared()).toBe(2);
  });

  it('should keep the server’s reason for a refused share', async () => {
    // given
    const { store, share } = setup();
    await flush();
    share.share.mockResolvedValueOnce({ ok: false, reason: 'not-friends' });

    // when
    const ok = await store.share('w1', ['stranger']);

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('not-friends');
  });

  it('should import a profile workout as a private copy with its source', async () => {
    // given
    const { store, api } = setup();
    await flush();

    // when
    const id = await store.importWorkout(
      {
        id: 'src',
        title: 'Von Anna',
        description: 'x',
        exercises: [{ exerciseId: 'plank.standard', target: 60 }],
      },
      { uid: 'anna', workoutId: 'src', displayName: 'Anna' }
    );

    // then
    expect(id).toBe('new-id');
    expect(api.createWorkout).toHaveBeenCalledWith(
      'u1',
      {
        title: 'Von Anna',
        description: 'x',
        exercises: [{ exerciseId: 'plank.standard', target: 60 }],
        onProfile: false,
      },
      { uid: 'anna', workoutId: 'src', displayName: 'Anna' }
    );
  });

  it('should wait for the list before judging the limit on an import', async () => {
    // given — the profile's copy button can be the first thing to touch
    // this store, before the listener has delivered
    const { store, api, list$ } = setup({ pending: true });
    await flush();
    expect(store.loaded()).toBe(false);

    // when
    const pending = store.importWorkout(
      {
        id: 'src',
        title: 'X',
        description: '',
        exercises: [{ exerciseId: 'pushup', target: 5 }],
      },
      { uid: 'anna', workoutId: 'src', displayName: null }
    );
    list$.next(
      Array.from({ length: 50 }, (_, i) => ({ ...WORKOUT, id: `w${i}` }))
    );
    await flush();
    const id = await pending;

    // then
    expect(id).toBeNull();
    expect(store.lastRejection()).toBe('limit');
    expect(api.createWorkout).not.toHaveBeenCalled();
  });

  it('should do nothing without a signed-in user', async () => {
    // given
    const { store, api } = setup({ userId: '' });
    await flush();

    // when
    const id = await store.create(VALID_INPUT);

    // then
    expect(id).toBeNull();
    expect(api.createWorkout).not.toHaveBeenCalled();
    expect(api.listWorkouts).not.toHaveBeenCalled();
  });
});
