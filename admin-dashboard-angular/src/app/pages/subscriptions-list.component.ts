import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

type CoachSubs = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  counts?: {
    active: number;
    pending: number;
    expired: number;
    rejected: number;
    refunded: number;
    other: number;
    total: number;
  };
};

@Component({
  selector: 'app-subscriptions-list',
  imports: [RouterLink],
  styles: `
    .chip { display: inline-block; margin-right: 0.4rem; font-size: 0.8rem; color: var(--muted); }
  `,
  template: `
    <h1>Subscriptions</h1>
    <p class="muted">Follow each coach’s trainees, current week, and assignment status.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Coach</th>
            <th>Email</th>
            <th>Active</th>
            <th>Pending</th>
            <th>Expired</th>
            <th>Rejected</th>
            <th>Refunded</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of coaches(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td>{{ c.email }}</td>
              <td>{{ c.counts?.active ?? 0 }}</td>
              <td>{{ c.counts?.pending ?? 0 }}</td>
              <td>{{ c.counts?.expired ?? 0 }}</td>
              <td>{{ c.counts?.rejected ?? 0 }}</td>
              <td>{{ c.counts?.refunded ?? 0 }}</td>
              <td>{{ c.counts?.total ?? 0 }}</td>
              <td>
                <a class="btn sm" [routerLink]="['/subscriptions', c.id]">Open</a>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!coaches().length && !error()) { <p class="muted pad">No subscriptions yet.</p> }
    </div>
  `,
})
export class SubscriptionsListComponent implements OnInit {
  private api = inject(ApiService);
  coaches = signal<CoachSubs[]>([]);
  error = signal('');

  ngOnInit() {
    this.api.get<{ data?: CoachSubs[] }>('/api/admin/subscriptions/coaches').subscribe({
      next: (r) => this.coaches.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
  }
}
