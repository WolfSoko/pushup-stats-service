import { isPlatformServer } from '@angular/common';

/**
 * Liefert die Basis-URL für API-Calls abhängig vom Render-Kontext (SSR vs. Browser).
 * - Browser: '' (gleiche Origin / Proxy)
 * - SSR:    http://<API_HOST>:<API_PORT> mit robusten Fallbacks
 *
 * @param platformId Das injizierte Angular PLATFORM_ID
 * @param label Bezeichner des aufrufenden Services für klarere Warn-Logs
 */
export function buildServerApiBaseUrl(
  platformId: object,
  label = 'ApiService'
): string {
  if (!isPlatformServer(platformId)) return '';

  const envHost = process?.env?.['API_HOST'];
  const envPort = process?.env?.['API_PORT'];
  const host = envHost || '127.0.0.1';
  const port = envPort || '8788';

  if (!envHost || !envPort) {
    // Nur im SSR-Kontext relevant; im Browser ist baseUrl ohnehin leer
    console.warn(
      `[${label}] API_HOST/API_PORT fehlen – Fallback auf http://127.0.0.1:8788`
    );
  }

  return `http://${host}:${port}`;
}
