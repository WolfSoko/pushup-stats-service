// Ensure process exists for Firebase SDK in browser test environments.
if (!(globalThis as { process?: unknown }).process) {
  (globalThis as { process: { env: Record<string, string> } }).process = {
    env: {},
  };
}
