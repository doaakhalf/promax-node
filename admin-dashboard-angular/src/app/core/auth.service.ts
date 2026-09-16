import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

export type AdminUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<AdminUser | null>(this.readUser());
  readonly token = signal<string | null>(localStorage.getItem('admin_token'));

  private refreshInFlight$: Observable<string> | null = null;

  isAdmin(): boolean {
    const role = (this.user()?.role || '').toLowerCase();
    return role === 'admin';
  }

  login(email: string, password: string) {
    return this.api
      .post<{ token: string; refreshToken?: string; user?: AdminUser }>(
        '/api/login',
        { email, password }
      )
      .pipe(
        tap((res) => {
          const user = res.user || {};
          const role = (user.role || '').toLowerCase();
          if (role !== 'admin') {
            throw new Error('Admin role required');
          }
          if (!res.refreshToken) {
            throw new Error('Refresh token missing from login response');
          }
          this.persistSession(res.token, res.refreshToken, user);
        })
      );
  }

  /** Exchange refresh token for a new access (+ refresh) pair. Dedupes concurrent calls. */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = localStorage.getItem('admin_refresh_token');
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    this.refreshInFlight$ = this.http
      .post<{ token: string; refreshToken: string }>(
        `${environment.apiBase}/api/user/refresh`,
        { refreshToken }
      )
      .pipe(
        tap((res) => {
          localStorage.setItem('admin_token', res.token);
          localStorage.setItem('admin_refresh_token', res.refreshToken);
          this.token.set(res.token);
        }),
        map((res) => res.token),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );

    return this.refreshInFlight$;
  }

  logout(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private persistSession(
    token: string,
    refreshToken: string,
    user: AdminUser
  ): void {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_refresh_token', refreshToken);
    localStorage.setItem('admin_user', JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }

  private readUser(): AdminUser | null {
    try {
      const raw = localStorage.getItem('admin_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
