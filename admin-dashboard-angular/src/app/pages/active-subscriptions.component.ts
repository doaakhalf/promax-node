import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';
import { money } from '../core/money';

type Payment = {
  id: string;
  paymentImage?: string;
  status?: string;
  amount?: number;
  platformFee?: number;
  coachNetAmount?: number;
  currency?: string;
  subscriptionPlan?: string;
  paymentMethod?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  coach?: { name?: string; email?: string };
  athlete?: { name?: string; email?: string };
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

@Component({
  selector: 'app-active-subscriptions',
  imports: [DatePipe, ScrollSentinelComponent],
  template: `
    <h1>Active subscriptions</h1>
    <p class="muted">Subscription payments. Active is selected by default.</p>
    <div class="row" style="max-width: 220px">
      <select [value]="status" (change)="onStatus($event)">
        <option value="">all except pending</option>
        <option value="active">active</option>
        <option value="rejected">rejected</option>
        <option value="refunded">refunded</option>
        <option value="expired">expired</option>
      </select>
    </div>
    @if (list.error()) { <p class="err">{{ list.error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Athlete</th>
            <th>Coach</th>
            <th>Plan</th>
            <th>Athlete pays</th>
            <th>Platform fee</th>
            <th>Coach net</th>
            <th>Method</th>
            <th>Period</th>
            <th>Verified</th>
            <th>Reason</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          @for (p of list.items(); track p.id) {
            <tr>
              <td>{{ p.status }}</td>
              <td>
                <div>{{ p.athlete?.name || '—' }}</div>
                <div class="muted">{{ p.athlete?.email }}</div>
              </td>
              <td>
                <div>{{ p.coach?.name || '—' }}</div>
                <div class="muted">{{ p.coach?.email }}</div>
              </td>
              <td>{{ p.subscriptionPlan }}</td>
              <td>{{ money(p.amount) }}</td>
              <td>{{ money(p.platformFee) }}</td>
              <td>{{ money(p.coachNetAmount) }}</td>
              <td>{{ p.paymentMethod }}</td>
              <td>
                {{ p.startDate | date:'mediumDate' }}
                → {{ p.endDate | date:'mediumDate' }}
              </td>
              <td>{{ p.verifiedAt | date:'medium' }}</td>
              <td>{{ p.rejectionReason || '—' }}</td>
              <td>
                @if (img(p.paymentImage); as src) {
                  <a [href]="src" target="_blank">Open</a>
                } @else {
                  —
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!list.items().length && !list.loading() && !list.error()) {
        <p class="muted pad">No payments for this filter.</p>
      }
    </div>
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} payments</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
})
export class ActiveSubscriptionsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  status = 'active';

  readonly list = new PagedList<Payment>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.status) params.set('status', this.status);
      return this.api
        .get<{ data?: Payment[]; pagination?: Pagination }>(
          `/api/admin/subscriptions/payments?${params.toString()}`
        )
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.total || r.data?.length || 0,
          }))
        );
    },
    (p) => p.id
  );

  ngOnInit() {
    this.list.reset();
  }

  img(path?: string) {
    return this.api.mediaUrl(path);
  }

  onStatus(event: Event) {
    this.status = (event.target as HTMLSelectElement).value;
    this.list.reset();
  }
}
