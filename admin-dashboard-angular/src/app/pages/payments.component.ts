import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
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
  selector: 'app-payments',
  imports: [DatePipe],
  template: `
    <h1>Subscription payments</h1>
    <p class="muted">Athlete pays the total. Platform fee is ours. Coach net is paid later in payouts.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <div class="grid">
      @for (p of payments(); track p.id) {
        <article class="card pad">
          <div class="label">{{ p.subscriptionPlan }}</div>
          <p>Athlete: {{ p.athlete?.name || '—' }}</p>
          <p>Coach: {{ p.coach?.name || '—' }}</p>
          <p>Method: {{ p.paymentMethod }}</p>
          <dl class="money-split">
            <div><dt>Athlete pays</dt><dd>{{ money(p.amount) }}</dd></div>
            <div><dt>Platform fee</dt><dd>{{ money(p.platformFee) }}</dd></div>
            <div><dt>Coach net</dt><dd>{{ money(p.coachNetAmount) }}</dd></div>
          </dl>
          @if (img(p.paymentImage); as src) {
            <a [href]="src" target="_blank"><img class="proof" [src]="src" alt="proof" loading="lazy" /></a>
          }
          <div class="actions">
            <button class="btn sm" type="button" [disabled]="actingId() === p.id" (click)="act(p.id, 'active')">Approve</button>
            <button class="btn sm ghost" type="button" [disabled]="actingId() === p.id" (click)="reject(p.id)">Reject</button>
            <button class="btn sm ghost" type="button" [disabled]="actingId() === p.id" (click)="act(p.id, 'refunded')">Refund</button>
          </div>
        </article>
      }
    </div>
    @if (!payments().length && !error()) { <p class="muted">No pending payments.</p> }
    @if (pendingTotalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="pendingPage === 1" (click)="changePendingPage(-1)">Previous</button>
        <span class="muted">Page {{ pendingPage }} / {{ pendingTotalPages() }}</span>
        <button class="btn sm ghost" type="button" [disabled]="pendingPage >= pendingTotalPages()" (click)="changePendingPage(1)">Next</button>
      </div>
    }

    <h2>All processed payments</h2>
    <p class="muted">Every subscription payment except pending.</p>
    <div class="row" style="max-width: 220px">
      <select [value]="historyStatus" (change)="onHistoryStatus($event)">
        <option value="">all except pending</option>
        <option value="active">active</option>
        <option value="rejected">rejected</option>
        <option value="refunded">refunded</option>
        <option value="expired">expired</option>
      </select>
    </div>
    @if (historyError()) { <p class="err">{{ historyError() }}</p> }
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
          @for (p of history(); track p.id) {
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
      @if (!history().length && !historyError()) {
        <p class="muted pad">No processed payments.</p>
      }
    </div>
    @if (historyTotalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="historyPage === 1" (click)="changeHistoryPage(-1)">Previous</button>
        <span class="muted">Page {{ historyPage }} / {{ historyTotalPages() }}</span>
        <button class="btn sm ghost" type="button" [disabled]="historyPage >= historyTotalPages()" (click)="changeHistoryPage(1)">Next</button>
      </div>
    }
  `,
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  payments = signal<Payment[]>([]);
  history = signal<Payment[]>([]);
  error = signal('');
  historyError = signal('');
  msg = signal('');
  historyStatus = '';
  pendingPage = 1;
  pendingTotalPages = signal(1);
  historyPage = 1;
  historyTotalPages = signal(1);
  actingId = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  img(path?: string) {
    return this.api.mediaUrl(path);
  }

  onHistoryStatus(event: Event) {
    this.historyStatus = (event.target as HTMLSelectElement).value;
    this.historyPage = 1;
    this.loadHistory();
  }

  load() {
    this.loadPending();
    this.loadHistory();
  }

  loadPending() {
    this.api.get<{ data?: Payment[]; pagination?: Pagination }>(
      `/api/admin/coaches/subscription?page=${this.pendingPage}&limit=20`
    ).subscribe({
      next: (r) => {
        this.payments.set(r.data || []);
        this.pendingTotalPages.set(r.pagination?.totalPages || 1);
      },
      error: (e) => this.error.set(e.message),
    });
  }

  loadHistory() {
    this.historyError.set('');
    const params = new URLSearchParams({
      page: String(this.historyPage),
      limit: '20',
    });
    if (this.historyStatus) params.set('status', this.historyStatus);
    this.api.get<{ data?: Payment[]; pagination?: Pagination }>(
      `/api/admin/subscriptions/payments?${params.toString()}`
    ).subscribe({
      next: (r) => {
        this.history.set(r.data || []);
        this.historyTotalPages.set(r.pagination?.totalPages || 1);
      },
      error: (e) => this.historyError.set(e.message),
    });
  }

  changePendingPage(delta: number) {
    this.pendingPage = Math.max(this.pendingPage + delta, 1);
    this.loadPending();
  }

  changeHistoryPage(delta: number) {
    this.historyPage = Math.max(this.historyPage + delta, 1);
    this.loadHistory();
  }

  reject(id: string) {
    const reason = prompt('Rejection reason (optional)') || undefined;
    this.act(id, 'rejected', reason);
  }

  act(id: string, status: string, rejectionReason?: string) {
    if (this.actingId()) return;
    this.msg.set('');
    this.actingId.set(id);
    this.api
      .put(`/api/admin/coaches/subscription/confirm/${id}`, { status, rejectionReason })
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.msg.set('Updated');
          this.load();
        },
        error: (e) => {
          this.actingId.set(null);
          this.error.set(e.message);
        },
      });
  }
}
