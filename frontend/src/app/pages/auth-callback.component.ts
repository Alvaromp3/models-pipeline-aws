import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { NR_OAUTH_STATE_KEY } from '../core/auth/auth.constants';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.scss',
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  message: string | null = null;

  private formatExchangeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string | string[] } | null;
      const fromBody =
        typeof body?.message === 'string'
          ? body.message
          : Array.isArray(body?.message)
            ? body.message.join('; ')
            : null;
      if (fromBody) return fromBody;
      if (typeof err.error === 'string' && err.error.trim()) return err.error;
      return `Error HTTP ${err.status}: ${err.statusText || 'intercambio de código rechazado'}`;
    }
    if (err instanceof Error) return err.message;
    return 'No se pudo intercambiar el código. Revisa la consola del navegador y los logs del API.';
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const code = params.get('code');
      const err = params.get('error');
      const errDesc = params.get('error_description');
      if (err) {
        const detail = errDesc
          ? decodeURIComponent(errDesc.replace(/\+/g, ' '))
          : '';
        this.message = detail
          ? `Cognito (${err}): ${detail}`
          : `Cognito: ${err}`;
        sessionStorage.removeItem(NR_OAUTH_STATE_KEY);
        return;
      }
      if (!code) {
        this.message =
          'No se recibió el código OAuth. Revisa la URL de callback en el cliente Cognito.';
        sessionStorage.removeItem(NR_OAUTH_STATE_KEY);
        return;
      }

      const returnedState = params.get('state');
      const storedState = sessionStorage.getItem(NR_OAUTH_STATE_KEY);
      sessionStorage.removeItem(NR_OAUTH_STATE_KEY);
      if (!returnedState || !storedState || returnedState !== storedState) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const originHint =
          host === '127.0.0.1'
            ? ' Use siempre http://localhost:8080 (no 127.0.0.1): el state OAuth vive en sessionStorage y no se comparte entre ambos.'
            : host === 'localhost'
              ? ' No abra el enlace de Cognito en otro navegador ni borre datos del sitio antes de volver.'
              : '';
        this.message =
          'La solicitud de inicio de sesión no es válida (parámetro state). Inicie sesión con «Continuar con SSO» en esta pestaña y espere a volver a la app sin cerrar el navegador.' +
          originHint;
        return;
      }

      this.auth.cognitoExchange(code).subscribe({
        next: (r) => {
          this.auth.clearPendingOAuthRedirectUri();
          this.auth.setToken(r.access_token);
          const next = this.auth.consumePendingReturnUrl() ?? '/dashboard';
          const safe =
            next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
          void this.router.navigateByUrl(safe);
        },
        error: (err: unknown) => {
          console.error('[auth/callback] Cognito code exchange failed', err);
          this.message = this.formatExchangeError(err);
        },
      });
    });
  }
}
