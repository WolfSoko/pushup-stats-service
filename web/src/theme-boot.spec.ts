import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8');
const script = /<script id="theme-boot">([\s\S]*?)<\/script>/.exec(html)?.[1];

function runBootScript(options: {
  stored: string | null;
  systemDark: boolean;
  storageThrows?: boolean;
}): void {
  const root = document.documentElement;
  const localStorageStub = {
    getItem: () => {
      if (options.storageThrows) throw new Error('storage disabled');
      return options.stored;
    },
  };
  const matchMedia = (query: string) => ({
    matches: query.includes('dark') && options.systemDark,
  });
  runInNewContext(script ?? 'throw new Error("theme-boot script missing")', {
    window: { matchMedia },
    document: { documentElement: root },
    localStorage: localStorageStub,
  });
}

describe('theme boot script in index.html', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light-theme', 'dark-theme');
  });

  it('should be embedded as an inline script', () => {
    // then
    expect(script).toBeTruthy();
  });

  it('should apply the stored light theme before Angular boots', () => {
    // when
    runBootScript({ stored: 'light', systemDark: true });
    // then
    expect(document.documentElement.classList.contains('light-theme')).toBe(
      true
    );
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      false
    );
  });

  it('should apply the stored dark theme even when the OS prefers light', () => {
    // when
    runBootScript({ stored: 'dark', systemDark: false });
    // then
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      true
    );
  });

  it('should follow the OS preference in auto mode', () => {
    // when
    runBootScript({ stored: 'auto', systemDark: false });
    // then
    expect(document.documentElement.classList.contains('light-theme')).toBe(
      true
    );
  });

  it('should follow the OS preference when nothing is stored', () => {
    // when
    runBootScript({ stored: null, systemDark: true });
    // then
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      true
    );
  });

  it('should fall back to the OS preference when storage access throws', () => {
    // when
    runBootScript({ stored: 'light', systemDark: true, storageThrows: true });
    // then
    expect(document.documentElement.classList.contains('dark-theme')).toBe(
      true
    );
  });
});
