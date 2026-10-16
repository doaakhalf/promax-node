import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

type PayInfo = {
  instapayLink?: string | null;
  walletNumber?: string | null;
};

type UpcomingRow = {
  coachId: string;
  amount: number;
  coach?: { name?: string } & PayInfo;
  pendingPayoutId?: string | null;
  scheduledDate?: string;
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
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

type CoachDetails = {
  coach?: { name?: string } & PayInfo;
  totalAmount?: number;
  items?: PayoutItem[];
} & PayInfo;

@Component({
  selector: 'app-payouts',
  imports: [DatePipe, FormsModule],
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
    @media (max-width: 800px) {
      .panel-head h2 { min-width: 0; }
      .mark-paid-card { max-width: none; }
      .pay-chip .pay-value { max-width: 120px; }
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
            <th>Draft</th>
          </tr>
        </thead>
        <tbody>
          @for (p of upcoming()?.payouts || []; track p.coachId) {
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
              <td>{{ p.pendingPayoutId ? 'ready' : 'not generated' }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (!(upcoming()?.payouts || []).length && !error()) {
        <p class="muted pad">No upcoming payouts.</p>
      }
    </div>

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
            @for (item of d.items || []; track $index) {
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
          @for (p of history(); track p._id) {
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
      @if (!history().length && !error()) {
        <p class="muted pad">No payout history.</p>
      }
    </div>
    @if (historyTotalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="historyPage === 1" (click)="changeHistoryPage(-1)">Previous</button>
        <span class="muted">Page {{ historyPage }} / {{ historyTotalPages() }}</span>
        <button class="btn sm ghost" type="button" [disabled]="historyPage >= historyTotalPages()" (click)="changeHistoryPage(1)">Next</button>
      </div>
    }

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
  history = signal<Payout[]>([]);
  details = signal<CoachDetails | null>(null);
  historyDetails = signal<Payout | null>(null);
  selectedCoachId = signal<string | null>(null);
  selectedPendingId = signal<string | null>(null);
  markPaidId = signal<string | null>(null);
  markPaidPay = signal<PayInfo>({});
  proofPreview = signal<string | null>(null);
  historyPage = 1;
  historyTotalPages = signal(1);
  generating = signal(false);
  proofFile: File | null = null;
  paymentReference = '';
  saving = signal(false);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.load();
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

  load() {
    this.api.get<{ data?: Upcoming }>('/api/admin/payouts/upcoming').subscribe({
      next: (r) => {
        this.upcoming.set(r.data || null);
        const coachId = this.selectedCoachId();
        if (coachId) {
          const row = (r.data?.payouts || []).find((p) => String(p.coachId) === String(coachId));
          this.selectedPendingId.set(row?.pendingPayoutId || null);
        }
      },
      error: (e) => this.error.set(e.message),
    });
    this.api.get<{ data?: Payout[]; pagination?: Pagination }>(
      `/api/admin/payouts?page=${this.historyPage}&limit=20`
    ).subscribe({
      next: (r) => {
        this.history.set(r.data || []);
        this.historyTotalPages.set(r.pagination?.totalPages || 1);
      },
      error: (e) => this.error.set(e.message),
    });
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

  changeHistoryPage(delta: number) {
    this.historyPage = Math.max(this.historyPage + delta, 1);
    this.load();
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
