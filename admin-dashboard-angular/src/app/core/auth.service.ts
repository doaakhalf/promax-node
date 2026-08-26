import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';

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
  private router = inject(Router);

  readonly user = signal<AdminUser | null>(this.readUser());
  readonly token = signal<string | null>(localStorage.getItem('admin_token'));

  isAdmin(): boolean {
    const role = (this.user()?.role || '').toLowerCase();
    return role === 'admin';
  }

  login(email: string, password: string) {
    return this.api
      .post<{ token: string; user?: AdminUser }>('/api/login', { email, password })
      .pipe(
        tap((res) => {
          const user = res.user || {};
          const role = (user.role || '').toLowerCase();
          if (role !== 'admin') {
            throw new Error('Admin role required');
          }
          localStorage.setItem('admin_token', res.token);
          localStorage.setItem('admin_user', JSON.stringify(user));
          this.token.set(res.token);
          this.user.set(user);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
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
