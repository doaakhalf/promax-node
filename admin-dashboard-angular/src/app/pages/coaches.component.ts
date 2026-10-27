import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { money, withCoachPricing } from '../core/money';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type CoachMedia = {
  id?: string;
  name?: string;
  image?: string | null;
  imageUrl?: string | null;
};

type CoachSpecialization = {
  value?: string;
  label?: string;
  labelAr?: string;
  labelEn?: string;
};

type CoachRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  status?: string;
  profileImage?: string | null;
  price?: number;
  coachPrice?: number;
  platformFee?: number;
  weeklyPrice?: number;
  lastSeenAt?: string | null;
  isLoggedIn?: boolean;
  AcceptTermsAndConditions?: boolean;
  weeklySubscriptionEnabled?: boolean;
  sport?: string;
  type?: string;
  headline?: string;
  introduction?: string;
  motivation?: string;
  trainingExperience?: string;
  yearOfExperience?: number | string | null;
  ratingAverage?: number;
  ratingCount?: number;
  specializations?: CoachSpecialization[];
  certificates?: CoachMedia[];
  achievements?: CoachMedia[];
  galleryImages?: CoachMedia[];
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalCoaches?: number;
};

@Component({
  selector: 'app-coaches',
  imports: [FormsModule, ScrollSentinelComponent],
  template: `
    <h1>Coaches</h1>
    <p class="muted">Coach price is registered. Athlete price includes platform fee.</p>
    <div class="filters">
      <select [(ngModel)]="status" (ngModelChange)="onStatusChange()">
        <option value="pending">pending</option>
        <option value="active">active</option>
        <option value="rejected">rejected</option>
        <option value="inactive">inactive</option>
      </select>
      <input
        type="search"
        [(ngModel)]="search"
        name="search"
        placeholder="Search name, email, or phone…"
        (keyup.enter)="onSearch()"
      />
      <button class="btn sm" type="button" (click)="onSearch()">Search</button>
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
            <th>Coach price</th>
            <th>Platform fee</th>
            <th>Athlete price</th>
            <th>Last Seen</th>
            <th>Terms</th>
            <th>Weekly</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of list.items(); track c.id) {
            <tr>
              <td>
                <button class="name-btn" type="button" (click)="open(c)">
                  @if (img(c.profileImage); as src) {
                    <img class="avatar" [src]="src" alt="" />
                  }
                  <span>{{ text(c.name) }}</span>
                </button>
              </td>
              <td>{{ text(c.email) }}</td>
              <td>{{ text(c.phone) }}</td>
              <td>{{ money(c.coachPrice) }}</td>
              <td>{{ money(c.platformFee) }}</td>
              <td>{{ money(c.price) }}</td>
              <td>{{ formatLastSeen(c.lastSeenAt) }}</td>
              <td [class.ok]="c.AcceptTermsAndConditions === true" [class.muted]="c.AcceptTermsAndConditions !== true">
                {{ c.AcceptTermsAndConditions === true ? 'Yes' : 'No' }}
              </td>
              <td [class.ok]="c.weeklySubscriptionEnabled === true" [class.muted]="c.weeklySubscriptionEnabled !== true">
                {{ c.weeklySubscriptionEnabled === true ? 'Yes' : 'No' }}
              </td>
              <td>{{ text(c.status) }}</td>
              <td class="actions">
                <button class="btn sm ghost" type="button" (click)="open(c)">Details</button>
                <button class="btn sm" type="button" (click)="change(c.id, 'active')">Active</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'pending')">Pending</button>
                <button class="btn sm ghost" type="button" (click)="change(c.id, 'rejected')">Reject</button>
                <button class="btn sm warning" type="button" (click)="change(c.id, 'inactive')">Deactivate</button>
                <button class="btn sm danger" type="button" (click)="remove(c)">Remove</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!list.items().length && !list.loading() && !list.error()) { <p class="muted pad">No coaches.</p> }
    </div>
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} coaches</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
    @if (selected(); as c) {
      <div class="backdrop" (click)="close()">
        <div
          class="card dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-dialog-title"
          (click)="$event.stopPropagation()"
        >
          <div class="dialog-head">
            <div class="profile">
              @if (img(c.profileImage); as src) {
                <img class="avatar lg" [src]="src" alt="" />
              }
              <div>
                <h2 id="coach-dialog-title">{{ text(c.name) }}</h2>
                <div class="muted">{{ text(c.email) }} · {{ text(c.phone) }}</div>
              </div>
            </div>
            <button class="btn sm ghost" type="button" (click)="close()">Close</button>
          </div>
          <dl class="details">
            <div>
              <dt>Gender</dt>
              <dd>{{ text(c.gender) }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ text(c.status) }}</dd>
            </div>
            <div>
              <dt>Sport / type</dt>
              <dd>{{ text(c.sport) }}{{ c.type ? ' · ' + c.type : '' }}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{{ experience(c.yearOfExperience) }}</dd>
            </div>
            <div>
              <dt>Coach price</dt>
              <dd>{{ money(c.coachPrice) }}</dd>
            </div>
            <div>
              <dt>Platform fee</dt>
              <dd>{{ money(c.platformFee) }}</dd>
            </div>
            <div>
              <dt>Athlete price</dt>
              <dd>{{ money(c.price) }}</dd>
            </div>
            <div>
              <dt>Weekly price</dt>
              <dd>{{ money(c.weeklyPrice) }}</dd>
            </div>
            <div>
              <dt>Terms</dt>
              <dd>{{ c.AcceptTermsAndConditions === true ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>Weekly enabled</dt>
              <dd>{{ c.weeklySubscriptionEnabled === true ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>{{ formatLastSeen(c.lastSeenAt) }}</dd>
            </div>
            <div>
              <dt>Logged in</dt>
              <dd>{{ c.isLoggedIn ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>{{ rating(c) }}</dd>
            </div>
            <div class="wide">
              <dt>Specializations</dt>
              <dd>{{ specializations(c.specializations) }}</dd>
            </div>
            <div class="wide">
              <dt>Headline</dt>
              <dd>{{ text(c.headline) }}</dd>
            </div>
            <div class="wide">
              <dt>Introduction</dt>
              <dd>{{ text(c.introduction) }}</dd>
            </div>
            <div class="wide">
              <dt>Motivation</dt>
              <dd>{{ text(c.motivation) }}</dd>
            </div>
            <div class="wide">
              <dt>Training experience</dt>
              <dd>{{ text(c.trainingExperience) }}</dd>
            </div>
            @if (c.certificates?.length) {
              <div class="wide">
                <dt>Certificates</dt>
                <dd class="shots">
                  @for (item of c.certificates; track item.id || item.image || item.name) {
                    @if (img(item.image); as src) {
                      <a [href]="src" target="_blank" rel="noopener">
                        <img class="shot" [src]="src" [alt]="item.name || 'Certificate'" />
                      </a>
                    }
                  }
                </dd>
              </div>
            }
            @if (c.achievements?.length) {
              <div class="wide">
                <dt>Achievements</dt>
                <dd class="shots">
                  @for (item of c.achievements; track item.id || item.image || item.name) {
                    @if (img(item.image); as src) {
                      <a [href]="src" target="_blank" rel="noopener">
                        <img class="shot" [src]="src" [alt]="item.name || 'Achievement'" />
                      </a>
                    }
                  }
                </dd>
              </div>
            }
            @if (c.galleryImages?.length) {
              <div class="wide">
                <dt>Gallery</dt>
                <dd class="shots">
                  @for (item of c.galleryImages; track item.id || item.imageUrl) {
                    @if (img(item.imageUrl); as src) {
                      <a [href]="src" target="_blank" rel="noopener">
                        <img class="shot" [src]="src" alt="" />
                      </a>
                    }
                  }
                </dd>
              </div>
            }
          </dl>
        </div>
      </div>
    }
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin: 0.75rem 0;
    }
    .filters select {
      width: 160px;
      margin: 0;
    }
    .filters input {
      flex: 1 1 220px;
      max-width: 360px;
      margin: 0;
    }
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
      width: min(640px, 100%);
      max-height: min(85vh, 800px);
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
    .shots {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .shot {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      object-fit: cover;
      background: #11181f;
      display: block;
    }
    @media (max-width: 560px) {
      .details { grid-template-columns: 1fr; }
    }
  `,
})
export class CoachesComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  status = 'pending';
  search = '';
  msg = signal('');
  selected = signal<CoachRow | null>(null);

  readonly list = new PagedList<CoachRow>(
    (page) => {
      const params = new URLSearchParams({ status: this.status, page: String(page) });
      const q = this.search.trim();
      if (q) params.set('q', q);
      return this.api
        .get<{ coaches?: CoachRow[]; pagination?: Pagination }>(`/api/admin/coaches?${params}`)
        .pipe(
          map((r) => ({
            items: (r.coaches || []).map(withCoachPricing),
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.totalCoaches || r.coaches?.length || 0,
          }))
        );
    },
    (c) => c.id
  );

  ngOnInit() {
    this.list.reset();
  }

  open(c: CoachRow) {
    this.selected.set(c);
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

  experience(value?: number | string | null) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n === 1 ? '1 year' : `${n} years`;
  }

  rating(c: CoachRow) {
    const avg = c.ratingAverage;
    const count = c.ratingCount;
    if (avg == null && (count == null || count === 0)) return '—';
    const stars = avg == null ? '—' : Number(avg).toFixed(1);
    return `${stars} (${count || 0})`;
  }

  specializations(items?: CoachSpecialization[]) {
    if (!items?.length) return '—';
    return items.map((s) => s.label || s.labelEn || s.labelAr || s.value || '').filter(Boolean).join(', ') || '—';
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

  onSearch() {
    this.list.reset();
  }

  private refresh() {
    this.list.refresh(() => {
      const openId = this.selected()?.id;
      if (openId) {
        this.selected.set(this.list.items().find((item) => item.id === openId) || null);
      }
    });
  }

  change(id: string, status: string) {
    this.msg.set('');
    this.api.put(`/api/coaches/${id}/change-status?status=${status}`).subscribe({
      next: () => {
        this.msg.set('Status updated');
        this.refresh();
      },
      error: (e) => this.list.error.set(e.message),
    });
  }

  remove(c: CoachRow) {
    if (!confirm(`Permanently delete ${c.name || c.email}? This cannot be undone.`)) return;
    this.change(c.id, 'removed');
  }
}
