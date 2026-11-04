import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

type BatchSummary = {
  transferDay: number;
  scheduledDate: string;
  totalAmount: number;
  coachCount: number;
  paidCount: number;
  pendingCount: number;
};

type MonthSummary = {
  year: number;
  month: number;
  label: string;
  totalAmount: number;
  coachPayoutCount: number;
  batches: BatchSummary[];
};

type BatchCoach = {
  payoutId?: string | null;
  coachId?: string;
  coach?: { name?: string; email?: string } | null;
  amount?: number;
  status?: string;
  paidAt?: string | null;
  paymentReference?: string | null;
  paymentProofImage?: string | null;
  periodLabel?: string | null;
  eligibleWeeksCount?: number;
  subscriptionCount?: number;
  livePreview?: boolean;
};

type BatchDetail = {
  scheduledDate?: string;
  transferDay?: number;
  periodLabel?: string | null;
  totalAmount?: number;
  coachCount?: number;
  paidCount?: number;
  pendingCount?: number;
  livePreview?: boolean;
  coaches?: BatchCoach[];
};

type HistoryLineItem = {
  athleteName?: string;
  weekIndex?: number;
  grossAmount?: number;
  platformFee?: number;
  coachNetAmount?: number;
  weeklyRate?: number;
  allocatedAmount?: number;
  isEligible?: boolean;
};

type PayoutDetails = {
  _id: string;
  amount?: number;
  status?: string;
  scheduledDate?: string;
  paidAt?: string | null;
  paymentReference?: string | null;
  paymentProofImage?: string | null;
  lineItems?: HistoryLineItem[];
  coachId?: { firstName?: string; lastName?: string; email?: string } | string;
};

