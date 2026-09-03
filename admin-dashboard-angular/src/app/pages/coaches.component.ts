import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { money, withCoachPricing } from '../core/money';

type CoachRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  price?: number;
  coachPrice?: number;
  platformFee?: number;
  lastSeenAt?: string | null;
};

@Component({
  selector: 'app-coaches',
  imports: [FormsModule],
  template: `
    <h1>Coaches</h1>
    <p class="muted">Coach price is registered. Athlete price includes platform fee.</p>
    <div class="row">
      <select [(ngModel)]="status" (ngModelChange)="load()">
        <option value="pending">pending</option>
        <option value="active">active</option>
        <option value="rejected">rejected</option>
      </select>
    </div>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Coach price</th>
            <th>Platform fee</th>
            <th>Athlete price</th>
            <th>Last Seen</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of coaches(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td>{{ c.email }}</td>
              <td>{{ c.phone }}</td>
              <td>{{ money(c.coachPrice) }}</td>
              <td>{{ money(c.platformFee) }}</td>
              <td>{{ money(c.price) }}</td>
              <td>{{ formatLastSeen(c.lastSeenAt) }}</td>
              <td>{{ c.status }}</td>
              <td class="actions">
                <button class="btn sm" type="button" (click)="change(c.id, 'active')">Active</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'pending')">Pending</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'rejected')">Reject</button>
                <button class="btn sm danger" type="button" (click)="remove(c)">Remove</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!coaches().length && !error()) { <p class="muted pad">No coaches.</p> }
    </div>
  `,
})
export class CoachesComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  status = 'pending';
  coaches = signal<CoachRow[]>([]);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.load();
  }

  formatLastSeen(value?: string | null): string {
    if (!value) return 'Never';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Never';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  load() {
    this.error.set('');
    this.api.get<{ coaches?: CoachRow[] }>(`/api/coaches?status=${this.status}&page=1`).subscribe({
      next: (r) => this.coaches.set((r.coaches || []).map(withCoachPricing)),
      error: (e) => this.error.set(e.message),
    });
  }

  change(id: string, status: string) {
    this.msg.set('');
    this.api.put(`/api/coaches/${id}/change-status?status=${status}`).subscribe({
      next: () => {
        this.msg.set('Status updated');
        this.load();
      },
      error: (e) => this.error.set(e.message),
    });
  }

  remove(c: CoachRow) {
    if (!confirm(`Permanently delete ${c.name || c.email}? This cannot be undone.`)) return;
    this.change(c.id, 'removed');
  }
}
