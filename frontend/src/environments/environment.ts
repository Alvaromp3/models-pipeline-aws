export const environment = {
  production: true,
  /** Producción: vacío = no forzar redirección de origen (definir en build si hace falta). */
  canonicalBrowserOrigin: '',
  apiUrl: '/api',
  /**
   * Vacío = en el navegador se usa `origen actual + /auth/callback` (recomendado).
   * Solo fija una URL absoluta en el build de producción si el SPA y Cognito no comparten origen.
   */
  cognitoRedirectUri: '',
  cognitoDomain: '',
  cognitoClientId: '',
};
