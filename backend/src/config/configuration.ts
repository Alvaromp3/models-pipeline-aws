/**
 * Configuración Nest: URLs y env tal cual (sin forzar 127.0.0.1).
 * Usar `localhost` en ML_SERVICE_URL, DATABASE_URL, CORS, Cognito, etc.
 */

/** Dominio Hosted UI: solo host, sin https (evita https://https:// al armar URLs). */
function normalizeCognitoDomain(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  let s = raw.trim();
  s = s.replace(/^https?:\/\//i, '');
  s = s.split('/')[0] ?? '';
  return s.replace(/\/$/, '');
}

/** Último segmento del issuer Cognito = user pool id (us-east-1_xxx). */
function poolIdFromIssuer(issuer: string | undefined): string {
  if (!issuer?.trim()) return '';
  const base = issuer.trim().replace(/\/$/, '');
  return base.split('/').pop() ?? '';
}

export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  database: {
    url: process.env.DATABASE_URL?.trim() || undefined,
    synchronize: process.env.TYPEORM_SYNC !== 'false',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me-in-production',
  },
  /** Llamadas server→ML; por defecto `http://localhost:8000` (mismo host que el resto del proyecto). */
  mlServiceUrl: (process.env.ML_SERVICE_URL ?? 'http://localhost:8000').trim(),
  /** Origen del SPA en desarrollo; debe coincidir con Callback URL en Cognito. */
  corsOrigin: process.env.CORS_ORIGIN?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ],
  cognito: {
    /** El claim `iss` del id_token usa la capitalización exacta del pool; `COGNITO_ISSUER` completo tiene prioridad. */
    userPoolId:
      poolIdFromIssuer(process.env.COGNITO_ISSUER) ||
      (process.env.COGNITO_USER_POOL_ID ?? '').trim(),
    clientId: (process.env.COGNITO_CLIENT_ID ?? '').trim(),
    clientSecret: (process.env.COGNITO_CLIENT_SECRET ?? '').trim(),
    domain: normalizeCognitoDomain(process.env.COGNITO_DOMAIN),
    /** Debe coincidir exactamente con Callback URL del App client (solo env; sin valor por defecto en código). */
    redirectUri: (process.env.COGNITO_REDIRECT_URI ?? '').trim(),
    region: process.env.AWS_REGION ?? 'eu-west-1',
  },
  /** Solo true si AUTH_LOCAL_LOGIN=true (email/contraseña en Postgres). Por defecto: solo Cognito. */
  auth: {
    localLoginEnabled: process.env.AUTH_LOCAL_LOGIN === 'true',
  },
});
