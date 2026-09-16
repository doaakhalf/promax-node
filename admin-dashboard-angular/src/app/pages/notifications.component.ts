import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type UserAudience = 'coaches' | 'athletes' | 'both';

@Component({
  selector: 'app-notifications',
  imports: [FormsModule],
  template: `
    <h1>Notifications</h1>

    <h2>Guests / logged-out</h2>
    <p class="muted">
      Sends a push to devices on the <code>guests</code> FCM topic:
      guests (no account) and logged-out users. Logged-in users are excluded.
    </p>
    @if (guestError()) { <p class="err">{{ guestError() }}</p> }
    @if (guestMsg()) { <p class="ok">{{ guestMsg() }}</p> }
    <form class="card form" (ngSubmit)="sendGuest()">
      <label>Title</label>
      <input name="guestTitle" [(ngModel)]="guestTitle" required />
      <label>Message</label>
      <textarea name="guestMessage" [(ngModel)]="guestMessage" rows="4" required></textarea>
      <p class="muted">Topic: <code>guests</code></p>
      <button class="btn" type="submit" [disabled]="guestSending()">
        {{ guestSending() ? 'Sending…' : 'Send to guests' }}
      </button>
    </form>

    <h2>Registered users</h2>
    <p class="muted">
      Push (+ in-app) to coaches and/or athletes who have an account, via their FCM tokens.
      Unrelated to the guests topic.
    </p>
    @if (usersError()) { <p class="err">{{ usersError() }}</p> }
    @if (usersMsg()) { <p class="ok">{{ usersMsg() }}</p> }
    <form class="card form" (ngSubmit)="sendToUsers()">
      <label>Audience</label>
      <select name="audience" [(ngModel)]="audience">
        <option value="coaches">Coaches</option>
        <option value="athletes">Athletes</option>
        <option value="both">Both</option>
      </select>
      <label>Title</label>
      <input name="usersTitle" [(ngModel)]="usersTitle" required />
      <label>Message</label>
      <textarea name="usersMessage" [(ngModel)]="usersMessage" rows="4" required></textarea>
      <button class="btn" type="submit" [disabled]="usersSending()">
        {{ usersSending() ? 'Sending…' : 'Send to users' }}
      </button>
    </form>
  `,
})
export class NotificationsComponent {
  private api = inject(ApiService);

  guestTitle = '';
  guestMessage = '';
  guestError = signal('');
  guestMsg = signal('');
  guestSending = signal(false);

  audience: UserAudience = 'both';
  usersTitle = '';
  usersMessage = '';
  usersError = signal('');
  usersMsg = signal('');
  usersSending = signal(false);

  sendGuest() {
    this.guestError.set('');
    this.guestMsg.set('');

    const title = this.guestTitle.trim();
    const message = this.guestMessage.trim();
    if (!title || !message) {
      this.guestError.set('Title and message are required');
      return;
    }

    if (
      !confirm(
        'This will be sent to guests and logged-out users (not logged-in). Continue?'
      )
    ) {
      return;
    }

    this.guestSending.set(true);
    this.api
      .post<{
        status?: string;
        message?: string;
        data?: { topic?: string; messageId?: string };
      }>('/api/admin/notifications/broadcast', {
        title,
        message,
        topic: 'guests',
      })
      .subscribe({
        next: (r) => {
          this.guestSending.set(false);
          const id = r.data?.messageId ? ` (${r.data.messageId})` : '';
          this.guestMsg.set(`Broadcast sent${id}`);
          this.guestTitle = '';
          this.guestMessage = '';
        },
        error: (e) => {
          this.guestSending.set(false);
          this.guestError.set(e.message);
        },
      });
  }

  sendToUsers() {
    this.usersError.set('');
    this.usersMsg.set('');

    const title = this.usersTitle.trim();
    const message = this.usersMessage.trim();
    if (!title || !message) {
      this.usersError.set('Title and message are required');
      return;
    }

    const label =
      this.audience === 'both'
        ? 'coaches and athletes'
        : this.audience === 'coaches'
          ? 'all coaches'
          : 'all athletes';

    if (!confirm(`This will be sent to ${label}. Continue?`)) {
      return;
    }

    this.usersSending.set(true);
    this.api
      .post<{
        status?: string;
        message?: string;
        data?: { audience?: string; total?: number; sent?: number; failed?: number };
      }>('/api/admin/notifications/send-to-users', {
        title,
        message,
        audience: this.audience,
      })
      .subscribe({
        next: (r) => {
          this.usersSending.set(false);
          const d = r.data;
          this.usersMsg.set(
            `Done: ${d?.sent ?? 0} sent, ${d?.failed ?? 0} failed (total ${d?.total ?? 0})`
          );
          this.usersTitle = '';
          this.usersMessage = '';
        },
        error: (e) => {
          this.usersSending.set(false);
          this.usersError.set(e.message);
        },
      });
  }
}
