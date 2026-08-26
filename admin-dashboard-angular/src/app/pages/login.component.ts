import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <form class="card login-card" (ngSubmit)="submit()">
        <h1>Admin login</h1>
        <p class="muted">Trainify / Promax — admin only</p>
        <label>Email</label>
        <input name="email" [(ngModel)]="email" type="email" required />
        <label>Password</label>
        <input name="password" [(ngModel)]="password" type="password" required />
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <button class="btn" type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
        this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (e) => {
        this.error.set(e.message || 'Login failed');
        this.loading.set(false);
      },
    });
  }
}
