import type { Page, TestInfo } from '@playwright/test';

/**
 * A query value can be a credential: the friends flow carries the
 * invitation token in `fi`, and a job log is readable by anyone who can
 * see the repository's Actions tab. Names are kept, values are not.
 */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const masked = new URLSearchParams();
    for (const key of url.searchParams.keys()) masked.set(key, 'redacted');
    url.search = masked.toString();
    if (url.hash) url.hash = 'redacted';
    return url.toString();
  } catch {
    return redactText(raw);
  }
}

/** The same, for text that merely happens to contain a URL. */
function redactText(text: string): string {
  return text.replace(/([?&][\w.-]+=)[^&\s"'<>]+/g, '$1redacted');
}

/** Nothing is printed on a green run, so this can stay generous. */
const MAX_LINES = 60;
const MAX_BODY_CHARS = 500;

/**
 * Records what the browser complained about, and prints it when the test
 * ends badly.
 *
 * The staging target only ever runs on a CI runner, and its Playwright
 * report is an artifact somebody has to download. A failure there is
 * therefore only as diagnosable as the job log — so the log has to carry
 * the console errors, the failed requests and what the page actually
 * showed, or the next round is guesswork.
 */
export function collectDiagnostics(page: Page): () => string[] {
  const lines: string[] = [];
  const note = (line: string) => {
    if (lines.length < MAX_LINES) lines.push(line);
  };

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      note(`${type}: ${redactText(message.text())}`);
    }
  });
  page.on('pageerror', (error) =>
    note(`pageerror: ${redactText(error.message)}`)
  );
  page.on('requestfailed', (request) =>
    note(
      `requestfailed: ${redactUrl(request.url())} — ${request.failure()?.errorText ?? 'unknown'}`
    )
  );
  page.on('response', (response) => {
    if (response.status() >= 400) {
      note(`http ${response.status()}: ${redactUrl(response.url())}`);
    }
  });

  return () => lines;
}

/** Prints the collected lines, the URL and the visible text of the page. */
export async function reportDiagnostics(
  page: Page,
  testInfo: TestInfo,
  lines: string[]
): Promise<void> {
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '<unreadable>');
  console.log(
    [
      `[diagnose] ${testInfo.titlePath.join(' › ')}`,
      `  url: ${redactUrl(page.url())}`,
      `  body: ${redactText(body.replace(/\s+/g, ' ')).slice(0, MAX_BODY_CHARS)}`,
      ...lines.map((line) => `  ${line}`),
    ].join('\n')
  );
}
