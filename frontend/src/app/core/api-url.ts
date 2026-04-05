import { environment } from '../../environments/environment';

const NR_API_BASE_KEY = 'nr_api_root';

/** Base del API sin barra final (p. ej. `/api` o `http://localhost:4000/api`). */
export function getApiBase(): string {
  const fallback = environment.apiUrl.replace(/\/$/, '');
  if (environment.production) return fallback;
  const stored = sessionStorage.getItem(NR_API_BASE_KEY)?.trim();
  if (stored) return stored.replace(/\/$/, '');
  return fallback;
}

export function rememberApiBase(base: string): void {
  sessionStorage.setItem(NR_API_BASE_KEY, base.replace(/\/$/, ''));
}

export function forgetApiBase(): void {
  sessionStorage.removeItem(NR_API_BASE_KEY);
}

/**
 * Desarrollo: primero mismo origen (`/api` vía proxy), luego Nest en localhost:4000.
 */
export function apiBaseCandidates(): string[] {
  const u = environment.apiUrl.replace(/\/$/, '');
  if (environment.production) return [u];
  const out: string[] = [];
  const add = (b: string) => {
    const x = b.replace(/\/$/, '');
    if (!out.includes(x)) out.push(x);
  };
  add(u);
  if (u === '/api' || u.startsWith('/')) {
    add('http://localhost:4000/api');
  }
  return out;
}
