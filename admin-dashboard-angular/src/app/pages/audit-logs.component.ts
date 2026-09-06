import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type AuditUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type AuditLog = {
  _id: string;
  action?: string;
  entityType?: string;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  targetRole?: string;
  ipAddress?: string | null;
  timestamp?: string;
  user?: AuditUser;
  targetUser?: AuditUser;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalLogs: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type Stats = {
  overall?: {
    totalLogs?: number;
    updateCount?: number;
    createCount?: number;
    deleteCount?: number;
  };
  byEntityType?: { _id: string; count: number }[];
};

type ValueField = { key: string; label: string; value: string };

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  _id: 'ID',
  name: 'Name',
  certificateName: 'Certificate name',
  year: 'Year',
  rank: 'Rank',
  image: 'Image',
  certificateImage: 'Image',
  fileName: 'File',
  email: 'Email',
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'Phone',
  gender: 'Gender',
  birthDate: 'Birth date',
  weight: 'Weight',
  height: 'Height',
  bio: 'Bio',
  price: 'Price',
  title: 'Title',
  description: 'Description',
};

@Component({
  selector: 'app-audit-logs',
  imports: [DatePipe, FormsModule],
  template: `
    <h1>Audit logs</h1>
    <p class="muted">Profile and related entity changes (kept for 90 days).</p>

    @if (statsError()) { <p class="err">{{ statsError() }}</p> }
    <div class="kpis">
      <div class="card kpi"><div class="label">Total</div><div class="num">{{ stats()?.overall?.totalLogs ?? 0 }}</div></div>
      <div class="card kpi"><div class="label">Updates</div><div class="num">{{ stats()?.overall?.updateCount ?? 0 }}</div></div>
      <div class="card kpi"><div class="label">Creates</div><div class="num">{{ stats()?.overall?.createCount ?? 0 }}</div></div>
      <div class="card kpi"><div class="label">Deletes</div><div class="num">{{ stats()?.overall?.deleteCount ?? 0 }}</div></div>
    </div>

    @if (stats()?.byEntityType?.length) {
      <p class="muted">
        By entity:
        @for (e of stats()!.byEntityType!; track e._id; let last = $last) {
          {{ e._id }} ({{ e.count }}){{ last ? '' : ' · ' }}
        }
      </p>
    }

    <div class="filters card pad">
      <div class="filter-grid">
        <label>
          <span class="muted">Role</span>
          <select [(ngModel)]="targetRole" (ngModelChange)="applyFilters()">
            <option value="">all</option>
            <option value="athlete">athlete</option>
            <option value="coach">coach</option>
          </select>
        </label>
        <label>
          <span class="muted">Entity</span>
          <select [(ngModel)]="entityType" (ngModelChange)="applyFilters()">
            <option value="">all</option>
            <option value="user">user</option>
            <option value="athlete">athlete</option>
            <option value="coach">coach</option>
            <option value="certificate">certificate</option>
            <option value="achievement">achievement</option>
            <option value="gallery">gallery</option>
          </select>
        </label>
        <label>
          <span class="muted">Field</span>
          <input [(ngModel)]="fieldName" placeholder="e.g. firstName" (keyup.enter)="applyFilters()" />
        </label>
        <label>
          <span class="muted">Target user ID</span>
          <input [(ngModel)]="targetUserId" placeholder="Mongo ObjectId" (keyup.enter)="applyFilters()" />
        </label>
        <label>
          <span class="muted">From</span>
          <input type="date" [(ngModel)]="startDate" (ngModelChange)="applyFilters()" />
        </label>
        <label>
          <span class="muted">To</span>
          <input type="date" [(ngModel)]="endDate" (ngModelChange)="applyFilters()" />
        </label>
      </div>
      <div class="actions">
        <button class="btn sm" type="button" (click)="applyFilters()">Apply</button>
        <button class="btn sm ghost" type="button" (click)="clearFilters()">Clear</button>
      </div>
    </div>

    @if (error()) { <p class="err">{{ error() }}</p> }

    <div class="card table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Target</th>
            <th>Entity</th>
            <th>Field</th>
            <th>Old</th>
            <th>New</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          @for (log of logs(); track log._id) {
            <tr>
              <td class="when">{{ log.timestamp | date:'medium' }}</td>
              <td>{{ log.action }}</td>
              <td class="person">
                <div>{{ displayName(log.user) }}</div>
                <div class="muted">{{ log.user?.email || '—' }}</div>
              </td>
              <td class="person">
                <div>{{ displayName(log.targetUser) }}</div>
                <div class="muted">{{ log.targetRole }} · {{ log.targetUser?.email || '—' }}</div>
              </td>
              <td>{{ log.entityType }}</td>
              <td>{{ log.fieldName }}</td>
              <td class="val">@if (asFields(log.oldValue); as fields) {
                <dl class="val-fields">
                  @for (f of fields; track f.key) {
                    <div class="field-row">
                      <dt>{{ f.label }}</dt>
                      <dd>{{ f.value }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <div class="val-text">{{ asText(log.oldValue) }}</div>
              }</td>
              <td class="val">@if (asFields(log.newValue); as fields) {
                <dl class="val-fields">
                  @for (f of fields; track f.key) {
                    <div class="field-row">
                      <dt>{{ f.label }}</dt>
                      <dd>{{ f.value }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <div class="val-text">{{ asText(log.newValue) }}</div>
              }</td>
              <td class="ip">{{ log.ipAddress || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (!logs().length && !error()) {
        <p class="muted pad">No audit logs.</p>
      }
    </div>

    @if (totalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="page <= 1" (click)="changePage(-1)">Previous</button>
        <span class="muted">Page {{ page }} / {{ totalPages() }} ({{ totalLogs() }} logs)</span>
        <button class="btn sm ghost" type="button" [disabled]="page >= totalPages()" (click)="changePage(1)">Next</button>
      </div>
    }
  `,
  styles: `
    .filters { margin: 1rem 0; }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .filter-grid label { display: block; }
    .filter-grid span { display: block; font-size: 0.8rem; margin-bottom: 0.15rem; }
    .filter-grid input, .filter-grid select { margin: 0; }
    .audit-table {
      min-width: 1180px;
      table-layout: fixed;
    }
    .audit-table th, .audit-table td {
      vertical-align: top;
      padding: 0.55rem 0.65rem;
    }
    .when { width: 9.5rem; white-space: nowrap; }
    .person { width: 10.5rem; overflow-wrap: anywhere; }
    .ip { width: 8rem; font-size: 0.8rem; overflow-wrap: anywhere; }
    .val {
      width: 17rem;
      font-size: 0.85rem;
    }
    .val-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.4;
    }
    .val-fields {
      margin: 0;
      display: grid;
      gap: 0.35rem;
    }
    .field-row {
      display: grid;
      grid-template-columns: 6.5rem 1fr;
      gap: 0.4rem;
      align-items: start;
    }
    .field-row dt {
      margin: 0;
      color: var(--muted);
      font-size: 0.75rem;
      line-height: 1.4;
    }
    .field-row dd {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.4;
      font-weight: 500;
    }
  `,
})
export class AuditLogsComponent implements OnInit {
  private api = inject(ApiService);

