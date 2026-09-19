import type { Page, TestInfo } from '@playwright/test';

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
    if (type === 'error' || type === 'warning')
      note(`${type}: ${message.text()}`);
  });
  page.on('pageerror', (error) => note(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) =>
    note(
      `requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`
    )
  );
  page.on('response', (response) => {
    if (response.status() >= 400)
      note(`http ${response.status()}: ${response.url()}`);
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
      `  url: ${page.url()}`,
      `  body: ${body.replace(/\s+/g, ' ').slice(0, MAX_BODY_CHARS)}`,
      ...lines.map((line) => `  ${line}`),
    ].join('\n')
  );
}
