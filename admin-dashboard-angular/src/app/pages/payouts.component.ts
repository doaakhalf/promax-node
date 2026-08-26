import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

type UpcomingRow = {
  coachId: string;
  amount: number;
  coach?: { name?: string };
};

type Upcoming = {
  scheduledDate?: string;
  periodLabel?: string;
  totalAmount?: number;
  coachCount?: number;
  payouts?: UpcomingRow[];
};

type Payout = {
  _id: string;
  status?: string;
  amount?: number;
  scheduledDate?: string;
  coachId?: { firstName?: string; lastName?: string; email?: string } | string;
};

type PayoutItem = {
  athleteName?: string;
  allocatedAmount?: number;
  coachNetAmount?: number;
  platformFee?: number;
  weeklyRate?: number;
  weeksCount?: number;
  grossAmount?: number;
};

type CoachDetails = {
  coach?: { name?: string };
  totalAmount?: number;
  items?: PayoutItem[];
};

@Component({
  selector: 'app-payouts',
  imports: [DatePipe],
  template: `
    <h1>Payouts</h1>
    <p class="muted">Amounts are coach net (weekly share of coach price). Platform fee stays with us and is not transferred.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="kpis">
      <div class="card kpi"><div class="label">Period</div><div class="num sm">{{ upcoming()?.periodLabel || '—' }}</div></div>
      <div class="card kpi"><div class="label">Coach net total</div><div class="num sm">{{ money(upcoming()?.totalAmount) }}</div></div>
      <div class="card kpi"><div class="label">Coaches</div><div class="num">{{ upcoming()?.coachCount ?? 0 }}</div></div>
    </div>

    <div class="actions">
      <button class="btn" type="button" (click)="generate()">Generate drafts</button>
      <button class="btn ghost" type="button" (click)="load()">Refresh</button>
    </div>

    <h2>Upcoming (coach net)</h2>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Coach</th><th>Payout (net)</th><th></th></tr></thead>
        <tbody>
          @for (p of upcoming()?.payouts || []; track p.coachId) {
            <tr>
              <td>{{ p.coach?.name || p.coachId }}</td>
              <td>{{ money(p.amount) }}</td>
              <td>
                <button class="btn sm ghost" type="button" (click)="openDetails(p.coachId)">Details</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (details()) {
      <h2>Breakdown · {{ details()?.coach?.name }}</h2>
      <p class="muted">Eligible weeks pay weeklyRate = coachNet / 4. Platform fee is not included.</p>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Athlete paid</th>
              <th>Platform fee</th>
              <th>Coach net / month</th>
              <th>Weekly rate</th>
              <th>Eligible weeks</th>
              <th>This payout</th>
            </tr>
          </thead>
          <tbody>
            @for (item of details()?.items || []; track $index) {
              <tr>
                <td>{{ item.athleteName }}</td>
                <td>{{ money(item.grossAmount) }}</td>
                <td>{{ money(item.platformFee) }}</td>
                <td>{{ money(item.coachNetAmount) }}</td>
                <td>{{ money(item.weeklyRate) }}</td>
                <td>{{ item.weeksCount ?? 0 }}</td>
                <td>{{ money(item.allocatedAmount) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <h2>History</h2>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Coach</th><th>Coach net</th><th>Status</th><th>Scheduled</th><th></th></tr></thead>
        <tbody>
          @for (p of history(); track p._id) {
            <tr>
              <td>{{ coachName(p) }}</td>
              <td>{{ money(p.amount) }}</td>
              <td>{{ p.status }}</td>
              <td>{{ p.scheduledDate | date:'mediumDate' }}</td>
              <td>
                @if (p.status !== 'paid') {
                  <button class="btn sm" type="button" (click)="markPaid(p._id)">Mark paid</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PayoutsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  upcoming = signal<Upcoming | null>(null);
  history = signal<Payout[]>([]);
  details = signal<CoachDetails | null>(null);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.load();
  }

  coachName(p: Payout) {
    const c = p.coachId;
    if (c && typeof c === 'object') return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
    return String(c || '');
  }

  load() {
    this.api.get<{ data?: Upcoming }>('/api/admin/payouts/upcoming').subscribe({
      next: (r) => this.upcoming.set(r.data || null),
      error: (e) => this.error.set(e.message),
    });
    this.api.get<{ data?: Payout[] }>('/api/admin/payouts').subscribe({
      next: (r) => this.history.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
  }

  openDetails(coachId: string) {
    this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${coachId}`).subscribe({
      next: (r) => this.details.set(r.data || null),
      error: (e) => this.error.set(e.message),
    });
  }

  generate() {
    if (!confirm('Generate payout drafts for the current period?')) return;
    this.api.post('/api/admin/payouts/generate', {}).subscribe({
      next: () => {
        this.msg.set('Generated');
        this.load();
      },
      error: (e) => this.error.set(e.message),
    });
  }

  markPaid(id: string) {
    const ref = prompt('Payment reference (optional)') || undefined;
    if (!confirm('Mark this payout as paid?')) return;
    this.api.patch(`/api/admin/payouts/${id}/mark-paid`, { paymentReference: ref }).subscribe({
      next: () => {
        this.msg.set('Marked paid');
        this.load();
      },
      error: (e) => this.error.set(e.message),
    });
  }
}
