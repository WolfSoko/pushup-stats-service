import { inject, LOCALE_ID, Pipe, type PipeTransform } from '@angular/core';

import { relativeTimeParts } from './relative-time';

/**
 * "vor 3 Minuten" for an inbox timestamp. `Intl.RelativeTimeFormat`
 * rather than a hand-written table: nine locales, and only the browser
 * knows the plural rules for all of them.
 */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(iso: string | null | undefined, now = Date.now()): string {
    const parts = relativeTimeParts(iso, now);
    if (!parts) return '';
    return new Intl.RelativeTimeFormat(this.locale, {
      numeric: 'auto',
    }).format(parts.value, parts.unit);
  }
}
