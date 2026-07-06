import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { UeberUnsPageComponent } from './ueber-uns-page.component';

describe('UeberUnsPageComponent', () => {
  async function renderPage() {
    return render(UeberUnsPageComponent, {
      providers: [provideRouter([]), provideLocationMocks()],
    });
  }

  it('should render the page heading', async () => {
    // given
    const { container } = await renderPage();

    // when
    const heading = container.querySelector('h1');

    // then
    expect(heading?.textContent).toContain('Über uns');
  });

  it('should name the site operator', async () => {
    // given
    const { container } = await renderPage();

    // then
    expect(container.textContent).toContain('Wolfram Sokollek');
  });

  it('should show the contact email address', async () => {
    // given
    const { container } = await renderPage();

    // then
    expect(container.textContent).toContain('contact@pushup-stats.com');
  });

  it('should link to Impressum and Datenschutz', async () => {
    // given
    const { container } = await renderPage();

    // when
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href')
    );

    // then
    expect(hrefs).toContain('/impressum');
    expect(hrefs).toContain('/datenschutz');
  });
});
