import { expect, test } from '@playwright/test';

/**
 * Regression guard for self-hosted blog imagery.
 *
 * The localized build emits one asset copy per locale under
 * `<locale>/assets/` and stamps `<base href="/<locale>/">` into every
 * document, but blog markdown addresses its images at the domain root:
 * `heroImage` doubles as the absolute `og:image` URL, and inline
 * infographics use root-absolute `src` attributes that `<base>` does not
 * rewrite. Both forms 404'd in production until `server.ts` grew a
 * dedicated `/assets` mount — the article HTML was fine, only the bytes
 * were missing, so no unit test could see it.
 *
 * `geschichte-der-liegestuetze` is an article that carries both a
 * self-hosted hero JPEG and an inline SVG figure.
 */
const ARTICLE_PATH = '/de/blog/geschichte-der-liegestuetze';
const ROOT_ASSET_PATHS = [
  '/assets/blog/hero-geschichte.jpg',
  '/assets/blog/zeitstrahl-liegestuetze.svg',
];

test.describe('Blog images', () => {
  test.describe('Given a root-absolute asset path', () => {
    for (const assetPath of ROOT_ASSET_PATHS) {
      test(`should serve ${assetPath} as an image @smoke`, async ({
        request,
      }) => {
        // when
        const response = await request.get(assetPath);

        // then
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/');
      });
    }
  });

  test('should server-render the hero figure @smoke', async ({ request }) => {
    // given
    const response = await request.get(ARTICLE_PATH);

    // when
    const html = await response.text();

    // then — the hero must be in the SSR payload, because crawlers and
    // social-preview bots never run the hydration that could remove it.
    expect(html).toContain('class="article-hero"');
  });

  test('should render every same-origin article image with actual bytes @smoke', async ({
    page,
    baseURL,
  }) => {
    // given
    await page.goto(ARTICLE_PATH);
    // Inline figures are `loading="lazy"` — without scrolling they never
    // start fetching and would report `naturalWidth === 0` even when fine.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // when — heroes are pinned to the absolute production origin (they
    // double as `og:image`), so only same-origin images say anything
    // about the server under test.
    const origin = new URL(baseURL ?? '').origin;
    const broken = await page.locator('article img, figure img').evaluateAll(
      (images, sameOrigin) =>
        images
          .filter((el) => {
            const img = el as HTMLImageElement;
            return img.src.startsWith(sameOrigin) && !img.naturalWidth;
          })
          .map((el) => (el as HTMLImageElement).src),
      origin
    );

    // then
    expect(broken).toEqual([]);
  });
});
