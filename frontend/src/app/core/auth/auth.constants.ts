export const NR_TOKEN_KEY = 'nr_access_token';
/** Tras Hosted UI, volver a esta ruta (sessionStorage). */
export const NR_RETURN_URL_KEY = 'nr_return_url';
/** Mismo redirect_uri que en /oauth2/authorize (debe coincidir con Cognito y con el POST /exchange). */
export const NR_OAUTH_REDIRECT_KEY = 'nr_oauth_redirect_uri';
/** CSRF: parámetro state devuelto por Cognito. */
export const NR_OAUTH_STATE_KEY = 'nr_oauth_state';
