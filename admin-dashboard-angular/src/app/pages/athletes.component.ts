import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type Athlete = {
  id?: string;
  athleteName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  status?: string;
  profileImage?: string | null;
  dateOfBirth?: string | null;
  weight?: number | null;
  height?: number | null;
  trainingFrequency?: string | null;
  goals?: string | null;
  injuries?: string | null;
  inbodyFile?: string | null;
  lastSeenAt?: string | null;
  isLoggedIn?: boolean;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalAthletes?: number;
};

@Component({
  selector: 'app-athletes',
  imports: [FormsModule, ScrollSentinelComponent],
  template: `
    <h1>Athletes</h1>
    <div class="row">
      <select [(ngModel)]="status" (ngModelChange)="onStatusChange()">
        <option value="">all</option>
        <option value="active">active</option>
        <option value="inactive">inactive</option>
      </select>
    </div>
    @if (list.error()) { <p class="err">{{ list.error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Gender</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (a of list.items(); track a.id) {
            <tr>
              <td>
                <button class="name-btn" type="button" (click)="open(a)">
                  @if (img(a.profileImage); as src) {
                    <img class="avatar" [src]="src" alt="" />
                  }
                  <span>{{ text(a.athleteName) }}</span>
                </button>
              </td>
              <td>{{ text(a.email) }}</td>
              <td>{{ text(a.phone) }}</td>
              <td>{{ text(a.gender) }}</td>
              <td>{{ text(a.status) }}</td>
              <td class="actions">
                <button class="btn sm ghost" type="button" (click)="open(a)">Details</button>
                @if (a.status === 'active') {
                  <button
                    class="btn sm warning"
                    type="button"
                    [disabled]="busyId() === a.id"
                    (click)="changeStatus(a, 'inactive')"
                  >
                    Deactivate
                  </button>
                }
                @if (a.status === 'inactive') {
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="busyId() === a.id"
                    (click)="changeStatus(a, 'active')"
                  >
                    Activate
                  </button>
                }
                <button
                  class="btn sm danger"
                  type="button"
                  [disabled]="busyId() === a.id"
                  (click)="remove(a)"
                >
                  Delete
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!list.items().length && !list.loading() && !list.error()) { <p class="muted pad">No athletes.</p> }
    </div>
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} athletes</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
    @if (selected(); as a) {
      <div class="backdrop" (click)="close()">
        <div
          class="card dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="athlete-dialog-title"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-head">
            <div class="profile">
              @if (img(a.profileImage); as src) {
                <img class="avatar lg" [src]="src" alt="" />
              }
              <div>
                <h2 id="athlete-dialog-title">{{ text(a.athleteName) }}</h2>
                <div class="muted">{{ text(a.email) }} · {{ text(a.phone) }}</div>
              </div>
            </div>
            <button class="btn sm ghost" type="button" (click)="close()">Close</button>
          </div>
          <dl class="details">
            <div>
              <dt>Gender</dt>
              <dd>{{ text(a.gender) }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ text(a.status) }}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{{ text(a.dateOfBirth) }}</dd>
            </div>
            <div>
              <dt>Training</dt>
              <dd>{{ training(a.trainingFrequency) }}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{{ measure(a.weight, 'kg') }}</dd>
            </div>
            <div>
              <dt>Height</dt>
              <dd>{{ measure(a.height, 'cm') }}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>{{ formatLastSeen(a.lastSeenAt) }}</dd>
            </div>
            <div>
              <dt>Logged in</dt>
              <dd>{{ a.isLoggedIn ? 'Yes' : 'No' }}</dd>
            </div>
            <div class="wide">
              <dt>Goals</dt>
              <dd>{{ text(a.goals) }}</dd>
            </div>
            <div class="wide">
              <dt>Injuries</dt>
              <dd>{{ text(a.injuries) }}</dd>
            </div>
            <div class="wide">
              <dt>InBody</dt>
              <dd>
                @if (img(a.inbodyFile); as src) {
                  <a class="file" [href]="src" target="_blank" rel="noopener">View file</a>
                } @else {
                  —
                }
              </dd>
            </div>
          </dl>
        </div>
      </div>
    }
  `,
  styles: `
    .name-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: none;
      border: 0;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0;
      text-align: left;
      white-space: nowrap;
    }
    .name-btn:hover span { text-decoration: underline; }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: #11181f;
    }
    .avatar.lg { width: 64px; height: 64px; }
    .file { color: var(--accent); text-decoration: underline; }
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
      width: min(560px, 100%);
      max-height: min(85vh, 720px);
      overflow: auto;
      padding: 1.1rem 1.2rem 1.25rem;
    }
    .dialog-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .dialog h2 { margin: 0 0 0.2rem; }
    .profile { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem 1rem;
      margin: 1rem 0 0;
    }
    .details .wide { grid-column: 1 / -1; }
    .details dt { color: var(--muted); font-size: 0.75rem; }
    .details dd { margin: 0.15rem 0 0; white-space: pre-wrap; }
    @media (max-width: 560px) {
      .details { grid-template-columns: 1fr; }
    }
  `,
})
export class AthletesComponent implements OnInit {
  private api = inject(ApiService);
  msg = signal('');
  busyId = signal<string | undefined>(undefined);
  selected = signal<Athlete | null>(null);
  status = '';

