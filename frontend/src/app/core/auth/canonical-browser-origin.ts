import { environment } from '../../../environments/environment';

/**
 * `sessionStorage` (p. ej. OAuth `state`) es por origen: mezclar `localhost` y `127.0.0.1`
 * rompe el flujo de Cognito. En desarrollo redirige al origen canónico del entorno.
 */
export function redirectToCanonicalBrowserOriginIfNeeded(): void {
  if (environment.production) return;
  const target = (environment as { canonicalBrowserOrigin?: string }).canonicalBrowserOrigin?.trim();
  if (!target || typeof window === 'undefined') return;
  try {
    const u = new URL(target);
    const { location: loc } = window;
    if (loc.origin === u.origin) return;
    const sameLoopback =
      (loc.hostname === '127.0.0.1' && u.hostname === 'localhost') ||
      (loc.hostname === 'localhost' && u.hostname === '127.0.0.1');
    if (sameLoopback && loc.port === u.port) {
      window.location.replace(`${target}${loc.pathname}${loc.search}${loc.hash}`);
    }
  } catch {
    /* ignore */
  }
}
