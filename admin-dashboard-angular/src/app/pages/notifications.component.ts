import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type UserAudience = 'coaches' | 'athletes' | 'both';

type SearchUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  tokenCount?: number;
};

type DeliveryRow = {
  userId?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  inboxSaved?: boolean;
  pushStatus?: string;
  pushSuccessCount?: number;
  pushFailureCount?: number;
  tokenCount?: number;
  reason?: string | null;
};

type DeliveryReport = {
  audience?: string;
  total?: number;
  sent?: number;
  failed?: number;
  succeeded?: DeliveryRow[];
  failedRecipients?: DeliveryRow[];
};

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

    <h2>Send to one user</h2>
    <p class="muted">
      Choose coach or athlete, pick someone from the list by email, then send.
      Coach list shows <code>active</code> coaches only.
    </p>
    @if (singleError()) { <p class="err">{{ singleError() }}</p> }
    @if (singleMsg()) { <p class="ok">{{ singleMsg() }}</p> }
    <form class="card form" (ngSubmit)="sendToOne()">
      <label>Type</label>
      <select
        name="singleRole"
        [(ngModel)]="singleRole"
        (ngModelChange)="onSingleRoleChange()"
      >
        <option value="">Select…</option>
        <option value="coach">Coach</option>
        <option value="athlete">Athlete</option>
      </select>

      @if (singleRole) {
        <label>Filter email</label>
        <input
          name="emailFilter"
          [(ngModel)]="emailFilter"
          placeholder="e.g. medo@gmail.com"
          (ngModelChange)="selectedUserId = ''"
        />
        <label>User (by email)</label>
        @if (loadingUsers()) {
          <p class="muted">Loading list…</p>
        } @else {
          <p class="muted">
            Showing {{ filteredUserList().length }} of {{ userList().length }} {{ singleRole }}s
          </p>
          <select name="selectedUserId" [(ngModel)]="selectedUserId" required>
            <option value="">Select email…</option>
            @for (u of filteredUserList(); track u.id) {
              <option [value]="u.id">
                {{ u.email }}{{ u.name ? ' — ' + u.name : '' }}
              </option>
            }
          </select>
          @if (!userList().length) {
            <p class="muted">No {{ singleRole }}s found.</p>
          } @else if (emailFilter.trim() && !filteredUserList().length) {
            <p class="err">
              {{ emailFilter.trim() }} is not in the {{ singleRole }} list
              (wrong role, deleted, or email mismatch). Try the other type.
            </p>
          }
        }
      }

      <label>Title</label>
      <input name="singleTitle" [(ngModel)]="singleTitle" required />
      <label>Message</label>
      <textarea name="singleMessage" [(ngModel)]="singleMessage" rows="4" required></textarea>
      <button class="btn" type="submit" [disabled]="singleSending() || !selectedUserId">
        {{ singleSending() ? 'Sending…' : 'Send to user' }}
      </button>
    </form>

    <h2>Registered users (broadcast)</h2>
    <p class="muted">
      Push (+ in-app) to coaches and/or athletes who have an account, via their FCM tokens.
      Result counts are based on push delivery (at least one device success).
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

    @if (report(); as r) {
      <h2>Last send report</h2>
      <p class="muted">
        Total {{ r.total ?? 0 }} ·
        <span class="ok">{{ r.sent ?? 0 }} push delivered</span> ·
        <span class="err">{{ r.failed ?? 0 }} push failed</span>
      </p>

      <div class="grid report-grid">
        <div class="card table-wrap">
          <h3 class="pad ok">Succeeded ({{ r.succeeded?.length || 0 }})</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Push</th>
              </tr>
            </thead>
            <tbody>
              @for (row of r.succeeded || []; track row.userId) {
                <tr>
                  <td>{{ row.name || '—' }}</td>
                  <td>{{ row.email || '—' }}</td>
                  <td>{{ row.role || '—' }}</td>
                  <td>
                    {{ row.pushStatus }}
                    @if (row.tokenCount != null) {
                      ({{ row.pushSuccessCount ?? 0 }}/{{ row.tokenCount }})
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (!(r.succeeded?.length)) {
            <p class="muted pad">None.</p>
          }
        </div>

        <div class="card table-wrap">
          <h3 class="pad err">Failed ({{ r.failedRecipients?.length || 0 }})</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              @for (row of r.failedRecipients || []; track row.userId) {
                <tr>
                  <td>{{ row.name || '—' }}</td>
                  <td>{{ row.email || '—' }}</td>
                  <td>{{ row.role || '—' }}</td>
                  <td>{{ row.reason || row.pushStatus || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (!(r.failedRecipients?.length)) {
            <p class="muted pad">None.</p>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .report-grid { margin-top: 0.75rem; }
    h3 { margin: 0; font-size: 0.95rem; }
    .form { max-width: 560px; }
  `,
})
export class NotificationsComponent {
  private api = inject(ApiService);

  guestTitle = '';
  guestMessage = '';
  guestError = signal('');
  guestMsg = signal('');
  guestSending = signal(false);

  singleRole: '' | 'coach' | 'athlete' = '';
  selectedUserId = '';
  emailFilter = '';
  singleTitle = '';
  singleMessage = '';
  userList = signal<SearchUser[]>([]);
  loadingUsers = signal(false);
  singleError = signal('');
  singleMsg = signal('');
  singleSending = signal(false);

  audience: UserAudience = 'both';
  usersTitle = '';
  usersMessage = '';
  usersError = signal('');
  usersMsg = signal('');
  usersSending = signal(false);

  report = signal<DeliveryReport | null>(null);

  filteredUserList() {
    const q = this.emailFilter.trim().toLowerCase();
    const list = this.userList();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
    );
  }

  onSingleRoleChange() {
    this.selectedUserId = '';
    this.emailFilter = '';
    this.userList.set([]);
    this.singleError.set('');
    this.singleMsg.set('');

    if (!this.singleRole) return;

    this.loadingUsers.set(true);
    this.api
      .get<{ data?: SearchUser[] }>(
        `/api/admin/notifications/users?role=${encodeURIComponent(this.singleRole)}`
      )
      .subscribe({
        next: (r) => {
          this.loadingUsers.set(false);
          this.userList.set(r.data || []);
        },
        error: (e) => {
          this.loadingUsers.set(false);
          this.singleError.set(e.message);
        },
      });
  }

  sendToOne() {
    this.singleError.set('');
    this.singleMsg.set('');

    const title = this.singleTitle.trim();
    const message = this.singleMessage.trim();
    if (!this.selectedUserId || !title || !message) {
      this.singleError.set('Pick a user and enter title + message');
      return;
    }

    const picked = this.userList().find((u) => u.id === this.selectedUserId);
    const label = picked?.email || picked?.name || this.selectedUserId;
    if (!confirm(`Send notification to ${label}?`)) return;

    this.singleSending.set(true);
    this.api
      .post<{ status?: string; message?: string; data?: DeliveryReport }>(
        '/api/admin/notifications/send-to-user',
        { userId: this.selectedUserId, title, message }
      )
      .subscribe({
        next: (r) => {
          this.singleSending.set(false);
          const d = r.data;
          this.report.set(d || null);
          this.singleMsg.set(
            r.message ||
              `Done: ${d?.sent ?? 0} delivered, ${d?.failed ?? 0} failed`
          );
          this.singleTitle = '';
          this.singleMessage = '';
        },
        error: (e) => {
          this.singleSending.set(false);
          this.singleError.set(e.message);
        },
      });
  }

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
      .post<{ status?: string; message?: string; data?: DeliveryReport }>(
        '/api/admin/notifications/send-to-users',
        {
          title,
          message,
          audience: this.audience,
        }
      )
      .subscribe({
        next: (r) => {
          this.usersSending.set(false);
          const d = r.data;
          this.report.set(d || null);
          this.usersMsg.set(
            `Done: ${d?.sent ?? 0} push delivered, ${d?.failed ?? 0} failed (total ${d?.total ?? 0})`
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
