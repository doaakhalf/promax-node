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
    .coach-cell {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .coach-cell .name { font-weight: 600; }
    .panel-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin: 1.25rem 0 0.5rem;
    }
    .panel-head h2 { margin: 0; flex: 1; min-width: 180px; }
    .mark-paid-card {
      margin: 1rem 0;
      padding: 1rem;
      max-width: 480px;
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
      color: #f0b429;
      border-color: #5a4a1a;
      background: #2a2410;
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
    .week-row .ok { color: #3ecf8e; }
    .week-row .warn { color: #f0b429; }
    @media (max-width: 800px) {
      .panel-head h2 { min-width: 0; }
      .mark-paid-card { max-width: none; }
      .pay-chip .pay-value { max-width: 120px; }
      .reason-chip { max-width: 100%; }
    }
  `,
  template: `
    <h1>Payouts</h1>
    <p class="muted">
      Amounts are coach net. <b>Details</b> opens the breakdown.
      <b>Mark paid</b> after you transfer money — attach reference + transfer proof image.
    </p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

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
      <button class="btn ghost" type="button" (click)="load()">Refresh</button>
    </div>
    <label class="toggle-row">
      <input type="checkbox" [checked]="showZeroPayouts()" (change)="toggleShowZero($event)" />
      Show zero payouts
    </label>

    @if (markPaidId()) {
      <div class="card mark-paid-card">
        <h2 style="margin-top:0">Mark payout as paid</h2>
        <p class="muted">Confirm the transfer with a reference number and proof image.</p>
        @if (markPaidPay().instapayLink || markPaidPay().walletNumber) {
          <div class="pay-methods">
            @if (markPaidPay().instapayLink; as link) {
              <span class="pay-chip" [title]="link">
                <span class="pay-label">Instapay</span>
                <span class="pay-value">{{ link }}</span>
                <button class="btn sm ghost" type="button" (click)="copyText(link, 'Instapay')">Copy</button>
              </span>
            }
            @if (markPaidPay().walletNumber; as wallet) {
              <span class="pay-chip" [title]="wallet">
                <span class="pay-label">HM Wallet</span>
                <span class="pay-value">{{ wallet }}</span>
                <button class="btn sm ghost" type="button" (click)="copyText(wallet, 'HM Wallet')">Copy</button>
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
    }

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
            <tr>
              <td>
                <div class="coach-cell">
                  <span class="name">{{ p.coach?.name || p.coachId }}</span>
                  <button class="btn sm" type="button" (click)="openUpcomingDetails(p)">Details</button>
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
              <td>{{ money(p.amount) }}</td>
              <td>
                @if (toNum(p.amount) <= 0 && (p.message || p.primaryReason)) {
                  <span class="reason-chip zero" [title]="p.primaryReason || ''">{{ p.message || p.primaryReason }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
              <td>{{ p.pendingPayoutId ? 'ready' : 'not generated' }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (!(upcoming()?.payouts || []).length && !error()) {
        <p class="muted pad">No upcoming payouts.</p>
      }
    </div>
    @if (upcomingReveal.hasMore()) { <p class="muted list-status">Scroll to show more coaches ({{ upcomingReveal.visible().length }} / {{ upcomingReveal.total() }})</p> }
    @if (!upcomingReveal.hasMore() && upcomingReveal.total() > 0) { <p class="muted list-status">Showing all {{ upcomingReveal.total() }} coaches</p> }
    <app-scroll-sentinel [disabled]="!upcomingReveal.hasMore()" (reached)="upcomingReveal.showMore()" />

    @if (details(); as d) {
      <div class="panel-head">
        <h2>Breakdown · {{ d.coach?.name }}</h2>
        <div class="num sm">{{ money(d.totalAmount) }}</div>
        @if (selectedPendingId()) {
          <button class="btn" type="button" (click)="openMarkPaid(selectedPendingId()!, d)">Mark paid</button>
        } @else if (selectedCoachId()) {
          <button class="btn ghost" type="button" [disabled]="generating()" (click)="generateThenRefreshDetails()">
            {{ generating() ? 'Generating…' : 'Generate draft first' }}
          </button>
        }
        @if (payOf(d).instapayLink || payOf(d).walletNumber) {
          <div class="pay-methods">
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
      </div>
      <p class="muted">Eligible weeks pay weeklyRate = coachNet / 4. Platform fee is not included.</p>
      @if (d.message) {
        <p class="reason-chip zero" style="margin: 0.5rem 0">{{ d.message }}</p>
      }
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
                <td>{{ money(item.allocatedAmount) }}</td>
                <td>
                  @if (item.weeks?.length) {
                    <div class="week-list">
                      @for (w of item.weeks; track $index) {
                        <div class="week-row">
                          <span>W{{ w.weekIndex }} · {{ w.periodLabel || '—' }}</span>
                          <span>{{ money(w.amount) }}</span>
                          @if (w.isEligible) {
                            <span class="ok">eligible</span>
                          } @else {
                            <span class="warn">{{ w.ineligibleReasonLabel || w.ineligibleReason || 'ineligible' }}</span>
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
      </div>
    }

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
            <tr>
              <td>
                <div class="coach-cell">
                  <span class="name">{{ coachName(p) }}</span>
                  <button class="btn sm" type="button" (click)="openHistoryDetails(p)">Details</button>
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
              <td>{{ money(p.amount) }}</td>
              <td>{{ p.status }}</td>
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
          }
        </tbody>
      </table>
      @if (!historyList.items().length && !historyList.loading() && !error()) {
        <p class="muted pad">No payout history.</p>
      }
    </div>
    @if (historyList.error()) { <p class="err">{{ historyList.error() }}</p> }
    @if (historyList.loading()) { <p class="muted list-status">{{ historyList.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (historyList.error() && historyList.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="historyList.loadMore()">Retry</button></div>
    }
    @if (!historyList.hasMore() && historyList.items().length) { <p class="muted list-status">Showing all {{ historyList.total() }} payouts</p> }
    <app-scroll-sentinel [disabled]="historyList.loading() || !historyList.hasMore() || !!historyList.error()" (reached)="historyList.loadMore()" />

    @if (historyDetails(); as hd) {
      <div class="panel-head">
        <h2>History details · {{ coachName(hd) }}</h2>
        <div class="num sm">{{ money(hd.amount) }}</div>
        @if (hd.status !== 'paid' && toNum(hd.amount) > 0) {
          <button class="btn" type="button" (click)="openMarkPaid(hd._id, hd)">Mark paid</button>
        }
        @if (payOf(hd).instapayLink || payOf(hd).walletNumber) {
          <div class="pay-methods">
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
      </div>
      <p class="muted">
        Status: {{ hd.status }} · Scheduled {{ hd.scheduledDate | date:'mediumDate' }}
        @if (hd.paidAt) {
          · Paid {{ hd.paidAt | date:'mediumDate' }}
        }
      </p>
      @if (hd.paymentReference) {
        <p class="muted">Reference: {{ hd.paymentReference }}</p>
      }
      @if (img(hd.paymentProofImage); as src) {
        <p><a [href]="src" target="_blank"><img class="proof-preview" [src]="src" alt="payment proof" loading="lazy" /></a></p>
      }
      <div class="card table-wrap">
        <table>
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
                <td>{{ money(toNum(item.allocatedAmount)) }}</td>
                <td>{{ item.isEligible ? 'yes' : 'no' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (!(hd.lineItems || []).length) {
          <p class="muted pad">No line items on this payout.</p>
        }
      </div>
    }
  `,
})
export class PayoutsComponent implements OnDestroy, OnInit {
  private api = inject(ApiService);
  money = money;
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
  proofPreview = signal<string | null>(null);
  showZeroPayouts = signal(false);
  generating = signal(false);
  proofFile: File | null = null;
  paymentReference = '';
  saving = signal(false);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.load();
  }

  toggleShowZero(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.showZeroPayouts.set(checked);
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

  coachName(p: Payout) {
    const c = p.coachId;
    if (c && typeof c === 'object') return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
    return String(c || '');
  }

  payOf(source?: (PayInfo & { coach?: PayInfo | null; coachId?: PayInfo | string | null }) | null): PayInfo {
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
    if (this.historyList.loadedPage > 0) this.historyList.refresh();
    else this.historyList.reset();
  }

  openUpcomingDetails(row: UpcomingRow) {
    this.historyDetails.set(null);
    this.selectedCoachId.set(String(row.coachId));
    this.selectedPendingId.set(row.pendingPayoutId || null);
    this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${row.coachId}`).subscribe({
      next: (r) => this.details.set(r.data || null),
      error: (e) => this.error.set(e.message),
    });
  }

  openHistoryDetails(p: Payout) {
    this.details.set(null);
    this.selectedCoachId.set(null);
    this.selectedPendingId.set(null);
    this.historyDetails.set(null);
    this.api.get<{ data?: Payout }>(`/api/admin/payouts/${p._id}`).subscribe({
      next: (r) => this.historyDetails.set(r.data || null),
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
        this.load();
        if (coachId) {
          this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${coachId}`).subscribe({
            next: (r) => this.details.set(r.data || null),
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

  openMarkPaid(id: string, paySource?: PayInfo | null) {
    this.releaseProofPreview();
    this.markPaidId.set(id);
    this.markPaidPay.set(this.payOf(paySource));
    this.paymentReference = '';
    this.proofFile = null;
    this.error.set('');
  }

  cancelMarkPaid() {
    this.markPaidId.set(null);
    this.markPaidPay.set({});
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
        this.details.set(null);
        this.historyDetails.set(null);
        this.selectedCoachId.set(null);
        this.selectedPendingId.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.message);
      },
    });
  }
}
