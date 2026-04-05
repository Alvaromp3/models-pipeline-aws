import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService, CognitoPublicConfig } from '../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  loading = true;
  cognito: CognitoPublicConfig | null = null;
  apiUnreachable = false;
  usedEnvFallback = false;
  /** El API respondió 200 pero `configured: false` (faltan COGNITO_* en backend/.env). */
  backendMissingCognitoVars = false;

  ngOnInit(): void {
    const fb = this.auth.getCognitoFallbackFromEnvironment();
    this.auth.getCognitoPublicConfig().subscribe({
      next: (c) => {
        if (c.configured && c.domain && c.clientId && c.redirectUri) {
          this.cognito = c;
          this.usedEnvFallback = false;
          this.backendMissingCognitoVars = false;
        } else if (fb) {
          this.cognito = fb;
          this.usedEnvFallback = true;
          this.backendMissingCognitoVars = false;
        } else {
          this.cognito = c;
          this.usedEnvFallback = false;
          /** API alcanzable pero Hosted UI incompleto: mostrar checklist Cognito, no el mensaje genérico de API caído. */
          this.backendMissingCognitoVars = !c.configured;
        }
        this.apiUnreachable = false;
        this.loading = false;
      },
      error: () => {
        this.backendMissingCognitoVars = false;
        if (fb) {
          this.cognito = fb;
          this.usedEnvFallback = true;
          this.apiUnreachable = true;
        } else {
          this.cognito = null;
          this.usedEnvFallback = false;
          this.apiUnreachable = true;
        }
        this.loading = false;
      },
    });
  }

  get hasCognito(): boolean {
    return !!(
      this.cognito?.configured &&
      this.cognito.domain &&
      this.cognito.clientId &&
      this.cognito.redirectUri?.trim()
    );
  }

  get callbackHint(): string {
    return this.auth.resolveOAuthRedirectUri(this.cognito);
  }

  startCognito(): void {
    if (!this.hasCognito || !this.cognito?.domain || !this.cognito?.clientId) {
      return;
    }
    const url = this.auth.buildCognitoAuthorizeUrl(
      this.cognito.domain,
      this.cognito.clientId,
      this.cognito,
    );
    const raw = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    const safe =
      raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
    this.auth.setPendingReturnUrl(safe);
    window.location.href = url;
  }
}
