import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList, RevealList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';
import { money } from '../core/money';

type PayInfo = {
  instapayLink?: string | null;
  walletNumber?: string | null;
};

type WeekBreakdown = {
  weekIndex?: number;
  periodLabel?: string;
  amount?: number;
  isEligible?: boolean;
  ineligibleReason?: string | null;
  ineligibleReasonLabel?: string | null;
  assignedDaysCount?: number;
  requiredDaysCount?: number;
};

type UpcomingRow = {
  coachId: string;
  amount: number;
  coach?: { name?: string } & PayInfo;
  pendingPayoutId?: string | null;
  scheduledDate?: string;
  primaryReason?: string | null;
  message?: string | null;
  eligibleWeeksCount?: number;
  ineligibleWeeksCount?: number;
  reasonCounts?: Record<string, number>;
} & PayInfo;

type Upcoming = {
  scheduledDate?: string;
  periodLabel?: string;
  totalAmount?: number;
  coachCount?: number;
  daysUntil?: number;
  payouts?: UpcomingRow[];
};

type HistoryLineItem = {
  athleteName?: string;
  allocatedAmount?: number;
  coachNetAmount?: number;
  platformFee?: number;
  weeklyRate?: number;
  weekIndex?: number;
  grossAmount?: number;
  isEligible?: boolean;
  ineligibleReason?: string | null;
};

type Payout = {
  _id: string;
  status?: string;
  amount?: number;
  scheduledDate?: string;
  paidAt?: string | null;
  paymentReference?: string | null;
  paymentProofImage?: string | null;
  coachId?: ({ firstName?: string; lastName?: string; email?: string } & PayInfo) | string;
  lineItems?: HistoryLineItem[];
} & PayInfo;

