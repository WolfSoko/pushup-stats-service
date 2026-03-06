import { hasStrongPasswordPolicy } from './login.component';

describe('login password policy', () => {
  it('accepts password with min 8 chars, number and special character', () => {
    expect(hasStrongPasswordPolicy('Secret#123')).toBe(true);
  });

  it('rejects password without special character', () => {
    expect(hasStrongPasswordPolicy('Secret1234')).toBe(false);
  });

  it('rejects password without number', () => {
    expect(hasStrongPasswordPolicy('Secret#abc')).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    expect(hasStrongPasswordPolicy('S#1abc')).toBe(false);
  });
});
