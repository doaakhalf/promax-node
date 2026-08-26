import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly base = environment.apiBase;

  private authHeaders(json = true): HttpHeaders {
    const token = localStorage.getItem('admin_token');
    let h = new HttpHeaders();
    if (json) h = h.set('Content-Type', 'application/json');
    if (token) h = h.set('Authorization', `Bearer ${token}`);
    return h;
  }

  private headers(): HttpHeaders {
    return this.authHeaders(true);
  }

  get<T>(path: string): Observable<T> {
    return this.http
      .get<T>(`${this.base}${path}`, { headers: this.headers() })
      .pipe(catchError(this.handle));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .post<T>(`${this.base}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handle));
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .put<T>(`${this.base}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handle));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<T>(`${this.base}${path}`, body, { headers: this.headers() })
      .pipe(catchError(this.handle));
  }

  /** Multipart PATCH (e.g. mark paid with proof image). Do not set Content-Type. */
  patchFormData<T>(path: string, formData: FormData): Observable<T> {
    return this.http
      .patch<T>(`${this.base}${path}`, formData, { headers: this.authHeaders(false) })
      .pipe(catchError(this.handle));
  }

  mediaUrl(path?: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.base}/${path.replace(/^\//, '')}`;
  }

  private handle = (err: HttpErrorResponse) => {
    const msg =
      err.error?.message || err.message || `Request failed (${err.status})`;
    return throwError(() => new Error(msg));
  };
}
