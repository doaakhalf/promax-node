import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** On 401, refresh access token once and retry the request. */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const url = req.url;

  const skipRefresh =
    url.includes('/api/user/refresh') || url.includes('/api/login');

  if (skipRefresh) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((token) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${token}` },
            })
          )
        ),
        catchError(() => {
          auth.logout();
          return throwError(() => err);
        })
      );
    })
  );
};
