export const environment = {
  production: false,
  /** Si entras por 127.0.0.1, la app redirige aquí para que coincida con Cognito y sessionStorage. */
  canonicalBrowserOrigin: 'http://localhost:8080',
  /**
   * Origen único: http://localhost:8080 (`ng serve --host localhost`).
   * El proxy reenvía `/api` → `http://localhost:4000` (ver `proxy.conf.json`).
   */
  apiUrl: '/api',
  /**
   * Mismo valor que `COGNITO_REDIRECT_URI` en backend y Callback URL en Cognito.
   * Fija el fallback si el API no responde; con API activo prevalece GET /api/auth/cognito/config.
   */
  cognitoRedirectUri: 'http://localhost:8080/auth/callback',
  /**
   * Opcional: mismos valores que en backend/.env si GET /auth/cognito/config falla.
   * Requiere también cognitoRedirectUri si quieres abrir Hosted UI sin API.
   */
  cognitoDomain: '',
  cognitoClientId: '',
};
