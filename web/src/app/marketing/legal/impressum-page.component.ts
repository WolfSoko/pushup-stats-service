import { Component } from '@angular/core';

@Component({
  selector: 'app-impressum-page',
  template: `
    <article class="legal-page">
      <h1 i18n="@@impressum.title">Impressum</h1>

      <section>
        <h2 i18n="@@impressum.info.title">
          Angaben gem&auml;&szlig; &sect; 5 TMG
        </h2>
        <p>
          <strong>Wolfram Sokollek</strong><br />
          Korte Asper 8<br />
          21465 Wentorf
        </p>
      </section>

      <section>
        <h2 i18n="@@impressum.contact.title">Kontakt</h2>
        <p>
          <span i18n="@@impressum.contact.email">E-Mail:</span>
          contact&#64;pushup-stats.de
        </p>
      </section>

      <section>
        <h2 i18n="@@impressum.liability.content.title">
          Haftung f&uuml;r Inhalte
        </h2>
        <p i18n="@@impressum.liability.content.body">
          Als Diensteanbieter sind wir gem&auml;&szlig; &sect; 7 Abs. 1 TMG
          f&uuml;r eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach &sect;&sect; 8 bis 10 TMG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, &uuml;bermittelte oder
          gespeicherte fremde Informationen zu &uuml;berwachen oder nach
          Umst&auml;nden zu forschen, die auf eine rechtswidrige T&auml;tigkeit
          hinweisen.
        </p>
      </section>

      <section>
        <h2 i18n="@@impressum.liability.links.title">Haftung f&uuml;r Links</h2>
        <p i18n="@@impressum.liability.links.body">
          Unser Angebot enth&auml;lt Links zu externen Websites Dritter, auf
          deren Inhalte wir keinen Einfluss haben. Deshalb k&ouml;nnen wir
          f&uuml;r diese fremden Inhalte auch keine Gew&auml;hr &uuml;bernehmen.
          F&uuml;r die Inhalte der verlinkten Seiten ist stets der jeweilige
          Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
      </section>

      <section>
        <h2 i18n="@@impressum.copyright.title">Urheberrecht</h2>
        <p i18n="@@impressum.copyright.body">
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
          Seiten unterliegen dem deutschen Urheberrecht. Die
          Vervielf&auml;ltigung, Bearbeitung, Verbreitung und jede Art der
          Verwertung au&szlig;erhalb der Grenzen des Urheberrechtes
          bed&uuml;rfen der schriftlichen Zustimmung des jeweiligen Autors bzw.
          Erstellers.
        </p>
      </section>
    </article>
  `,
  styles: `
    .legal-page {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px;
      line-height: 1.7;
    }
    h1 {
      margin-bottom: 24px;
    }
    h2 {
      margin-top: 32px;
      margin-bottom: 8px;
    }
    section {
      margin-bottom: 16px;
    }
  `,
})
export class ImpressumPageComponent {}
