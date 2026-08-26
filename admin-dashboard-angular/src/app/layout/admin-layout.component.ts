import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="side">
        <div class="brand">Trainify Admin</div>
        <nav>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Overview</a>
          <a routerLink="/coaches" routerLinkActive="active">Coaches</a>
          <a routerLink="/athletes" routerLinkActive="active">Athletes</a>
          <a routerLink="/payments" routerLinkActive="active">Payments</a>
          <a routerLink="/subscriptions" routerLinkActive="active">Subscriptions</a>
          <a routerLink="/payouts" routerLinkActive="active">Payouts</a>
          <a routerLink="/settings" routerLinkActive="active">App version</a>
          <a routerLink="/coming-soon/notifications" routerLinkActive="active">Notifications</a>
          <a routerLink="/coming-soon/chat" routerLinkActive="active">Chat</a>
          <a routerLink="/coming-soon/gallery" routerLinkActive="active">Gallery</a>
        </nav>
      </aside>
      <div class="main">
        <header class="top">
          <span>{{ auth.user()?.name || auth.user()?.email }}</span>
          <button class="btn ghost" type="button" (click)="auth.logout()">Logout</button>
        </header>
        <div class="content"><router-outlet /></div>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  auth = inject(AuthService);
}
