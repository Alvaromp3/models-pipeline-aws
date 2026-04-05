import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, defer, retry, switchMap, tap, throwError } from 'rxjs';
import {
  apiBaseCandidates,
  forgetApiBase,
  getApiBase,
  rememberApiBase,
} from '../api-url';
import { environment } from '../../../environments/environment';
import {
  NR_OAUTH_REDIRECT_KEY,
  NR_OAUTH_STATE_KEY,
  NR_RETURN_URL_KEY,
  NR_TOKEN_KEY,
} from './auth.constants';

export type LoginResponse = {
  access_token: string;
  user: { id: string; email: string; displayName: string };
};

/** Respuesta de GET /api/auth/cognito/config (valores vienen del backend/.env). */
export type CognitoPublicConfig = {
  configured: boolean;
  domain: string | null;
  clientId: string | null;
  /** Callback OAuth: mismo valor que COGNITO_REDIRECT_URI / Callback URLs en Cognito. */
  redirectUri?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  get token(): string | null {
    return sessionStorage.getItem(NR_TOKEN_KEY);
  }

  setToken(t: string): void {
    sessionStorage.setItem(NR_TOKEN_KEY, t);
  }

  clear(): void {
    sessionStorage.removeItem(NR_TOKEN_KEY);
    forgetApiBase();
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  setPendingReturnUrl(url: string): void {
    sessionStorage.setItem(NR_RETURN_URL_KEY, url);
  }

  consumePendingReturnUrl(): string | null {
    const v = sessionStorage.getItem(NR_RETURN_URL_KEY);
    if (v) sessionStorage.removeItem(NR_RETURN_URL_KEY);
    return v;
  }

  /** Configuración Cognito expuesta por el API (evita duplicar en environment del front). */
  getCognitoPublicConfig(): Observable<CognitoPublicConfig> {
    return defer(() => this.fetchCognitoConfigFromCandidates(apiBaseCandidates(), 0));
  }

  private fetchCognitoConfigFromCandidates(
    bases: string[],
    index: number,
  ): Observable<CognitoPublicConfig> {
    if (index >= bases.length) {
      return throwError(
        () => new Error('No se alcanzó el API en ninguna URL de desarrollo'),
      );
    }
    const base = bases[index].replace(/\/$/, '');
    return this.http.get<CognitoPublicConfig>(`${base}/auth/cognito/config`).pipe(
      retry({ count: 1, delay: 400 }),
      tap(() => rememberApiBase(base)),
      catchError(() => this.fetchCognitoConfigFromCandidates(bases, index + 1)),
    );
  }

  /**
   * Si el API no responde, puedes copiar COGNITO_DOMAIN y COGNITO_CLIENT_ID aquí
   * (mismos valores que backend/.env) para poder abrir Hosted UI. El intercambio del
   * código sigue necesitando el backend en marcha.
   */
  getCognitoFallbackFromEnvironment(): CognitoPublicConfig | null {
    const domain = environment.cognitoDomain?.trim();
    const clientId = environment.cognitoClientId?.trim();
    const redirectUri = environment.cognitoRedirectUri?.trim();
    if (domain && clientId && redirectUri) {
      return {
        configured: true,
        domain,
        clientId,
        redirectUri,
      };
    }
    return null;
  }

  /**
   * Ayuda cuando el API no devuelve redirectUri: `environment.cognitoRedirectUri` o origen + `/auth/callback`.
   * En desarrollo el origen canónico es http://localhost:8080.
   */
  oauthCallbackUrl(): string {
    const fixed = environment.cognitoRedirectUri?.trim();
    const looksPlaceholder =
      !fixed ||
      fixed.includes('tu-dominio.com') ||
      fixed.includes('example.com');
    if (!looksPlaceholder && fixed) {
      return fixed;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/auth/callback`;
    }
    return fixed ?? '';
  }

  /**
   * Usa siempre el `redirectUri` de GET /api/auth/cognito/config cuando `fromApi` lo trae.
   * Si no (solo fallback env), usa `cognitoRedirectUri` o el origen del navegador como pista.
   */
  resolveOAuthRedirectUri(fromApi?: CognitoPublicConfig | null): string {
    const fromBackend = fromApi?.redirectUri?.trim();
    if (fromBackend) return fromBackend;
    return this.oauthCallbackUrl();
  }

  /** Guarda redirect para POST /auth/cognito/exchange (mismo valor que en authorize). */
  persistOAuthRedirectForCallback(fromApi?: CognitoPublicConfig | null): void {
    sessionStorage.setItem(
      NR_OAUTH_REDIRECT_KEY,
      this.resolveOAuthRedirectUri(fromApi),
    );
  }

  getPendingOAuthRedirectUri(): string {
    return (
      sessionStorage.getItem(NR_OAUTH_REDIRECT_KEY)?.trim() ||
      this.oauthCallbackUrl()
    );
  }

  clearPendingOAuthRedirectUri(): void {
    sessionStorage.removeItem(NR_OAUTH_REDIRECT_KEY);
  }

  buildCognitoAuthorizeUrl(
    domain: string,
    clientId: string,
    fromApi?: CognitoPublicConfig | null,
  ): string {
    this.persistOAuthRedirectForCallback(fromApi);
    const redirect = this.getPendingOAuthRedirectUri();
    if (!redirect) {
      throw new Error(
        'redirect_uri vacío: el API debe devolver redirectUri en GET /auth/cognito/config (COGNITO_REDIRECT_URI en backend).',
      );
    }
    const u = new URL(`https://${domain}/oauth2/authorize`);
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'openid email profile');
    u.searchParams.set('redirect_uri', redirect);
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(NR_OAUTH_STATE_KEY, state);
    u.searchParams.set('state', state);
    return u.toString();
  }

  /**
   * Usa el mismo redirect_uri que en `/oauth2/authorize` (sessionStorage). Si falta (p. ej.
   * pestaña nueva), lo vuelve a pedir al API para alinearlo con COGNITO_REDIRECT_URI.
   */
  cognitoExchange(code: string): Observable<LoginResponse> {
    const stored = sessionStorage.getItem(NR_OAUTH_REDIRECT_KEY)?.trim();
    const post = (redirectUri: string) =>
      this.http.post<LoginResponse>(
        `${getApiBase()}/auth/cognito/exchange`,
        { code, redirectUri },
      );

    if (stored) {
      return post(stored);
    }

    return this.getCognitoPublicConfig().pipe(
      switchMap((cfg) => {
        const r = cfg.redirectUri?.trim();
        if (!r) {
          return throwError(
            () =>
              new Error(
                'No hay redirect_uri en sesión ni redirectUri en GET /auth/cognito/config. Entra de nuevo desde /login.',
              ),
          );
        }
        return post(r);
      }),
    );
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/']);
  }
}
