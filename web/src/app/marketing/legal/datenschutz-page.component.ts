import { Component } from '@angular/core';

@Component({
  selector: 'app-datenschutz-page',
  template: `
    <article class="legal-page">
      <h1 i18n="@@datenschutz.title">Datenschutzerkl&auml;rung</h1>

      <section>
        <h2 i18n="@@datenschutz.overview.title">
          1. Datenschutz auf einen Blick
        </h2>
        <h3 i18n="@@datenschutz.overview.general.title">Allgemeine Hinweise</h3>
        <p i18n="@@datenschutz.overview.general.body">
          Die folgenden Hinweise geben einen einfachen &Uuml;berblick
          dar&uuml;ber, was mit Ihren personenbezogenen Daten passiert, wenn Sie
          diese Website besuchen. Personenbezogene Daten sind alle Daten, mit
          denen Sie pers&ouml;nlich identifiziert werden k&ouml;nnen.
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.responsible.title">
          2. Verantwortliche Stelle
        </h2>
        <p i18n="@@datenschutz.responsible.body">
          Die verantwortliche Stelle f&uuml;r die Datenverarbeitung auf dieser
          Website ist:
        </p>
        <p>
          <!-- TODO: Replace placeholders with your real data -->
          <strong>[Vor- und Nachname]</strong><br />
          [Stra&szlig;e und Hausnummer]<br />
          [PLZ Ort]<br />
          <span i18n="@@datenschutz.responsible.email">E-Mail:</span>
          [deine&#64;email.de]
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.hosting.title">3. Hosting</h2>
        <p i18n="@@datenschutz.hosting.body">
          Diese Website wird bei Google Firebase (Google Ireland Limited, Gordon
          House, Barrow Street, Dublin 4, Irland) gehostet. Wenn Sie diese
          Website besuchen, werden Server-Log-Dateien automatisch erhoben und
          f&uuml;r kurze Zeit gespeichert. Details entnehmen Sie der
          Datenschutzerkl&auml;rung von Google:
          https://policies.google.com/privacy
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.account.title">
          4. Registrierung und Nutzerkonto
        </h2>
        <p i18n="@@datenschutz.account.body">
          Sie k&ouml;nnen ein Nutzerkonto anlegen, um Trainingseintr&auml;ge zu
          speichern. Dabei werden E-Mail-Adresse, ein Anzeigename sowie Ihre
          Trainingseintr&auml;ge in Google Cloud Firestore gespeichert. Die
          Authentifizierung erfolgt &uuml;ber Firebase Authentication. Sie
          k&ouml;nnen Ihr Konto und alle zugeh&ouml;rigen Daten jederzeit in den
          Einstellungen l&ouml;schen.
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.analytics.title">5. Google Analytics</h2>
        <p i18n="@@datenschutz.analytics.body">
          Diese Website nutzt Google Analytics 4 (Mess-ID: G-5D32B9B1S6), einen
          Webanalysedienst der Google Ireland Limited. Google Analytics
          verwendet Cookies und &auml;hnliche Technologien, um Ihre Nutzung der
          Website zu analysieren. Die erzeugten Informationen werden in der
          Regel an einen Server von Google &uuml;bertragen und dort gespeichert.
          Die IP-Anonymisierung ist aktiviert. Google Analytics wird nur
          aktiviert, wenn Sie dem zugestimmt haben.
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.ads.title">6. Google AdSense</h2>
        <p i18n="@@datenschutz.ads.body">
          Diese Website nutzt Google AdSense (Publisher-ID:
          ca-pub-6346271540341424), einen Dienst der Google Ireland Limited, zur
          Einbindung von Werbeanzeigen. Google AdSense verwendet Cookies, um
          relevante Anzeigen zu schalten und die Anzeigenleistung zu messen.
        </p>
        <h3 i18n="@@datenschutz.ads.personalized.title">
          Personalisierte und nicht-personalisierte Werbung
        </h3>
        <p i18n="@@datenschutz.ads.personalized.body">
          Beim ersten Besuch der Website werden Sie &uuml;ber einen
          Consent-Banner gefragt, ob Sie personalisierte Werbung zulassen
          m&ouml;chten. Wenn Sie nur &bdquo;Notwendige&ldquo; w&auml;hlen,
          werden ausschlie&szlig;lich nicht-personalisierte Anzeigen
          ausgeliefert, die keine Tracking-Cookies f&uuml;r Werbeprofile setzen.
          Sie k&ouml;nnen Ihre Einwilligung jederzeit widerrufen, indem Sie Ihre
          Browser-Cookies l&ouml;schen und die Seite neu laden.
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.cookies.title">7. Cookies</h2>
        <p i18n="@@datenschutz.cookies.body">
          Diese Website verwendet Cookies. Technisch notwendige Cookies
          (Session, Spracheinstellung) werden ohne Einwilligung gesetzt. Cookies
          f&uuml;r Analyse (Google Analytics) und personalisierte Werbung
          (Google AdSense) werden erst nach Ihrer ausdr&uuml;cklichen
          Einwilligung aktiviert. Sie k&ouml;nnen Ihre Einwilligung jederzeit
          &uuml;ber den Cookie-Banner widerrufen (erscheint erneut nach
          L&ouml;schen der Browser-Cookies).
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.rights.title">8. Ihre Rechte</h2>
        <p i18n="@@datenschutz.rights.body">
          Sie haben jederzeit das Recht auf Auskunft, Berichtigung,
          L&ouml;schung und Einschr&auml;nkung der Verarbeitung Ihrer
          personenbezogenen Daten sowie das Recht auf Daten&uuml;bertragbarkeit.
          Au&szlig;erdem haben Sie das Recht, eine erteilte Einwilligung
          jederzeit zu widerrufen und sich bei einer Aufsichtsbeh&ouml;rde zu
          beschweren.
        </p>
      </section>

      <section>
        <h2 i18n="@@datenschutz.deletion.title">9. Datenlöschung</h2>
        <p i18n="@@datenschutz.deletion.body">
          Sie k&ouml;nnen Ihr Nutzerkonto und alle damit verbundenen Daten
          jederzeit &uuml;ber die Einstellungsseite der Anwendung l&ouml;schen.
          Nach der L&ouml;schung werden alle personenbezogenen Daten
          unverz&uuml;glich aus unseren Systemen entfernt.
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
    h3 {
      margin-top: 16px;
      margin-bottom: 4px;
    }
    section {
      margin-bottom: 16px;
    }
  `,
})
export class DatenschutzPageComponent {}
