import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ueber-uns-page',
  imports: [MatButtonModule, RouterLink],
  template: `
    <article class="about-page">
      <h1 i18n="@@about.title">Über uns</h1>

      <section>
        <h2 i18n="@@about.who.title">Wer hinter Pushup Tracker steckt</h2>
        <p i18n="@@about.who.body1">
          Pushup Tracker wird von Wolfram Sokollek entwickelt und betrieben –
          Softwareentwickler aus der Nähe von Hamburg und selbst täglich im
          Training. Die App ist aus einem persönlichen Bedürfnis entstanden: das
          eigene Training ohne Zettelwirtschaft festzuhalten und den Fortschritt
          über Wochen und Monate sichtbar zu machen.
        </p>
        <p i18n="@@about.who.body2">
          Was als kleines Wochenendprojekt für Liegestütze begann, ist heute ein
          vollwertiger Trainings-Tracker für dutzende Übungen – von
          Liegestützen, Klimmzügen und Kniebeugen über Planks und
          Ausfallschritte bis hin zu Cardio- und Mobility-Einheiten. Mit
          Trainingsplänen, Tageszielen, Streaks, Bestenliste und automatischer
          Wiederholungszählung per Kamera – komplett im Browser, kostenlos und
          ohne App-Store.
        </p>
      </section>

      <section>
        <h2 i18n="@@about.mission.title">Warum es diese Seite gibt</h2>
        <p i18n="@@about.mission.body">
          Ob Liegestütze, Kniebeugen oder Klimmzüge – die meisten
          Körpergewichtsübungen brauchen kein Gerät, kein Studio und lassen
          keine Ausrede zu. Was den meisten fehlt, ist nicht die Übung, sondern
          die Kontinuität. Genau da setzt Pushup Tracker an – messbarer
          Fortschritt, kleine Tagesziele und eine Streak, die man ungern reißen
          lässt, machen aus ein paar Wiederholungen eine dauerhafte Gewohnheit.
        </p>
      </section>

      <section>
        <h2 i18n="@@about.content.title">Wie unsere Inhalte entstehen</h2>
        <p i18n="@@about.content.body">
          Die Guides und Blog-Artikel basieren auf eigener Trainingserfahrung
          und allgemein anerkannten Trainingsprinzipien; wo Studien zitiert
          werden, sind sie im Artikel verlinkt. Die Inhalte ersetzen keine
          medizinische Beratung – hol dir bei Vorerkrankungen oder Schmerzen
          zuerst ärztlichen Rat.
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
