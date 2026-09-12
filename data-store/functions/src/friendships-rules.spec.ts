import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Drift guard for the `friendships` Firestore security rules.
 *
 * The `friendships/{loUid}__{hiUid}` collection was introduced in commit
 * `39ed9eb`. Its rules are hand-written (not generated like the exercise
 * allowlists), so this test pins the security intent:
 *
 * - Read: authenticated participants only (`resource.data.users` must
 *   contain the caller's uid). Non-parties get PERMISSION_DENIED.
 * - Write: always `if false` — every write goes through the
 *   `functions-friends` callables (Admin SDK), which bypass these rules.
 *
 * Without this guard a rule edit that widens write access or removes the
 * `resource.data.users` read guard would go unnoticed until production.
 */

const RULES_PATH = join(__dirname, '..', '..', 'firestore.rules');

/**
 * Extracts the body text of the `match /friendships/{friendshipId}` block
 * from the rules file, using brace counting to handle nested braces correctly.
 */
function extractFriendshipsBlock(rules: string): string {
  const marker = 'match /friendships/{friendshipId}';
  const start = rules.indexOf(marker);
  if (start < 0) {
    throw new Error(`friendships match block not found in firestore.rules`);
  }
  const open = rules.indexOf('{', start + marker.length);
  if (open < 0) {
    throw new Error(`no opening brace for friendships match block`);
  }
  let depth = 0;
  let end = -1;
  for (let i = open; i < rules.length; i++) {
    if (rules[i] === '{') depth++;
    else if (rules[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`unbalanced braces in friendships match block`);
  }
  return rules.slice(open, end + 1);
}

describe('firestore.rules — friendships collection security', () => {
  const rules = readFileSync(RULES_PATH, 'utf8');

  it('should declare a match block for the friendships collection', () => {
    // given
    // when
    const block = extractFriendshipsBlock(rules);
    // then — block was found (extractFriendshipsBlock throws if absent)
    expect(block).toContain('allow read');
  });

  it('should guard reads behind authentication', () => {
    // given — unauthenticated callers must be denied
    const block = extractFriendshipsBlock(rules);
    // when / then
    expect(block).toMatch(/allow read\s*:/);
    expect(block).toContain('request.auth != null');
  });

  it('should restrict reads to participants via resource.data.users', () => {
    // given — only the two parties stored in `users` array may read the doc
    const block = extractFriendshipsBlock(rules);
    // when / then
    expect(block).toContain('request.auth.uid in resource.data.users');
  });

  it('should block all client writes (write: if false)', () => {
    // given — writes go through functions-friends callables (Admin SDK),
    // so the client-side rule must be hard-deny
    const block = extractFriendshipsBlock(rules);
    // when / then
    expect(block).toMatch(/allow write\s*:\s*if false/);
  });

  it('should not grant write access to authenticated users', () => {
    // given — no condition that evaluates to true for a normal client write
    const block = extractFriendshipsBlock(rules);
    // when
    const writeRules = block.match(/allow write\s*:[^;]+/g) ?? [];
    // then — there is exactly one write rule and it is always-false
    expect(writeRules).toHaveLength(1);
    expect(writeRules[0]).toMatch(/if false/);
  });
});
