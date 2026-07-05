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
    // when
    const { container } = await renderPage();

    // then
    expect(container.querySelector('h1')?.textContent).toContain('Über uns');
  });

  it('should name the site operator', async () => {
    // when
    const { container } = await renderPage();

    // then
    expect(container.textContent).toContain('Wolfram Sokollek');
  });

  it('should show the contact email address', async () => {
    // when
    const { container } = await renderPage();

    // then
    expect(container.textContent).toContain('contact@pushup-stats.com');
  });

  it('should link to Impressum and Datenschutz', async () => {
    // when
    const { container } = await renderPage();

    // then
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('/impressum');
    expect(hrefs).toContain('/datenschutz');
  });
});
