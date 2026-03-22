/**
 * Determines whether a password meets the strong password policy.
 *
 * @param value - The password string to validate
 * @returns `true` if `value` contains at least one lowercase letter, one uppercase letter, one digit, one non-alphanumeric character, and is at least 8 characters long; `false` otherwise.
 */
export function hasStrongPasswordPolicy(value: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
    value
  );
}
