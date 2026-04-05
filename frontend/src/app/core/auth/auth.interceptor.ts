import { HttpInterceptorFn } from '@angular/common/http';
import { NR_TOKEN_KEY } from './auth.constants';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  if (
    url.includes('/auth/login') ||
    url.includes('/auth/cognito/config') ||
    url.includes('/auth/cognito/exchange') ||
    url.includes('/auth/cognito/verify')
  ) {
    return next(req);
  }
  const token = sessionStorage.getItem(NR_TOKEN_KEY);
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
