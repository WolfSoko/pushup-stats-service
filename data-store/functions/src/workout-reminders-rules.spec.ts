import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Drift guard for the hand-written `workoutReminders` rules. A reminder
 * makes the server push to its owner on a schedule, so the rules must keep
 * it owner-only and tied to a workout the caller owns, and must never let
 * a client stamp `lastSentAt`, which only the dispatcher writes.
 */

const RULES_PATH = join(__dirname, '..', '..', 'firestore.rules');

function extractBlock(rules: string, marker: string): string {
  const start = rules.indexOf(marker);
  if (start < 0) throw new Error(`${marker} not found in firestore.rules`);
  const open = rules.indexOf('{', start + marker.length);
  let depth = 0;
  for (let i = open; i < rules.length; i++) {
    if (rules[i] === '{') depth++;
    else if (rules[i] === '}' && --depth === 0) {
      return rules.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces after ${marker}`);
}

function ruleFor(block: string, verb: string): string {
  const rules = block.match(new RegExp(`allow ${verb}\\s*:[^;]+;`, 'g')) ?? [];
  expect(rules).toHaveLength(1);
  return (rules[0] ?? '').replace(/\s+/g, ' ');
}

describe('firestore.rules — workoutReminders collection security', () => {
  const rules = readFileSync(RULES_PATH, 'utf8');
  const block = extractBlock(rules, 'match /workoutReminders/{workoutId}');

  it('should restrict reads to the owner', () => {
    // when
    const read = ruleFor(block, 'read');

    // then
    expect(read).toContain('request.auth != null');
    expect(read).toContain('resource.data.ownerId == request.auth.uid');
  });

  it('should require ownership of the workout on create and update', () => {
    // when
    const create = ruleFor(block, 'create');
    const update = ruleFor(block, 'update');

    // then
    for (const rule of [create, update]) {
      expect(rule).toContain(
        'request.resource.data.ownerId == request.auth.uid'
      );
      expect(rule).toContain(
        'isValidWorkoutReminder(request.resource.data, workoutId)'
      );
      expect(rule).toContain('ownsWorkout(workoutId)');
    }
    expect(update).toContain('resource.data.ownerId == request.auth.uid');
  });

  it('should keep lastSentAt out of client hands', () => {
    // when
    const create = ruleFor(block, 'create');
    const update = ruleFor(block, 'update');

    // then
    expect(create).toContain("!('lastSentAt' in request.resource.data.keys())");
    expect(update).toContain(
      "request.resource.data.get('lastSentAt', null) in [null, resource.data.get('lastSentAt', null)]"
    );
  });

  it('should restrict deletes to the owner', () => {
    // when
    const remove = ruleFor(block, 'delete');

    // then
    expect(remove).toContain('resource.data.ownerId == request.auth.uid');
  });

  it('should pin the document shape and the workout id', () => {
    // when
    const validator = extractBlock(
      rules,
      'function isValidWorkoutReminder(data, workoutId)'
    );

    // then
    expect(validator).toContain('data.keys().hasOnly(');
    expect(validator).toContain('data.workoutId == workoutId');
    expect(validator).toContain('isValidWorkoutReminderRepeat(data.repeat)');
  });

  it('should look the workout owner up in the workouts collection', () => {
    // when
    const owns = extractBlock(rules, 'function ownsWorkout(workoutId)');

    // then
    expect(owns.replace(/\s+/g, ' ')).toContain(
      'get(/databases/$(database)/documents/workouts/$(workoutId)).data.ownerId == request.auth.uid'
    );
  });
});