type PayoutItem = {
  athleteName?: string;
  allocatedAmount?: number;
  coachNetAmount?: number;
  platformFee?: number;
  weeklyRate?: number;
  weeksCount?: number;
  grossAmount?: number;
  weeks?: WeekBreakdown[];
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

type CoachDetails = {
  coach?: { name?: string } & PayInfo;
  totalAmount?: number;
  message?: string | null;
  primaryReason?: string | null;
  eligibleWeeksCount?: number;
  ineligibleWeeksCount?: number;
  items?: PayoutItem[];
} & PayInfo;

@Component({
  selector: 'app-payouts',
  imports: [DatePipe, FormsModule, ScrollSentinelComponent],
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 1rem 0 0.75rem;
    }
    .tab {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--muted);
      border-radius: 8px;
      padding: 0.45rem 0.9rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .tab.active {
      background: color-mix(in srgb, var(--accent) 22%, transparent);
      border-color: var(--accent);
      color: var(--text);
    }
    .coach-cell {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .coach-cell .name { font-weight: 600; }
    .amount-net {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .amount-net.zero { color: var(--muted); font-weight: 500; }
    .draft-chip {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--line);
    }
    .draft-chip.ready {
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
      background: color-mix(in srgb, var(--ok) 12%, transparent);
    }
    .draft-chip.pending {
      color: var(--muted);
      background: #11181f;
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
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.55);
    }
    .dialog {
      width: min(480px, 100%);
      padding: 1.1rem 1.2rem 1.25rem;
      max-height: min(90vh, 720px);
      overflow: auto;
    }
    .dialog h2 { margin: 0 0 0.35rem; }
    .mark-paid-coach {
      margin: 0.15rem 0 0;
      color: var(--ok);
      font-weight: 600;
    }
    .mark-paid-amount {
      margin: 0.75rem 0 0.25rem;
    }
    .mark-paid-amount .label {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .mark-paid-amount .amount-net {
      color: var(--ok);
    }
    .mark-paid-card label {
      display: block;
      color: var(--muted);
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    .proof-preview {
      max-width: 100%;
      max-height: 160px;
      border-radius: 8px;
      margin-top: 0.5rem;
      object-fit: cover;
    }
    .proof-thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      vertical-align: middle;
    }
    .pay-methods {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
      width: 100%;
    }
    .pay-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      max-width: 100%;
      padding: 0.2rem 0.4rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #11181f;
      font-size: 0.75rem;
    }
    .pay-chip .pay-label {
      color: var(--muted);
      white-space: nowrap;
    }
    .pay-chip .pay-value {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .mark-paid-card .pay-methods { margin: 0.75rem 0; }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.75rem 0;
      font-size: 0.9rem;
    }
    .reason-chip {
      display: inline-block;
      max-width: 280px;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: #1a222b;
      color: var(--muted);
      font-size: 0.75rem;
      line-height: 1.3;
    }
    .reason-chip.zero {
      color: var(--warning);
      border-color: color-mix(in srgb, var(--warning) 40%, var(--line));
      background: color-mix(in srgb, var(--warning) 12%, transparent);
    }
    .week-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-top: 0.35rem;
      font-size: 0.78rem;
    }
    .week-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.6rem;
      color: var(--muted);
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
    @media (max-width: 800px) {
      .expand-head h3 { min-width: 0; }
      .pay-chip .pay-value { max-width: 120px; }
      .reason-chip { max-width: 100%; }
    }
  `,
  template: `
    <h1>Payouts</h1>
    <p class="muted">
      Amounts are coach net. Open a coach for the breakdown.
      <b>Mark paid</b> after you transfer — attach reference + proof.
    </p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="tabs" role="tablist">
      <button type="button" class="tab" role="tab" [class.active]="activeTab() === 'upcoming'" (click)="setTab('upcoming')">
        Upcoming
      </button>
      <button type="button" class="tab" role="tab" [class.active]="activeTab() === 'history'" (click)="setTab('history')">
        History
      </button>
    </div>

    @if (markPaidId()) {
      <div class="backdrop" (click)="cancelMarkPaid()">
        <div
          class="card dialog mark-paid-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-paid-title"
          (click)="$event.stopPropagation()"
        >
          <h2 id="mark-paid-title">Mark payout as paid</h2>
          @if (markPaidCoachName()) {
            <p class="mark-paid-coach">{{ markPaidCoachName() }}</p>
          }
          <p class="muted">Confirm the transfer with a reference number and proof image.</p>
          <div class="mark-paid-amount">
            <div class="label">Amount to transfer (coach net)</div>
            <div class="amount-net">{{ money(markPaidAmount()) }}</div>
          </div>
          @if (markPaidPay().instapayLink || markPaidPay().walletNumber) {
            <div class="pay-methods">
              @if (markPaidPay().instapayLink; as link) {
                <span class="pay-chip" [title]="link">
                  <span class="pay-label">Instapay</span>
                  <span class="pay-value">{{ link }}</span>
                  <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
                  <button class="btn sm" type="button" (click)="openInstapayLink(link)">Open</button>
                </span>
              }
              @if (markPaidPay().walletNumber; as wallet) {
                <span class="pay-chip" [title]="wallet">
                  <span class="pay-label">HM Wallet</span>
                  <span class="pay-value">{{ wallet }}</span>
                  <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
                  <button class="btn sm" type="button" (click)="openWalletInInstapay(wallet)">Open</button>
                </span>
              }
            </div>
          }
          <label>Reference number</label>
          <input name="paymentReference" [(ngModel)]="paymentReference" placeholder="Instapay / bank ref" />
          <label>Transfer proof image</label>
          <input type="file" accept="image/*,.pdf" (change)="onProofSelected($event)" />
          @if (proofPreview()) {
            <img class="proof-preview" [src]="proofPreview()!" alt="proof preview" />
          }
          <div class="actions">
            <button class="btn" type="button" [disabled]="saving()" (click)="submitMarkPaid()">
              {{ saving() ? 'Saving…' : 'Confirm paid' }}
            </button>
            <button class="btn ghost" type="button" (click)="cancelMarkPaid()">Cancel</button>
          </div>
        </div>
      </div>
    }

    @if (activeTab() === 'upcoming') {
      <div class="kpis">
        <div class="card kpi"><div class="label">Period</div><div class="num sm">{{ upcoming()?.periodLabel || '—' }}</div></div>
        <div class="card kpi"><div class="label">Coach net total</div><div class="num sm">{{ money(upcoming()?.totalAmount) }}</div></div>
        <div class="card kpi"><div class="label">Coaches</div><div class="num">{{ upcoming()?.coachCount ?? 0 }}</div></div>
        <div class="card kpi"><div class="label">Transfer day</div><div class="num sm">{{ upcoming()?.scheduledDate | date:'mediumDate' }}</div></div>
      </div>

      <div class="actions">
        <button class="btn" type="button" [disabled]="generating()" (click)="generate()">
          {{ generating() ? 'Generating…' : 'Generate drafts' }}
        </button>
        <button class="btn ghost" type="button" (click)="loadUpcoming()">Refresh</button>
      </div>
      <label class="toggle-row">
        <input type="checkbox" [checked]="showZeroPayouts()" (change)="toggleShowZero($event)" />
        Show zero payouts
      </label>

      <h2>Upcoming (coach net)</h2>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Payout (net)</th>
              <th>Why zero</th>
              <th>Draft</th>
            </tr>
          </thead>
          <tbody>
            @for (p of upcomingVisible(); track p.coachId) {
              <tr [class.row-open]="isSelectedCoach(p.coachId)">
                <td>
                  <div class="coach-cell">
                    <span class="name">{{ p.coach?.name || p.coachId }}</span>
                    <button class="btn sm" type="button" (click)="toggleUpcomingDetails(p)">
                      {{ isSelectedCoach(p.coachId) ? 'Close' : 'Details' }}
                    </button>
                    @if (p.pendingPayoutId) {
                      <button class="btn sm" type="button" (click)="openMarkPaid(p.pendingPayoutId!, p)">Mark paid</button>
                    }
                    @if (payOf(p).instapayLink || payOf(p).walletNumber) {
                      <div class="pay-methods">
                        @if (payOf(p).instapayLink; as link) {
                          <span class="pay-chip" [title]="link">
                            <span class="pay-label">Instapay</span>
                            <span class="pay-value">{{ link }}</span>
                            <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
                          </span>
                        }
                        @if (payOf(p).walletNumber; as wallet) {
                          <span class="pay-chip" [title]="wallet">
                            <span class="pay-label">HM Wallet</span>
                            <span class="pay-value">{{ wallet }}</span>
                            <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
                          </span>
                        }
                      </div>
                    }
                  </div>
                </td>
                <td>
                  <span class="amount-net" [class.zero]="toNum(p.amount) <= 0">{{ money(p.amount) }}</span>
                </td>
                <td>
                  @if (toNum(p.amount) <= 0 && (p.message || p.primaryReason)) {
                    <span class="reason-chip zero" [title]="p.primaryReason || ''">{{ p.message || p.primaryReason }}</span>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td>
                  @if (p.pendingPayoutId) {
                    <span class="draft-chip ready">ready</span>
                  } @else {
                    <span class="draft-chip pending">not generated</span>
                  }
                </td>
              </tr>
              @if (isSelectedCoach(p.coachId)) {
                <tr class="expand-row">
                  <td colspan="4">
                    <div class="expand-panel">
                      @if (details(); as d) {
                        <div class="expand-head">
                          <h3>Breakdown · {{ d.coach?.name || p.coach?.name }}</h3>
                          <div class="amount-net">{{ money(d.totalAmount) }}</div>
                          @if (selectedPendingId()) {
                            <button class="btn sm" type="button" (click)="openMarkPaid(selectedPendingId()!, d)">Mark paid</button>
                          } @else {
                            <button class="btn sm ghost" type="button" [disabled]="generating()" (click)="generateThenRefreshDetails()">
                              {{ generating() ? 'Generating…' : 'Generate draft first' }}
                            </button>
                          }
                        </div>
                        <p class="muted">Eligible weeks pay weeklyRate = coachNet / 4. Platform fee is not included.</p>
                        @if (d.message) {
                          <p class="reason-chip zero" style="margin: 0.5rem 0">{{ d.message }}</p>
                        }
                        @if (payOf(d).instapayLink || payOf(d).walletNumber) {
                          <div class="pay-methods" style="margin-bottom: 0.5rem">
                            @if (payOf(d).instapayLink; as link) {
                              <span class="pay-chip" [title]="link">
                                <span class="pay-label">Instapay</span>
                                <span class="pay-value">{{ link }}</span>
                                <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
                              </span>
                            }
                            @if (payOf(d).walletNumber; as wallet) {
                              <span class="pay-chip" [title]="wallet">
                                <span class="pay-label">HM Wallet</span>
                                <span class="pay-value">{{ wallet }}</span>
                                <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
                              </span>
                            }
                          </div>
                        }
                        <div class="table-wrap">
                          <table class="nested-table">
                            <thead>
                              <tr>
                                <th>Athlete</th>
                                <th>Athlete paid</th>
                                <th>Platform fee</th>
                                <th>Coach net / month</th>
                                <th>Weekly rate</th>
                                <th>Eligible weeks</th>
                                <th>This payout</th>
                                <th>Weeks</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (item of d.items || []; track $index) {
                                <tr>
                                  <td>{{ item.athleteName }}</td>
                                  <td>{{ money(item.grossAmount) }}</td>
                                  <td>{{ money(item.platformFee) }}</td>
                                  <td>{{ money(item.coachNetAmount) }}</td>
                                  <td>{{ money(item.weeklyRate) }}</td>
                                  <td>{{ item.weeksCount ?? 0 }}</td>
                                  <td class="amount-net">{{ money(item.allocatedAmount) }}</td>
                                  <td>
                                    @if (item.weeks?.length) {
                                      <div class="week-list">
                                        @for (w of item.weeks; track $index) {
                                          <div class="week-row">
                                            <span>W{{ w.weekIndex }} · {{ w.periodLabel || '—' }}</span>
                                            <span>{{ money(w.amount) }}</span>
                                            @if (w.isEligible) {
                                              <span class="elig-chip ok">eligible</span>
                                            } @else {
                                              <span class="elig-chip warn">{{ w.ineligibleReasonLabel || w.ineligibleReason || 'ineligible' }}</span>
                                              @if (w.requiredDaysCount) {
                                                <span>{{ w.assignedDaysCount ?? 0 }}/{{ w.requiredDaysCount }} days</span>
                                              }
                                            }
                                          </div>
                                        }
                                      </div>
                                    } @else {
                                      <span class="muted">—</span>
                                    }
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                          @if (!(d.items || []).length) {
                            <p class="muted pad">No breakdown items.</p>
                          }
                        </div>
                      } @else {
                        <p class="muted">Loading breakdown…</p>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
        @if (!(upcoming()?.payouts || []).length && !error()) {
          <p class="muted pad">No upcoming payouts.</p>
        }
      </div>
      @if (upcomingReveal.hasMore()) {
        <p class="muted list-status">Scroll to show more coaches ({{ upcomingReveal.visible().length }} / {{ upcomingReveal.total() }})</p>
      }
      @if (!upcomingReveal.hasMore() && upcomingReveal.total() > 0) {
        <p class="muted list-status">Showing all {{ upcomingReveal.total() }} coaches</p>
      }
      <app-scroll-sentinel [disabled]="!upcomingReveal.hasMore()" (reached)="upcomingReveal.showMore()" />
    }

    @if (activeTab() === 'history') {
      <h2>History</h2>
      <div class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Coach net</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Paid at</th>
              <th>Reference</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            @for (p of historyList.items(); track p._id) {
              <tr [class.row-open]="historyDetails()?._id === p._id">
                <td>
                  <div class="coach-cell">
                    <span class="name">{{ coachName(p) }}</span>
                    <button class="btn sm" type="button" (click)="toggleHistoryDetails(p)">
                      {{ historyDetails()?._id === p._id ? 'Close' : 'Details' }}
                    </button>
                    @if (p.status !== 'paid' && toNum(p.amount) > 0) {
                      <button class="btn sm" type="button" (click)="openMarkPaid(p._id, p)">Mark paid</button>
                    }
                    @if (payOf(p).instapayLink || payOf(p).walletNumber) {
                      <div class="pay-methods">
                        @if (payOf(p).instapayLink; as link) {
                          <span class="pay-chip" [title]="link">
                            <span class="pay-label">Instapay</span>
                            <span class="pay-value">{{ link }}</span>
                            <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
                          </span>
                        }
                        @if (payOf(p).walletNumber; as wallet) {
                          <span class="pay-chip" [title]="wallet">
                            <span class="pay-label">HM Wallet</span>
                            <span class="pay-value">{{ wallet }}</span>
                            <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
                          </span>
                        }
                      </div>
                    }
                  </div>
                </td>
                <td>
                  <span class="amount-net" [class.zero]="toNum(p.amount) <= 0">{{ money(p.amount) }}</span>
                </td>
                <td>
                  <span class="status-chip" [attr.data-status]="p.status || ''">{{ p.status || '—' }}</span>
                </td>
                <td>{{ p.scheduledDate | date:'mediumDate' }}</td>
                <td>
                  @if (p.paidAt) {
                    {{ p.paidAt | date:'mediumDate' }}
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td>
                  @if (p.status === 'paid' && p.paymentReference) {
                    {{ p.paymentReference }}
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td>
                  @if (p.status === 'paid' && img(p.paymentProofImage); as src) {
                    <a [href]="src" target="_blank">
                      <img class="proof-thumb" [src]="src" alt="proof" loading="lazy" />
                    </a>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </tr>
              @if (historyDetails()?._id === p._id) {
                <tr class="expand-row">
                  <td colspan="7">
                    <div class="expand-panel">
                      @if (historyDetails(); as hd) {
                        <div class="expand-head">
                          <h3>Details · {{ coachName(hd) }}</h3>
                          <div class="amount-net">{{ money(hd.amount) }}</div>
                          <span class="status-chip" [attr.data-status]="hd.status || ''">{{ hd.status }}</span>
                          @if (hd.status !== 'paid' && toNum(hd.amount) > 0) {
                            <button class="btn sm" type="button" (click)="openMarkPaid(hd._id, hd)">Mark paid</button>
                          }
                        </div>
                        <p class="muted">
                          Scheduled {{ hd.scheduledDate | date:'mediumDate' }}
                          @if (hd.paidAt) {
                            · Paid {{ hd.paidAt | date:'mediumDate' }}
                          }
                        </p>
                        @if (hd.paymentReference) {
                          <p class="muted">Reference: {{ hd.paymentReference }}</p>
                        }
                        @if (img(hd.paymentProofImage); as src) {
                          <p>
                            <a [href]="src" target="_blank">
                              <img class="proof-preview" [src]="src" alt="payment proof" loading="lazy" />
                            </a>
                          </p>
                        }
                        @if (payOf(hd).instapayLink || payOf(hd).walletNumber) {
                          <div class="pay-methods" style="margin-bottom: 0.5rem">
                            @if (payOf(hd).instapayLink; as link) {
                              <span class="pay-chip" [title]="link">
                                <span class="pay-label">Instapay</span>
                                <span class="pay-value">{{ link }}</span>
                                <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
                              </span>
                            }
                            @if (payOf(hd).walletNumber; as wallet) {
                              <span class="pay-chip" [title]="wallet">
                                <span class="pay-label">HM Wallet</span>
                                <span class="pay-value">{{ wallet }}</span>
                                <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
                              </span>
                            }
                          </div>
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
                                  <td class="amount-net">{{ money(toNum(item.allocatedAmount)) }}</td>
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
        @if (!historyList.items().length && !historyList.loading() && !error()) {
          <p class="muted pad">No payout history.</p>
        }
      </div>
      @if (historyList.error()) { <p class="err">{{ historyList.error() }}</p> }
      @if (historyList.loading()) {
        <p class="muted list-status">{{ historyList.items().length ? 'Loading more…' : 'Loading…' }}</p>
      }
      @if (historyList.error() && historyList.items().length) {
        <div class="list-status"><button class="btn sm ghost" type="button" (click)="historyList.loadMore()">Retry</button></div>
      }
      @if (!historyList.hasMore() && historyList.items().length) {
        <p class="muted list-status">Showing all {{ historyList.total() }} payouts</p>
      }
      <app-scroll-sentinel
        [disabled]="historyList.loading() || !historyList.hasMore() || !!historyList.error()"
        (reached)="historyList.loadMore()"
      />
    }

  `,
})
export class PayoutsComponent implements OnDestroy, OnInit {
  private api = inject(ApiService);
  money = money;
  activeTab = signal<'upcoming' | 'history'>('upcoming');
  historyLoaded = false;
  upcoming = signal<Upcoming | null>(null);
  readonly upcomingReveal = new RevealList<UpcomingRow>(20);
  readonly upcomingVisible = this.upcomingReveal.visible;
  readonly historyList = new PagedList<Payout>(
    (page) =>
      this.api
        .get<{ data?: Payout[]; pagination?: Pagination }>(
          `/api/admin/payouts?page=${page}&limit=20`
        )
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.total || r.data?.length || 0,
          }))
        ),
    (p) => p._id
  );
  details = signal<CoachDetails | null>(null);
  historyDetails = signal<Payout | null>(null);
  selectedCoachId = signal<string | null>(null);
  selectedPendingId = signal<string | null>(null);
  markPaidId = signal<string | null>(null);
  markPaidPay = signal<PayInfo>({});
  markPaidAmount = signal(0);
  markPaidCoachName = signal('');
  proofPreview = signal<string | null>(null);
  showZeroPayouts = signal(false);
  generating = signal(false);
  proofFile: File | null = null;
  paymentReference = '';
  saving = signal(false);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.loadUpcoming();
  }

  setTab(tab: 'upcoming' | 'history') {
    if (this.activeTab() === tab) return;
    this.clearExpandPanels();
    this.cancelMarkPaid();
    this.activeTab.set(tab);
    if (tab === 'history' && !this.historyLoaded) {
      this.historyLoaded = true;
      this.historyList.reset();
    }
  }

  clearExpandPanels() {
    this.details.set(null);
    this.historyDetails.set(null);
    this.selectedCoachId.set(null);
    this.selectedPendingId.set(null);
  }

  toggleShowZero(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.showZeroPayouts.set(checked);
    this.clearExpandPanels();
    this.loadUpcoming();
  }

  ngOnDestroy() {
    this.releaseProofPreview();
  }

  img(path?: string | null) {
    return this.api.mediaUrl(path);
  }

  toNum(value: unknown): number {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value && '$numberDecimal' in value) {
      return parseFloat(String((value as { $numberDecimal: string }).$numberDecimal)) || 0;
    }
    return parseFloat(String(value)) || 0;
  }

  isSelectedCoach(coachId: string | number) {
    return this.selectedCoachId() === String(coachId);
  }

  coachName(p: Payout) {
    const c = p.coachId;
    if (c && typeof c === 'object') return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || '';
    return String(c || '');
  }

  private resolveMarkPaidCoachName(
    source?: {
      coach?: { name?: string; firstName?: string; lastName?: string; email?: string } | null;
      coachId?: ({ firstName?: string; lastName?: string; email?: string } & PayInfo) | string | null;
    } | null
  ): string {
    if (!source) return '';
    const coach = source.coach && typeof source.coach === 'object' ? source.coach : null;
    if (coach?.name?.trim()) return coach.name.trim();
    if (coach) {
      const fromCoach = `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || coach.email || '';
      if (fromCoach) return fromCoach;
    }
    const coachId = source.coachId;
    if (coachId && typeof coachId === 'object') {
      return `${coachId.firstName || ''} ${coachId.lastName || ''}`.trim() || coachId.email || '';
    }
    return '';
  }

  payOf(
    source?: (PayInfo & {
      coach?: (PayInfo & { name?: string; firstName?: string; lastName?: string; email?: string }) | null;
      coachId?: (PayInfo & { firstName?: string; lastName?: string; email?: string }) | string | null;
    }) | null
  ): PayInfo {
    if (!source) return {};
    const nestedCoach = source.coach && typeof source.coach === 'object' ? source.coach : null;
    const nestedCoachId =
      source.coachId && typeof source.coachId === 'object' ? source.coachId : null;
    const nested = nestedCoach || nestedCoachId;
    return {
      instapayLink: source.instapayLink || nested?.instapayLink || null,
      walletNumber: source.walletNumber || nested?.walletNumber || null,
    };
  }

  async copyText(value: string, label: string) {
    const text = (value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.msg.set(`${label} copied`);
      this.error.set('');
    } catch {
      this.error.set(`Could not copy ${label}`);
    }
  }

  openInstapayLink(link: string) {
    const url = (link || '').trim();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async openWalletInInstapay(wallet: string) {
    const number = (wallet || '').trim();
    if (!number) return;
   
    const clipboard = number;
    try {
      await navigator.clipboard.writeText(clipboard);
      this.msg.set('Wallet + amount copied — paste in Instapay');
      this.error.set('');
    } catch {
      this.error.set('Could not copy wallet details');
      return;
    }
    this.launchInstapayApp();
  }

  private launchInstapayApp() {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    // Chrome only launches apps via BROWSABLE https intents — MAIN/LAUNCHER is ignored.
    // ipn.eg is Instapay's App Link domain (same host as IPA payment links).
    // No store fallback URL — never send the user to Play/App Store.
    if (isAndroid) {
      window.location.href =
        'intent://ipn.eg/#Intent;scheme=https;package=com.egyptianbanks.instapay;end';
      return;
    }
    window.location.href = 'https://ipn.eg';
  }

  loadUpcoming() {
    const qs = this.showZeroPayouts() ? '?includeZero=true' : '';
    this.api.get<{ data?: Upcoming }>(`/api/admin/payouts/upcoming${qs}`).subscribe({
      next: (r) => {
        this.upcoming.set(r.data || null);
        this.upcomingReveal.set(r.data?.payouts || []);
        const coachId = this.selectedCoachId();
        if (coachId) {
          const row = (r.data?.payouts || []).find((p) => String(p.coachId) === String(coachId));
          this.selectedPendingId.set(row?.pendingPayoutId || null);
        }
      },
      error: (e) => this.error.set(e.message),
    });
  }

  load() {
    this.loadUpcoming();
    if (this.historyLoaded) {
      if (this.historyList.loadedPage > 0) this.historyList.refresh();
      else this.historyList.reset();
    }
  }

  toggleUpcomingDetails(row: UpcomingRow) {
    const id = String(row.coachId);
    if (this.selectedCoachId() === id) {
      this.clearExpandPanels();
      return;
    }
    this.historyDetails.set(null);
    this.selectedCoachId.set(id);
    this.selectedPendingId.set(row.pendingPayoutId || null);
    this.details.set(null);
    this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${row.coachId}`).subscribe({
      next: (r) => {
        if (this.selectedCoachId() === id) this.details.set(r.data || null);
      },
      error: (e) => this.error.set(e.message),
    });
  }

  toggleHistoryDetails(p: Payout) {
    if (this.historyDetails()?._id === p._id) {
      this.historyDetails.set(null);
      return;
    }
    this.details.set(null);
    this.selectedCoachId.set(null);
    this.selectedPendingId.set(null);
    this.historyDetails.set({ ...p, lineItems: undefined });
    this.api.get<{ data?: Payout }>(`/api/admin/payouts/${p._id}`).subscribe({
      next: (r) => {
        if (r.data?._id === p._id || this.historyDetails()?._id === p._id) {
          this.historyDetails.set(r.data || null);
        }
      },
      error: (e) => this.error.set(e.message),
    });
  }

  generateBody() {
    const scheduledDate = this.upcoming()?.scheduledDate;
    return scheduledDate ? { scheduledDate } : {};
  }

  generate() {
    if (!confirm('Generate payout drafts for the current period?')) return;
    this.generating.set(true);
    this.api.post('/api/admin/payouts/generate', this.generateBody()).subscribe({
      next: () => {
        this.generating.set(false);
        this.msg.set('Generated');
        this.load();
      },
      error: (e) => {
        this.generating.set(false);
        this.error.set(e.message);
      },
    });
  }

  generateThenRefreshDetails() {
    if (!confirm('Generate payout drafts for the current period?')) return;
    const coachId = this.selectedCoachId();
    this.generating.set(true);
    this.api.post('/api/admin/payouts/generate', this.generateBody()).subscribe({
      next: () => {
        this.generating.set(false);
        this.msg.set('Draft generated');
        this.loadUpcoming();
        if (coachId) {
          this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${coachId}`).subscribe({
            next: (r) => {
              if (this.selectedCoachId() === coachId) this.details.set(r.data || null);
            },
            error: (e) => this.error.set(e.message),
          });
        }
      },
      error: (e) => {
        this.generating.set(false);
        this.error.set(e.message);
      },
    });
  }

  openMarkPaid(
    id: string,
    paySource?: (PayInfo & {
      amount?: number;
      totalAmount?: number;
      coach?: { name?: string; firstName?: string; lastName?: string; email?: string } | null;
      coachId?: ({ firstName?: string; lastName?: string; email?: string } & PayInfo) | string | null;
    }) | null
  ) {
    this.releaseProofPreview();
    this.markPaidId.set(id);
    this.markPaidPay.set(this.payOf(paySource));
    this.markPaidAmount.set(this.toNum(paySource?.amount ?? paySource?.totalAmount));
    this.markPaidCoachName.set(this.resolveMarkPaidCoachName(paySource));
    this.paymentReference = '';
    this.proofFile = null;
    this.error.set('');
  }

  cancelMarkPaid() {
    this.markPaidId.set(null);
    this.markPaidPay.set({});
    this.markPaidAmount.set(0);
    this.markPaidCoachName.set('');
    this.paymentReference = '';
    this.proofFile = null;
    this.releaseProofPreview();
  }

  private releaseProofPreview() {
    const preview = this.proofPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.proofPreview.set(null);
  }

  onProofSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.proofFile = file;
    if (this.proofPreview()) URL.revokeObjectURL(this.proofPreview()!);
    this.proofPreview.set(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  submitMarkPaid() {
    const id = this.markPaidId();
    if (!id) return;
    if (!this.paymentReference.trim() && !this.proofFile) {
      this.error.set('Add a reference number and/or a proof image');
      return;
    }
    if (!confirm('Confirm you already transferred this amount to the coach?')) return;

    const form = new FormData();
    if (this.paymentReference.trim()) form.append('paymentReference', this.paymentReference.trim());
    if (this.proofFile) form.append('paymentProofImage', this.proofFile);

    this.saving.set(true);
    this.api.patchFormData(`/api/admin/payouts/${id}/mark-paid`, form).subscribe({
      next: () => {
        this.saving.set(false);
        this.msg.set('Marked paid');
        this.cancelMarkPaid();
        this.clearExpandPanels();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.message);
      },
    });
  }
}
