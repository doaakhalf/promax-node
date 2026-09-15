import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-notifications',
  imports: [FormsModule],
  template: `
    <h1>Broadcast notification</h1>
    <p class="muted">
      Sends a push only to devices on the <code>guests</code> FCM topic
      (users who have not signed up / logged in).
    </p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <form class="card form" (ngSubmit)="send()">
      <label>Title</label>
      <input name="title" [(ngModel)]="title" required />
      <label>Message</label>
      <textarea name="message" [(ngModel)]="message" rows="4" required></textarea>
      <p class="muted">Topic: <code>guests</code></p>
      <button class="btn" type="submit" [disabled]="sending()">
        {{ sending() ? 'Sending…' : 'Send broadcast' }}
      </button>
    </form>
  `,
})
export class NotificationsComponent {
  private api = inject(ApiService);
  title = '';
  message = '';
  error = signal('');
  msg = signal('');
  sending = signal(false);

  send() {
    this.error.set('');
    this.msg.set('');

    const title = this.title.trim();
    const message = this.message.trim();
    if (!title || !message) {
      this.error.set('Title and message are required');
      return;
    }

    if (
      !confirm(
        'This will be sent only to guest devices (no account). Continue?'
      )
    ) {
      return;
    }

    this.sending.set(true);
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
          this.sending.set(false);
          const id = r.data?.messageId ? ` (${r.data.messageId})` : '';
          this.msg.set(`Broadcast sent${id}`);
          this.title = '';
          this.message = '';
        },
        error: (e) => {
          this.sending.set(false);
          this.error.set(e.message);
        },
      });
  }
}
