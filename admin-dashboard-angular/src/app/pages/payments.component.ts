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
            <a [href]="src" target="_blank"><img class="proof" [src]="src" alt="proof" /></a>
          }
          <div class="actions">
            <button class="btn sm" type="button" (click)="act(p.id, 'active')">Approve</button>
            <button class="btn sm ghost" type="button" (click)="reject(p.id)">Reject</button>
            <button class="btn sm ghost" type="button" (click)="act(p.id, 'refunded')">Refund</button>
          </div>
        </article>
      }
    </div>
    @if (!payments().length && !error()) { <p class="muted">No pending payments.</p> }

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

  ngOnInit() {
    this.load();
  }

  img(path?: string) {
    return this.api.mediaUrl(path);
  }

  onHistoryStatus(event: Event) {
    this.historyStatus = (event.target as HTMLSelectElement).value;
    this.loadHistory();
  }

  load() {
    this.api.get<{ data?: Payment[] }>('/api/admin/coaches/subscription').subscribe({
      next: (r) => this.payments.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
    this.loadHistory();
  }

  loadHistory() {
    this.historyError.set('');
    const q = this.historyStatus ? `?status=${this.historyStatus}` : '';
    this.api.get<{ data?: Payment[] }>(`/api/admin/subscriptions/payments${q}`).subscribe({
      next: (r) => this.history.set(r.data || []),
      error: (e) => this.historyError.set(e.message),
    });
  }

  reject(id: string) {
    const reason = prompt('Rejection reason (optional)') || undefined;
    this.act(id, 'rejected', reason);
  }

  act(id: string, status: string, rejectionReason?: string) {
    this.msg.set('');
    this.api
      .put(`/api/admin/coaches/subscription/confirm/${id}`, { status, rejectionReason })
      .subscribe({
        next: () => {
          this.msg.set('Updated');
          this.load();
        },
        error: (e) => this.error.set(e.message),
      });
  }
}
