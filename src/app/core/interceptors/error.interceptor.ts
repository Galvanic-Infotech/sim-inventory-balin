import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionExpiredService } from '../services/session-expired.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const sessionExpired = inject(SessionExpiredService);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401 && auth.getToken()) {
        sessionExpired.handle();
      }
      return throwError(() => error);
    }),
  );
};