  readonly list = new PagedList<Athlete>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.status) params.set('status', this.status);
      return this.api
        .get<{ data?: Athlete[]; pagination?: Pagination }>(`/api/athlete/all?${params}`)
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.totalAthletes || r.data?.length || 0,
          }))
        );
    },
    (a) => a.id
  );

  ngOnInit() {
    this.list.reset();
  }

  /** Reload loaded pages and re-sync the open details dialog. */
  private refresh() {
    this.list.refresh(() => {
      const openId = this.selected()?.id;
      if (openId) {
        this.selected.set(this.list.items().find((item) => item.id === openId) || null);
      }
    });
  }

  open(a: Athlete) {
    this.selected.set(a);
  }

  close() {
    this.selected.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }

  img(path?: string | null) {
    return this.api.mediaUrl(path);
  }

  text(value?: string | null) {
    const trimmed = (value || '').trim();
    return trimmed || '—';
  }

  measure(value?: number | null, unit?: string) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return unit ? `${value} ${unit}` : String(value);
  }

  training(value?: string | null) {
    const days = (value || '').trim();
    if (!days) return '—';
    return days === '1' ? '1 day / week' : `${days} days / week`;
  }

  formatLastSeen(value?: string | null): string {
    if (!value) return 'Never';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Never';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onStatusChange() {
    this.list.reset();
  }

  changeStatus(a: Athlete, status: 'active' | 'inactive') {
    if (!a.id) return;
    const label = a.athleteName || a.email || 'this athlete';
    const action = status === 'inactive' ? 'deactivate' : 'activate';
    if (!confirm(`${action} ${label}?`)) return;

    this.msg.set('');
    this.list.error.set('');
    this.busyId.set(a.id);

    this.api
      .put<{ status?: string; message?: string }>(
        `/api/athlete/${a.id}/change-status?status=${status}`,
        {}
      )
      .subscribe({
        next: () => {
          this.busyId.set(undefined);
          this.msg.set(`Athlete ${status === 'inactive' ? 'deactivated' : 'activated'}`);
          this.refresh();
        },
        error: (e) => {
          this.busyId.set(undefined);
          this.list.error.set(e.message);
        },
      });
  }

  remove(a: Athlete) {
    if (!a.id) return;

    const label = a.athleteName || a.email || 'this athlete';
    const confirmed = confirm(
      `Delete ${label}? The athlete will be hidden and active subscriptions will be cancelled. Payment history will be kept.`
    );
    if (!confirmed) return;

    this.msg.set('');
    this.list.error.set('');
    this.busyId.set(a.id);

    this.api.delete<{ status?: string; message?: string }>(`/api/athlete/${a.id}`).subscribe({
      next: () => {
        this.busyId.set(undefined);
        this.msg.set('Athlete deleted successfully');
        this.refresh();
      },
      error: (e) => {
        this.busyId.set(undefined);
        this.list.error.set(e.message);
      },
    });
  }
}
