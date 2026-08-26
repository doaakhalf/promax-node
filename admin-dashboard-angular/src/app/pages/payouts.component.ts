import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

type UpcomingRow = {
  coachId: string;
  amount: number;
  coach?: { name?: string };
  pendingPayoutId?: string | null;
  scheduledDate?: string;
};

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
  paymentReference?: string | null;
  paymentProofImage?: string | null;
  coachId?: { firstName?: string; lastName?: string; email?: string } | string;
  lineItems?: HistoryLineItem[];
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
      <button class="btn" type="button" (click)="generate()">Generate drafts</button>
      <button class="btn ghost" type="button" (click)="load()">Refresh</button>
    </div>

    @if (markPaidId()) {
      <div class="card mark-paid-card">
        <h2 style="margin-top:0">Mark payout as paid</h2>
        <p class="muted">Confirm the transfer with a reference number and proof image.</p>
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
                    <button class="btn sm" type="button" (click)="openMarkPaid(p.pendingPayoutId!)">Mark paid</button>
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

    @if (details()) {
      <div class="panel-head">
        <h2>Breakdown · {{ details()?.coach?.name }}</h2>
        <div class="num sm">{{ money(details()?.totalAmount) }}</div>
        @if (selectedPendingId()) {
          <button class="btn" type="button" (click)="openMarkPaid(selectedPendingId()!)">Mark paid</button>
        } @else if (selectedCoachId()) {
          <button class="btn ghost" type="button" (click)="generateThenRefreshDetails()">Generate draft first</button>
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
        <thead>
          <tr>
            <th>Coach</th>
            <th>Coach net</th>
            <th>Status</th>
            <th>Scheduled</th>
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
                  @if (p.status !== 'paid') {
                    <button class="btn sm" type="button" (click)="openMarkPaid(p._id)">Mark paid</button>
                  }
                </div>
              </td>
              <td>{{ money(p.amount) }}</td>
              <td>{{ p.status }}</td>
              <td>{{ p.scheduledDate | date:'mediumDate' }}</td>
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
                    <img class="proof-thumb" [src]="src" alt="proof" />
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

    @if (historyDetails(); as hd) {
      <div class="panel-head">
        <h2>History details · {{ coachName(hd) }}</h2>
        <div class="num sm">{{ money(hd.amount) }}</div>
        @if (hd.status !== 'paid') {
          <button class="btn" type="button" (click)="openMarkPaid(hd._id)">Mark paid</button>
        }
      </div>
      <p class="muted">Status: {{ hd.status }} · Scheduled {{ hd.scheduledDate | date:'mediumDate' }}</p>
      @if (hd.paymentReference) {
        <p class="muted">Reference: {{ hd.paymentReference }}</p>
      }
      @if (img(hd.paymentProofImage); as src) {
        <p><a [href]="src" target="_blank"><img class="proof-preview" [src]="src" alt="payment proof" /></a></p>
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
export class PayoutsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  upcoming = signal<Upcoming | null>(null);
  history = signal<Payout[]>([]);
  details = signal<CoachDetails | null>(null);
  historyDetails = signal<Payout | null>(null);
  selectedCoachId = signal<string | null>(null);
  selectedPendingId = signal<string | null>(null);
  markPaidId = signal<string | null>(null);
  proofPreview = signal<string | null>(null);
  proofFile: File | null = null;
  paymentReference = '';
  saving = signal(false);
  error = signal('');
  msg = signal('');

  ngOnInit() {
    this.load();
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
    this.api.get<{ data?: Payout[] }>('/api/admin/payouts').subscribe({
      next: (r) => this.history.set(r.data || []),
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
    this.historyDetails.set(p);
  }

  generateBody() {
    const scheduledDate = this.upcoming()?.scheduledDate;
    return scheduledDate ? { scheduledDate } : {};
  }

  generate() {
    if (!confirm('Generate payout drafts for the current period?')) return;
    this.api.post('/api/admin/payouts/generate', this.generateBody()).subscribe({
      next: () => {
        this.msg.set('Generated');
        this.load();
      },
      error: (e) => this.error.set(e.message),
    });
  }

  generateThenRefreshDetails() {
    if (!confirm('Generate payout drafts for the current period?')) return;
    const coachId = this.selectedCoachId();
    this.api.post('/api/admin/payouts/generate', this.generateBody()).subscribe({
      next: () => {
        this.msg.set('Draft generated');
        this.load();
        if (coachId) {
          this.api.get<{ data?: CoachDetails }>(`/api/admin/payouts/upcoming/${coachId}`).subscribe({
            next: (r) => this.details.set(r.data || null),
            error: (e) => this.error.set(e.message),
          });
        }
      },
      error: (e) => this.error.set(e.message),
    });
  }

  openMarkPaid(id: string) {
    this.markPaidId.set(id);
    this.paymentReference = '';
    this.proofFile = null;
    this.proofPreview.set(null);
    this.error.set('');
  }

  cancelMarkPaid() {
    this.markPaidId.set(null);
    this.paymentReference = '';
    this.proofFile = null;
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