  logs = signal<AuditLog[]>([]);
  stats = signal<Stats | null>(null);
  error = signal('');
  statsError = signal('');
  page = 1;
  totalPages = signal(1);
  totalLogs = signal(0);

  targetRole = '';
  entityType = '';
  fieldName = '';
  targetUserId = '';
  startDate = '';
  endDate = '';

  ngOnInit() {
    this.loadStats();
    this.loadLogs();
  }

  displayName(u?: AuditUser) {
    if (!u) return '—';
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return name || '—';
  }

  /** Returns field rows for objects; null for primitives / empty. */
  asFields(value: unknown): ValueField[] | null {
    const normalized = this.normalizeRaw(value);
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
      return null;
    }
    if ('$numberDecimal' in normalized) return null;

    const entries = Object.entries(normalized as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (!entries.length) return null;

    return entries.map(([key, v]) => ({
      key,
      label: FIELD_LABELS[key] || this.humanizeKey(key),
      value: this.stringifyLeaf(v),
    }));
  }

  asText(value: unknown): string {
    const normalized = this.normalizeRaw(value);
    if (normalized === null || normalized === undefined) return '—';
    if (Array.isArray(normalized)) {
      if (!normalized.length) return '—';
      return normalized
        .map((item, i) => {
          const fields = this.asFields(item);
          if (fields) {
            return `Item ${i + 1}\n` + fields.map((f) => `${f.label}: ${f.value}`).join('\n');
          }
          return this.stringifyLeaf(item);
        })
        .join('\n\n');
    }
    if (typeof normalized === 'object' && '$numberDecimal' in normalized) {
      return String((normalized as { $numberDecimal: string }).$numberDecimal);
    }
    return this.stringifyLeaf(normalized);
  }

  private normalizeRaw(value: unknown): unknown {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          return this.normalizeRaw(JSON.parse(trimmed));
        } catch {
          return value;
        }
      }
      return value;
    }

    if (typeof value === 'object' && value && '$numberDecimal' in value) {
      return String((value as { $numberDecimal: string }).$numberDecimal);
    }

    return value;
  }

  private stringifyLeaf(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  applyFilters() {
    this.page = 1;
    this.loadStats();
    this.loadLogs();
  }

  clearFilters() {
    this.targetRole = '';
    this.entityType = '';
    this.fieldName = '';
    this.targetUserId = '';
    this.startDate = '';
    this.endDate = '';
    this.applyFilters();
  }

  changePage(delta: number) {
    this.page = Math.max(this.page + delta, 1);
    this.loadLogs();
  }

  private queryParams(includePagination = false): string {
    const params = new URLSearchParams();
    if (includePagination) {
      params.set('page', String(this.page));
      params.set('limit', '30');
    }
    if (this.targetRole) params.set('targetRole', this.targetRole);
    if (this.entityType) params.set('entityType', this.entityType);
    if (this.fieldName.trim()) params.set('fieldName', this.fieldName.trim());
    if (this.targetUserId.trim()) params.set('targetUserId', this.targetUserId.trim());
    if (this.startDate) params.set('startDate', this.startDate);
    if (this.endDate) params.set('endDate', this.endDate);
    return params.toString();
  }

  loadStats() {
    this.statsError.set('');
    const q = this.queryParams(false);
    const path = q ? `/api/admin/audit-logs/stats?${q}` : '/api/admin/audit-logs/stats';
    this.api.get<{ data?: Stats }>(path).subscribe({
      next: (r) => this.stats.set(r.data || null),
      error: (e) => this.statsError.set(e.message),
    });
  }

  loadLogs() {
    this.error.set('');
    this.api
      .get<{ data?: AuditLog[]; pagination?: Pagination }>(
        `/api/admin/audit-logs?${this.queryParams(true)}`
      )
      .subscribe({
        next: (r) => {
          this.logs.set(r.data || []);
          this.totalPages.set(r.pagination?.totalPages || 1);
          this.totalLogs.set(r.pagination?.totalLogs || 0);
        },
        error: (e) => this.error.set(e.message),
      });
  }
}