@Component({
  selector: 'app-payout-batches',
  imports: [DatePipe, FormsModule],
  styles: `
    .coach-cell {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .coach-cell .name { font-weight: 600; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin: 0.75rem 0 1rem;
    }
    .toolbar label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .month-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .month-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      overflow: hidden;
    }
    .month-head {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      padding: 0.85rem 1rem;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    .month-head:hover {
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
    .month-head .title {
      flex: 1;
      min-width: 140px;
      font-weight: 700;
      font-size: 1.05rem;
    }
    .month-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .month-body {
      border-top: 1px solid var(--line);
      padding: 0.85rem 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .batch-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: color-mix(in srgb, var(--accent) 4%, var(--panel));
    }
    .batch-head {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem 1rem;
      padding: 0.7rem 0.85rem;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    .batch-head:hover {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .batch-head .title {
      font-weight: 700;
      min-width: 110px;
    }
    .batch-body {
      border-top: 1px solid var(--line);
      padding: 0.75rem;
      background: var(--panel);
    }
    .amount-net {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .status-chip {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: lowercase;
      border: 1px solid var(--line);
    }
    .status-chip[data-status='paid'] {
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
      background: color-mix(in srgb, var(--ok) 12%, transparent);
    }
    .status-chip[data-status='pending'],
    .status-chip[data-status='processing'] {
      color: var(--warning);
      border-color: color-mix(in srgb, var(--warning) 45%, var(--line));
      background: color-mix(in srgb, var(--warning) 12%, transparent);
    }
    .status-chip[data-status='failed'],
    .status-chip[data-status='cancelled'] {
      color: var(--danger);
      border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
      background: color-mix(in srgb, var(--danger) 12%, transparent);
    }
    tr.row-open > td {
      border-bottom-color: transparent;
    }
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
    .expand-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .expand-head h3 {
      margin: 0;
      flex: 1;
      min-width: 140px;
      font-size: 1rem;
    }
    .nested-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    .nested-table th,
    .nested-table td {
      text-align: left;
      padding: 0.45rem 0.5rem;
      border-bottom: 1px solid var(--line);
    }
    .elig-chip {
      display: inline-block;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .elig-chip.ok {
      color: var(--ok);
      background: color-mix(in srgb, var(--ok) 14%, transparent);
    }
    .elig-chip.warn {
      color: var(--warning);
      background: color-mix(in srgb, var(--warning) 14%, transparent);
    }
    .proof-preview {
      max-width: 100%;
      max-height: 140px;
      border-radius: 8px;
      margin-top: 0.35rem;
      object-fit: cover;
    }
    .chev {
      color: var(--muted);
      font-size: 0.85rem;
      min-width: 1rem;
    }
  `,
  template: `
    <h1>Payout batches</h1>
    <p class="muted">
      Monthly coach payouts grouped by transfer day (1st and 16th). Open a coach for week and subscription details.
    </p>

    <div class="toolbar">
      <label>
        Status
        <select [(ngModel)]="statusFilter" (ngModelChange)="onStatusChange()">
          <option value="">All</option>
          <option value="paid">Paid only</option>
        </select>
      </label>
      @if (loadingMonths()) {
        <span class="muted">Loading…</span>
      }
    </div>

    @if (error()) {
      <p class="err">{{ error() }}</p>
    }

    @if (!loadingMonths() && !months().length && !error()) {
      <p class="muted">No payout batches found.</p>
    }

    <div class="month-list">
      @for (m of months(); track monthKey(m)) {
        <div class="month-card">
          <button type="button" class="month-head" (click)="toggleMonth(m)">
            <span class="chev">{{ openMonthKey() === monthKey(m) ? '▾' : '▸' }}</span>
            <span class="title">{{ m.label }}</span>
            <span class="month-meta">
              <span class="amount-net">{{ money(m.totalAmount) }}</span>
              <span>{{ m.coachPayoutCount }} coach payouts</span>
              <span>{{ m.batches.length || 0 }} batches</span>
            </span>
          </button>

          @if (openMonthKey() === monthKey(m)) {
            <div class="month-body">
              @for (batch of m.batches || []; track batch.transferDay) {
                <div class="batch-card">
                  <button type="button" class="batch-head" (click)="toggleBatch(batch)">
                    <span class="chev">{{ openBatchKey() === batchKey(batch) ? '▾' : '▸' }}</span>
                    <span class="title">Payout {{ batch.transferDay === 1 ? '1st' : '16th' }}</span>
                    <span class="muted">{{ batch.scheduledDate | date: 'mediumDate' }}</span>
                    <span class="amount-net">{{ money(batch.totalAmount) }}</span>
                    <span class="muted">{{ batch.coachCount }} coaches</span>
                    <span class="muted">{{ batch.paidCount }} paid · {{ batch.pendingCount }} pending</span>
                  </button>

                  @if (openBatchKey() === batchKey(batch)) {
                    <div class="batch-body">
                      @if (batchLoading() && !batchDetail()) {
                        <p class="muted pad">Loading coaches…</p>
                      }
                      @if (batchError()) {
                        <p class="err">{{ batchError() }}</p>
                      }
                      @if (batchDetail(); as detail) {
                        <p class="muted" style="margin-top:0">
                          @if (detail.periodLabel) {
                            Period {{ detail.periodLabel }} ·
                          }
                          {{ detail.coachCount || 0 }} coaches · {{ money(detail.totalAmount) }}
                          @if (detail.livePreview) {
                            · live preview (same as Upcoming)
                          }
                        </p>
                        <div class="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Coach</th>
                                <th>Amount</th>
                                <th>Weeks</th>
                                <th>Subscriptions</th>
                                <th>Status</th>
                                <th>Paid</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (row of detail.coaches || []; track rowKey(row)) {
                                <tr [class.row-open]="selectedRowKey() === rowKey(row)">
                                  <td>
                                    <div class="coach-cell">
                                      <span class="name">{{ coachLabel(row) }}</span>
                                    </div>
                                    @if (row.coach?.email) {
                                      <div class="muted" style="font-size:0.8rem">{{ row.coach?.email }}</div>
                                    }
                                  </td>
                                  <td class="amount-net">{{ money(row.amount) }}</td>
                                  <td>{{ row.eligibleWeeksCount ?? 0 }}</td>
                                  <td>{{ row.subscriptionCount ?? 0 }}</td>
                                  <td>
                                    <span class="status-chip" [attr.data-status]="row.status || ''">
                                      {{ row.status }}
                                    </span>
                                  </td>
                                  <td>
                                    @if (row.paidAt) {
                                      {{ row.paidAt | date: 'mediumDate' }}
                                    } @else {
                                      <span class="muted">—</span>
                                    }
                                  </td>
                                  <td>
                                    <button
                                      class="btn sm ghost"
                                      type="button"
                                      (click)="toggleCoachDetails(row)"
                                    >
                                      {{ selectedRowKey() === rowKey(row) ? 'Hide' : 'Details' }}
                                    </button>
                                  </td>
                                </tr>
                                @if (selectedRowKey() === rowKey(row)) {
                                  <tr class="expand-row">
                                    <td colspan="7">
                                      <div class="expand-panel">
                                        @if (detailsLoading()) {
                                          <p class="muted">Loading details…</p>
                                        }
                                        @if (detailsError()) {
                                          <p class="err">{{ detailsError() }}</p>
                                        }
                                        @if (payoutDetails(); as hd) {
                                          <div class="expand-head">
                                            <h3>{{ coachLabel(row) }}</h3>
                                            <div class="amount-net">{{ money(hd.amount) }}</div>
                                            <span
                                              class="status-chip"
                                              [attr.data-status]="hd.status || ''"
                                              >{{ hd.status }}</span
                                            >
                                          </div>
                                          <p class="muted">
                                            Scheduled {{ hd.scheduledDate | date: 'mediumDate' }}
                                            @if (hd.paidAt) {
                                              · Paid {{ hd.paidAt | date: 'mediumDate' }}
                                            }
                                          </p>
                                          @if (hd.paymentReference) {
                                            <p class="muted">Reference: {{ hd.paymentReference }}</p>
                                          }
                                          @if (img(hd.paymentProofImage); as src) {
                                            <p>
                                              <a [href]="src" target="_blank" rel="noopener">
                                                <img
                                                  class="proof-preview"
                                                  [src]="src"
                                                  alt="payment proof"
                                                  loading="lazy"
                                                />
                                              </a>
                                            </p>
                                          }
                                          <div class="table-wrap">
                                            <table class="nested-table">
                                              <thead>
                                                <tr>
                                                  <th>Athlete</th>
                                                  <th>Week</th>
                                                  <th>Athlete paid</th>
                                                  <th>Platform fee</th>
                                                  <th>Coach net / month</th>
                                                  <th>Weekly rate</th>
                                                  <th>Allocated</th>
                                                  <th>Eligible</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                @for (item of hd.lineItems || []; track $index) {
                                                  <tr>
                                                    <td>{{ item.athleteName }}</td>
                                                    <td>W{{ item.weekIndex }}</td>
                                                    <td>{{ money(toNum(item.grossAmount)) }}</td>
                                                    <td>{{ money(toNum(item.platformFee)) }}</td>
                                                    <td>{{ money(toNum(item.coachNetAmount)) }}</td>
                                                    <td>{{ money(toNum(item.weeklyRate)) }}</td>
                                                    <td class="amount-net">
                                                      {{ money(toNum(item.allocatedAmount)) }}
                                                    </td>
                                                    <td>
                                                      @if (item.isEligible) {
                                                        <span class="elig-chip ok">yes</span>
                                                      } @else {
                                                        <span class="elig-chip warn">no</span>
                                                      }
                                                    </td>
                                                  </tr>
                                                }
                                              </tbody>
                                            </table>
                                            @if (!(hd.lineItems || []).length) {
                                              <p class="muted pad">No line items on this payout.</p>
                                            }
                                          </div>
                                        }
                                      </div>
                                    </td>
                                  </tr>
                                }
                              }
                            </tbody>
                          </table>
                          @if (!(detail.coaches || []).length) {
                            <p class="muted pad">No coaches in this batch.</p>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
              @if (!(m.batches || []).length) {
                <p class="muted">No batches in this month.</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PayoutBatchesComponent implements OnInit {
  private api = inject(ApiService);
  money = money;

  statusFilter = '';
  months = signal<MonthSummary[]>([]);
  loadingMonths = signal(false);
  error = signal('');

  openMonthKey = signal<string | null>(null);
  openBatchKey = signal<string | null>(null);
  batchDetail = signal<BatchDetail | null>(null);
  batchLoading = signal(false);
  batchError = signal('');

  selectedRowKey = signal<string | null>(null);
  payoutDetails = signal<PayoutDetails | null>(null);
  detailsLoading = signal(false);
  detailsError = signal('');

  ngOnInit() {
    this.loadMonths();
  }

  monthKey(m: MonthSummary) {
    return `${m.year}-${m.month}`;
  }

  batchKey(batch: BatchSummary) {
    return this.normalizeDateKey(batch.scheduledDate);
  }

  rowKey(row: BatchCoach) {
    return String(row.payoutId || row.coachId || '');
  }

  coachLabel(row: BatchCoach) {
    return row.coach?.name?.trim() || row.coach?.email || row.coachId || '—';
  }

  img(path?: string | null) {
    return this.api.mediaUrl(path);
  }

  toNum(value: unknown): number {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value && '$numberDecimal' in value) {
      return (
        parseFloat(String((value as { $numberDecimal: string }).$numberDecimal)) || 0
      );
    }
    return parseFloat(String(value)) || 0;
  }

  onStatusChange() {
    this.openMonthKey.set(null);
    this.clearBatch();
    this.loadMonths();
  }

  toggleMonth(m: MonthSummary) {
    const key = this.monthKey(m);
    if (this.openMonthKey() === key) {
      this.openMonthKey.set(null);
      this.clearBatch();
      return;
    }
    this.openMonthKey.set(key);
    this.clearBatch();
  }

  toggleBatch(batch: BatchSummary) {
    const key = this.batchKey(batch);
    if (this.openBatchKey() === key) {
      this.clearBatch();
      return;
    }
    this.openBatchKey.set(key);
    this.selectedRowKey.set(null);
    this.payoutDetails.set(null);
    this.detailsError.set('');
    this.loadBatch(batch.scheduledDate);
  }

  toggleCoachDetails(row: BatchCoach) {
    const key = this.rowKey(row);
    if (this.selectedRowKey() === key) {
      this.selectedRowKey.set(null);
      this.payoutDetails.set(null);
      this.detailsError.set('');
      return;
    }
    this.selectedRowKey.set(key);
    this.payoutDetails.set(null);
    this.detailsError.set('');
    if (row.livePreview && row.coachId) {
      this.loadLiveCoachDetails(row);
      return;
    }
    if (row.payoutId) {
      this.loadPayoutDetails(row.payoutId);
      return;
    }
    this.detailsError.set('No payout details available yet. Generate drafts first.');
  }

  private clearBatch() {
    this.openBatchKey.set(null);
    this.batchDetail.set(null);
    this.batchError.set('');
    this.selectedRowKey.set(null);
    this.payoutDetails.set(null);
    this.detailsError.set('');
  }

  private normalizeDateKey(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().slice(0, 10);
  }

  private statusQuery() {
    return this.statusFilter ? `?status=${encodeURIComponent(this.statusFilter)}` : '';
  }

  private loadMonths() {
    this.loadingMonths.set(true);
    this.error.set('');
    this.api
      .get<{ data?: { months?: MonthSummary[] } }>(
        `/api/admin/payouts/batches/months${this.statusQuery()}`
      )
      .subscribe({
        next: (r) => {
          this.months.set(r.data?.months || []);
          this.loadingMonths.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load months');
          this.loadingMonths.set(false);
        },
      });
  }

  private loadBatch(scheduledDate: string) {
    this.batchLoading.set(true);
    this.batchError.set('');
    this.batchDetail.set(null);
    const dateKey = this.normalizeDateKey(scheduledDate);
    this.api
      .get<{ data?: BatchDetail }>(
        `/api/admin/payouts/batches/${encodeURIComponent(dateKey)}${this.statusQuery()}`
      )
      .subscribe({
        next: (r) => {
          const detail = r.data || null;
          this.batchDetail.set(detail);
          this.batchLoading.set(false);
          if (detail) this.syncMonthBatchSummary(dateKey, detail);
        },
        error: (err) => {
          this.batchError.set(
            err?.error?.message || err?.message || 'Failed to load batch'
          );
          this.batchLoading.set(false);
        },
      });
  }

  /** After live batch detail loads, update the month/batch header totals. */
  private syncMonthBatchSummary(dateKey: string, detail: BatchDetail) {
    const nextTotal = Number(detail.totalAmount ?? 0);
    const nextCoachCount = Number(detail.coachCount ?? 0);
    const nextPaid = Number(detail.paidCount ?? 0);
    const nextPending = Number(detail.pendingCount ?? 0);

    this.months.update((months) =>
      months.map((month) => {
        const batchIndex = (month.batches || []).findIndex(
          (b) => this.normalizeDateKey(b.scheduledDate) === dateKey
        );
        if (batchIndex < 0) return month;

        const batches = month.batches.map((batch, i) => {
          if (i !== batchIndex) return batch;
          return {
            ...batch,
            totalAmount: nextTotal,
            coachCount: nextCoachCount,
            paidCount: nextPaid,
            pendingCount: nextPending,
          };
        });

        const totalAmount = batches.reduce(
          (sum, batch) => sum + Number(batch.totalAmount || 0),
          0
        );
        const coachPayoutCount = batches.reduce(
          (sum, batch) => sum + Number(batch.coachCount || 0),
          0
        );

        return {
          ...month,
          batches,
          totalAmount: Math.round(totalAmount * 100) / 100,
          coachPayoutCount,
        };
      })
    );
  }

  private loadPayoutDetails(payoutId: string) {
    this.detailsLoading.set(true);
    this.detailsError.set('');
    this.api.get<{ data?: PayoutDetails }>(`/api/admin/payouts/${payoutId}`).subscribe({
      next: (r) => {
        this.payoutDetails.set(r.data || null);
        this.detailsLoading.set(false);
      },
      error: (err) => {
        this.detailsError.set(
          err?.error?.message || err?.message || 'Failed to load payout details'
        );
        this.detailsLoading.set(false);
      },
    });
  }

  private loadLiveCoachDetails(row: BatchCoach) {
    if (!row.coachId) return;
    this.detailsLoading.set(true);
    this.detailsError.set('');
    this.api
      .get<{
        data?: {
          totalAmount?: number;
          items?: Array<{
            athleteName?: string;
            weeks?: Array<{
              weekIndex?: number;
              amount?: number;
              isEligible?: boolean;
            }>;
            grossAmount?: number;
            platformFee?: number;
            coachNetAmount?: number;
            weeklyRate?: number;
          }>;
        };
      }>(`/api/admin/payouts/upcoming/${row.coachId}`)
      .subscribe({
        next: (r) => {
          const items = r.data?.items || [];
          const lineItems: HistoryLineItem[] = [];
          for (const item of items) {
            for (const week of item.weeks || []) {
              lineItems.push({
                athleteName: item.athleteName,
                weekIndex: week.weekIndex,
                grossAmount: item.grossAmount,
                platformFee: item.platformFee,
                coachNetAmount: item.coachNetAmount,
                weeklyRate: item.weeklyRate,
                allocatedAmount: week.amount,
                isEligible: week.isEligible,
              });
            }
          }
          this.payoutDetails.set({
            _id: String(row.payoutId || row.coachId),
            amount: r.data?.totalAmount ?? row.amount,
            status: row.status || 'pending',
            lineItems,
          });
          this.detailsLoading.set(false);
        },
        error: (err) => {
          this.detailsError.set(
            err?.error?.message || err?.message || 'Failed to load live details'
          );
          this.detailsLoading.set(false);
        },
      });
  }
}
