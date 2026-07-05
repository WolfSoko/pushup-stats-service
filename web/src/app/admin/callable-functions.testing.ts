export interface CallableRecord {
  name: string;
  impl: (data: unknown) => Promise<{ data: unknown }>;
}

/**
 * DI fake for `CallableFunctionsService`, shared by the admin specs.
 * Provide it via `{ provide: CallableFunctionsService, useValue:
 * callablesMock }` — never `vi.mock('@angular/fire/*')` in web specs;
 * see docs/gotchas/testing.md ("vi.mock('@angular/fire/…') is a
 * landmine").
 */
export function createCallablesMock() {
  const call = vi.fn();
  const setupCallables = (records: CallableRecord[]): void => {
    call.mockImplementation((name: string) => {
      const match = records.find((r) => r.name === name);
      if (!match) {
        return async () => {
          throw new Error(`Unexpected callable: ${name}`);
        };
      }
      return match.impl;
    });
  };
  return { callablesMock: { call }, setupCallables };
}
