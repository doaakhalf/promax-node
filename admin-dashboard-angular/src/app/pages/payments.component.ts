import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList, RevealList } from '../core/paged-list';
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

type CoachFinance = {
  coachId: string;
  name?: string;
  email?: string;
  totalCollected?: number;
  platformProfit?: number;
  coachShare?: number;
  paid?: number;
  owed?: number;
};

type FinanceSummary = {
  totalCollected?: number;
  platformProfit?: number;
  paidToCoaches?: number;
  owedToCoaches?: number;
  byCoach?: CoachFinance[];
};

@Component({
  selector: 'app-payments',
  imports: [DatePipe, ScrollSentinelComponent],
  styles: `
    .kpi.mine .num { color: var(--ok); }
    .kpi.owed .num { color: var(--warning); }
    .coach-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .coach-cell .name { font-weight: 600; }
    tr.row-open > td { border-bottom-color: transparent; }
    tr.expand-row > td {
      padding: 0;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--accent) 6%, var(--panel));
    }
    .expand-panel {
      margin: 0 0.5rem 0.75rem;
      padding: 0.85rem;
      border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
      border-radius: 10px;
      background: var(--panel);
    }
    .expand-panel dl.money-split { margin: 0; }
  `,
  template: `
    <h1>Subscription payments</h1>
    <p class="muted">Athlete pays the total. Platform fee is ours. Coach net is paid later in payouts.</p>
    @if (financeError()) { <p class="err">{{ financeError() }}</p> }
    @if (pendingList.error()) { <p class="err">{{ pendingList.error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="kpis">
      <div class="card kpi">
        <div class="label">Total collected</div>
        <div class="num sm">{{ money(finance()?.totalCollected) }}</div>
      </div>
      <div class="card kpi mine">
        <div class="label">My profit (platform fee)</div>
        <div class="num sm">{{ money(finance()?.platformProfit) }}</div>
      </div>
      <div class="card kpi">
        <div class="label">Paid to coaches</div>
        <div class="num sm">{{ money(finance()?.paidToCoaches) }}</div>
      </div>
      <div class="card kpi owed">
        <div class="label">Owed to coaches</div>
        <div class="num sm">{{ money(finance()?.owedToCoaches) }}</div>
      </div>
    </div>

    <h2>Per coach</h2>
    <p class="muted">Collected from athletes, your platform fee, coach share, and what was already paid out.</p>
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Coach</th>
            <th>Collected</th>
            <th>My profit</th>
            <th>Coach share</th>
            <th>Paid</th>
            <th>Owed</th>
          </tr>
        </thead>
        <tbody>
          @for (c of coachReveal.visible(); track c.coachId) {
            <tr [class.row-open]="expandedCoachId() === c.coachId">
              <td>
                <div class="coach-cell">
                  <span class="name">{{ c.name || '—' }}</span>
                  <button class="btn sm ghost" type="button" (click)="toggleCoach(c.coachId)">
                    {{ expandedCoachId() === c.coachId ? 'Close' : 'Details' }}
                  </button>
                </div>
                <div class="muted">{{ c.email }}</div>
              </td>
              <td>{{ money(c.totalCollected) }}</td>
              <td>{{ money(c.platformProfit) }}</td>
              <td>{{ money(c.coachShare) }}</td>
              <td>{{ money(c.paid) }}</td>
              <td>{{ money(c.owed) }}</td>
            </tr>
            @if (expandedCoachId() === c.coachId) {
              <tr class="expand-row">
                <td colspan="6">
                  <div class="expand-panel">
                    <dl class="money-split">
                      <div><dt>Collected</dt><dd>{{ money(c.totalCollected) }}</dd></div>
                      <div><dt>My profit</dt><dd>{{ money(c.platformProfit) }}</dd></div>
                      <div><dt>Coach share</dt><dd>{{ money(c.coachShare) }}</dd></div>
                      <div><dt>Paid out</dt><dd>{{ money(c.paid) }}</dd></div>
                      <div><dt>Still owed</dt><dd>{{ money(c.owed) }}</dd></div>
                    </dl>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
      @if (!coachReveal.total() && !financeError() && !financeLoading()) {
        <p class="muted pad">No coach finance activity yet.</p>
      }
      @if (financeLoading()) { <p class="muted pad">Loading summary…</p> }
    </div>
    @if (coachReveal.hasMore()) {
      <p class="muted list-status">Scroll to show more coaches ({{ coachReveal.visible().length }} / {{ coachReveal.total() }})</p>
    }
    @if (!coachReveal.hasMore() && coachReveal.total()) {
      <p class="muted list-status">Showing all {{ coachReveal.total() }} coaches</p>
    }
    <app-scroll-sentinel [disabled]="!coachReveal.hasMore()" (reached)="coachReveal.showMore()" />

    <h2>Pending approvals</h2>
    <div class="grid">
      @for (p of pendingList.items(); track p.id) {
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
    @if (!pendingList.items().length && !pendingList.loading() && !pendingList.error()) { <p class="muted">No pending payments.</p> }
    @if (pendingList.loading()) { <p class="muted list-status">{{ pendingList.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (pendingList.error() && pendingList.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="pendingList.loadMore()">Retry</button></div>
    }
    @if (!pendingList.hasMore() && pendingList.items().length) { <p class="muted list-status">Showing all {{ pendingList.total() }} pending payments</p> }
    <app-scroll-sentinel [disabled]="pendingList.loading() || !pendingList.hasMore() || !!pendingList.error()" (reached)="pendingList.loadMore()" />

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
    @if (historyList.error()) { <p class="err">{{ historyList.error() }}</p> }
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
          @for (p of historyList.items(); track p.id) {
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
      @if (!historyList.items().length && !historyList.loading() && !historyList.error()) {
        <p class="muted pad">No processed payments.</p>
      }
    </div>
    @if (historyList.loading()) { <p class="muted list-status">{{ historyList.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (historyList.error() && historyList.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="historyList.loadMore()">Retry</button></div>
    }
    @if (!historyList.hasMore() && historyList.items().length) { <p class="muted list-status">Showing all {{ historyList.total() }} processed payments</p> }
    <app-scroll-sentinel [disabled]="historyList.loading() || !historyList.hasMore() || !!historyList.error()" (reached)="historyList.loadMore()" />
  `,
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  msg = signal('');
  historyStatus = '';
  actingId = signal<string | null>(null);
  finance = signal<FinanceSummary | null>(null);
  financeError = signal('');
  financeLoading = signal(false);
  expandedCoachId = signal<string | null>(null);
  readonly coachReveal = new RevealList<CoachFinance>(20);

  readonly pendingList = new PagedList<Payment>(
    (page) =>
      this.api
        .get<{ data?: Payment[]; pagination?: Pagination }>(
          `/api/admin/coaches/subscription?page=${page}&limit=20`
        )
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.total || r.data?.length || 0,
          }))
        ),
    (p) => p.id
  );

  readonly historyList = new PagedList<Payment>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.historyStatus) params.set('status', this.historyStatus);
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
    this.load();
  }

  img(path?: string) {
    return this.api.mediaUrl(path);
  }

  toggleCoach(coachId: string) {
    this.expandedCoachId.set(this.expandedCoachId() === coachId ? null : coachId);
  }

  loadFinance() {
    this.financeLoading.set(true);
    this.financeError.set('');
    this.api.get<{ data?: FinanceSummary }>('/api/admin/payments/finance-summary').subscribe({
      next: (r) => {
        this.financeLoading.set(false);
        this.finance.set(r.data || null);
        this.coachReveal.set(r.data?.byCoach || []);
        const open = this.expandedCoachId();
        if (open && !(r.data?.byCoach || []).some((c) => c.coachId === open)) {
          this.expandedCoachId.set(null);
        }
      },
      error: (e) => {
        this.financeLoading.set(false);
        this.financeError.set(e.message);
      },
    });
  }

  onHistoryStatus(event: Event) {
    this.historyStatus = (event.target as HTMLSelectElement).value;
    this.historyList.reset();
  }

  load() {
    this.loadFinance();
    this.pendingList.reset();
    this.historyList.reset();
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
          this.pendingList.error.set(e.message);
        },
      });
  }
}
