import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ueber-uns-page',
  imports: [MatButtonModule, RouterLink],
  template: `
    <article class="about-page">
      <h1 i18n="@@about.title">&Uuml;ber uns</h1>

      <section>
        <h2 i18n="@@about.who.title">Wer hinter Pushup Tracker steckt</h2>
        <p i18n="@@about.who.body1">
          Pushup Tracker wird von Wolfram Sokollek entwickelt und betrieben
          &ndash; Softwareentwickler aus der N&auml;he von Hamburg und selbst
          t&auml;glicher Liegest&uuml;tze-Trainierender. Die App ist aus einem
          pers&ouml;nlichen Bed&uuml;rfnis entstanden: das eigene Training ohne
          Zettelwirtschaft festzuhalten und den Fortschritt &uuml;ber Wochen und
          Monate sichtbar zu machen.
        </p>
        <p i18n="@@about.who.body2">
          Was als kleines Wochenendprojekt begann, ist heute ein vollwertiger
          Trainings-Tracker mit Trainingspl&auml;nen, Tageszielen, Streaks,
          Bestenliste und automatischer Wiederholungsz&auml;hlung per Kamera
          &ndash; komplett im Browser, kostenlos und ohne App-Store.
        </p>
      </section>

      <section>
        <h2 i18n="@@about.mission.title">Warum es diese Seite gibt</h2>
        <p i18n="@@about.mission.body">
          Liegest&uuml;tze sind die einfachste Kraft&uuml;bung der Welt: kein
          Ger&auml;t, kein Studio, keine Ausrede. Was den meisten fehlt, ist
          nicht die &Uuml;bung, sondern die Kontinuit&auml;t. Genau da setzt
          Pushup Tracker an &ndash; messbarer Fortschritt, kleine Tagesziele und
          eine Streak, die man ungern rei&szlig;en l&auml;sst, machen aus ein
          paar Wiederholungen eine dauerhafte Gewohnheit.
        </p>
      </section>

      <section>
        <h2 i18n="@@about.content.title">Wie unsere Inhalte entstehen</h2>
        <p i18n="@@about.content.body">
          Die Guides und Blog-Artikel basieren auf eigener Trainingserfahrung
          und allgemein anerkannten Trainingsprinzipien; wo Studien zitiert
          werden, sind sie im Artikel verlinkt. Die Inhalte ersetzen keine
          medizinische Beratung &ndash; bei Vorerkrankungen oder Schmerzen
          geh&ouml;rt die Frage zuerst zu &Auml;rztin oder Arzt.
        </p>
      </section>

      <section>
        <h2 i18n="@@about.contact.title">Kontakt</h2>
        <p>
          <span i18n="@@about.contact.body"
            >Fragen, Feedback oder Fehler gefunden? Schreib uns:</span
          >
          contact&#64;pushup-stats.com
        </p>
        <p class="about-links">
          <a
            mat-stroked-button
            routerLink="/impressum"
            i18n="@@about.toImpressum"
            >Impressum</a
          >
          <a
            mat-stroked-button
            routerLink="/datenschutz"
            i18n="@@about.toDatenschutz"
            >Datenschutz</a
          >
        </p>
      </section>
    </article>
  `,
  styles: `
    .about-page {
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
    .about-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }
  `,
})
export class UeberUnsPageComponent {}
