import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    // Respect caller-set X-Entity-ID; only inject from auth state when absent.
    if (!req.headers.has('X-Entity-ID')) {
      headers['X-Entity-ID'] = auth.entityId();
    }
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
};
