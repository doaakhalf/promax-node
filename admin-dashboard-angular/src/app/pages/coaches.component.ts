import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { money, withCoachPricing } from '../core/money';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

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
  AcceptTermsAndConditions?: boolean;
  weeklySubscriptionEnabled?: boolean;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalCoaches?: number;
};

@Component({
  selector: 'app-coaches',
  imports: [FormsModule, ScrollSentinelComponent],
  template: `
    <h1>Coaches</h1>
    <p class="muted">Coach price is registered. Athlete price includes platform fee.</p>
    <div class="filters">
      <select [(ngModel)]="status" (ngModelChange)="onStatusChange()">
        <option value="pending">pending</option>
        <option value="active">active</option>
        <option value="rejected">rejected</option>
        <option value="inactive">inactive</option>
      </select>
      <input
        type="search"
        [(ngModel)]="search"
        name="search"
        placeholder="Search name, email, or phone…"
        (keyup.enter)="onSearch()"
      />
      <button class="btn sm" type="button" (click)="onSearch()">Search</button>
    </div>
    @if (list.error()) { <p class="err">{{ list.error() }}</p> }
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
            <th>Terms</th>
            <th>Weekly</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of list.items(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td>{{ c.email }}</td>
              <td>{{ c.phone }}</td>
              <td>{{ money(c.coachPrice) }}</td>
              <td>{{ money(c.platformFee) }}</td>
              <td>{{ money(c.price) }}</td>
              <td>{{ formatLastSeen(c.lastSeenAt) }}</td>
              <td [class.ok]="c.AcceptTermsAndConditions === true" [class.muted]="c.AcceptTermsAndConditions !== true">
                {{ c.AcceptTermsAndConditions === true ? 'Yes' : 'No' }}
              </td>
              <td [class.ok]="c.weeklySubscriptionEnabled === true" [class.muted]="c.weeklySubscriptionEnabled !== true">
                {{ c.weeklySubscriptionEnabled === true ? 'Yes' : 'No' }}
              </td>
              <td>{{ c.status }}</td>
              <td class="actions">
                <button class="btn sm" type="button" (click)="change(c.id, 'active')">Active</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'pending')">Pending</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'rejected')">Reject</button>
                <button class="btn sm warning" type="button" (click)="change(c.id, 'inactive')">Deactivate</button>

                <button class="btn sm danger" type="button" (click)="remove(c)">Remove</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!list.items().length && !list.loading() && !list.error()) { <p class="muted pad">No coaches.</p> }
    </div>
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} coaches</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin: 0.75rem 0;
    }
    .filters select {
      width: 160px;
      margin: 0;
    }
    .filters input {
      flex: 1 1 220px;
      max-width: 360px;
      margin: 0;
    }
  `,
})
export class CoachesComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  status = 'pending';
  search = '';
  msg = signal('');

  readonly list = new PagedList<CoachRow>(
    (page) => {
      const params = new URLSearchParams({ status: this.status, page: String(page) });
      const q = this.search.trim();
      if (q) params.set('q', q);
      return this.api
        .get<{ coaches?: CoachRow[]; pagination?: Pagination }>(`/api/admin/coaches?${params}`)
        .pipe(
          map((r) => ({
            items: (r.coaches || []).map(withCoachPricing),
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.totalCoaches || r.coaches?.length || 0,
          }))
        );
    },
    (c) => c.id
  );

  ngOnInit() {
    this.list.reset();
  }

  formatLastSeen(value?: string | null): string {
    if (!value) return 'Never';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Never';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onStatusChange() {
    this.list.reset();
  }

  onSearch() {
    this.list.reset();
  }

  change(id: string, status: string) {
    this.msg.set('');
    this.api.put(`/api/coaches/${id}/change-status?status=${status}`).subscribe({
      next: () => {
        this.msg.set('Status updated');
        this.list.refresh();
      },
      error: (e) => this.list.error.set(e.message),
    });
  }

  remove(c: CoachRow) {
    if (!confirm(`Permanently delete ${c.name || c.email}? This cannot be undone.`)) return;
    this.change(c.id, 'removed');
  }
}
