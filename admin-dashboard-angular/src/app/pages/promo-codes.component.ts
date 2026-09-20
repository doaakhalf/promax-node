import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';

type PromoRow = {
  id: string;
  code: string;
  source: 'coach' | 'admin';
  discountPercent: number;
  expiresAt?: string;
  usageLimit?: number | null;
  usedCount?: number;
  isActive?: boolean;
};

@Component({
  selector: 'app-promo-codes',
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Promo codes</h1>
    <p class="muted">
      Admin codes discount the platform fee only (max = platform <code>PERCENTAGE</code>).
      Leave code empty to auto-generate <code>ADMIN-&#123;discount&#125;-&#123;suffix&#125;</code>.
      Default expiry is +30 days.
    </p>

    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <form class="card form" (ngSubmit)="create()">
      <label>Code (optional)</label>
      <input name="code" [(ngModel)]="code" placeholder="Leave empty to auto-generate" />
      <label>Discount %</label>
      <input name="discountPercent" type="number" min="1" [(ngModel)]="discountPercent" required />
      <label>Expires at</label>
      <input name="expiresAt" type="date" [(ngModel)]="expiresAt" />
      <label>Usage limit (optional)</label>
      <input name="usageLimit" type="number" min="1" [(ngModel)]="usageLimit" placeholder="Unlimited" />
      <button class="btn" type="submit" [disabled]="saving()">
        {{ saving() ? 'Creating…' : 'Create promo' }}
      </button>
    </form>

    <div class="toolbar">
      <label>Filter source</label>
      <select [(ngModel)]="sourceFilter" (ngModelChange)="load()">
        <option value="">All</option>
        <option value="admin">Admin</option>
        <option value="coach">Coach</option>
      </select>
      <button class="btn ghost" type="button" (click)="load()">Refresh</button>
    </div>

    <div class="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Source</th>
            <th>%</th>
            <th>Expires</th>
            <th>Used</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr>
              <td><code>{{ row.code }}</code></td>
              <td>{{ row.source }}</td>
              <td>{{ row.discountPercent }}</td>
              <td>{{ row.expiresAt | date: 'mediumDate' }}</td>
              <td>
                {{ row.usedCount || 0 }}
                @if (row.usageLimit != null) { / {{ row.usageLimit }} }
              </td>
              <td>{{ row.isActive ? 'yes' : 'no' }}</td>
              <td class="actions">
                @if (row.isActive) {
                  <button class="btn sm warning" type="button" (click)="setActive(row, false)">
                    Deactivate
                  </button>
                } @else {
                  <button class="btn sm" type="button" (click)="setActive(row, true)">
                    Activate
                  </button>
                }
                <button class="btn sm danger" type="button" (click)="remove(row)">Delete</button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="muted">No promo codes yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin: 1rem 0;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
  `,
})
export class PromoCodesComponent implements OnInit {
  private api = inject(ApiService);

  code = '';
  discountPercent: number | null = null;
  expiresAt = '';
  usageLimit: number | null = null;
  sourceFilter = '';

  rows = signal<PromoRow[]>([]);
  error = signal('');
  msg = signal('');
  saving = signal(false);

  ngOnInit() {
    this.expiresAt = this.defaultExpiryDateInput();
    this.load();
  }

  private defaultExpiryDateInput() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  load() {
    this.error.set('');
    const q = this.sourceFilter ? `?source=${this.sourceFilter}` : '';
    this.api.get<{ data?: PromoRow[] }>(`/api/admin/promo-codes${q}`).subscribe({
      next: (r) => this.rows.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
  }

  create() {
    this.error.set('');
    this.msg.set('');
    if (this.discountPercent == null) {
      this.error.set('discountPercent is required');
      return;
    }

    const body: Record<string, unknown> = {
      discountPercent: Number(this.discountPercent),
    };
    if (this.code.trim()) body['code'] = this.code.trim();
    if (this.expiresAt) body['expiresAt'] = new Date(this.expiresAt).toISOString();
    if (this.usageLimit != null && Number(this.usageLimit) > 0) {
      body['usageLimit'] = Number(this.usageLimit);
    }

    this.saving.set(true);
    this.api.post('/api/admin/promo-codes', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.msg.set('Created');
        this.code = '';
        this.discountPercent = null;
        this.usageLimit = null;
        this.expiresAt = this.defaultExpiryDateInput();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.message);
      },
    });
  }

  setActive(row: PromoRow, isActive: boolean) {
    this.error.set('');
    this.api.patch(`/api/admin/promo-codes/${row.id}`, { isActive }).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.message),
    });
  }

  remove(row: PromoRow) {
    this.error.set('');
    this.api.delete(`/api/admin/promo-codes/${row.id}`).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.message),
    });
  }
}
