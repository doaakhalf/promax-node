import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

type ReviewField = {
  key: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
  changed: boolean;
};

type MediaItem = {
  id?: string | null;
  name?: string | null;
  year?: number | null;
  rank?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  fileName?: string | null;
  change?: string;
};

type ProfileReview = {
  id: string;
  status: string;
  submittedAt?: string;
  coach: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    accountStatus?: string | null;
    sport?: string | null;
    coachPrice?: number;
    profileImage?: string | null;
  };
  fields: ReviewField[];
  certificates: { before: MediaItem[]; after: MediaItem[] };
  achievements: { before: MediaItem[]; after: MediaItem[] };
  gallery: { before: MediaItem[]; after: MediaItem[] };
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

@Component({
  selector: 'app-profile-reviews',
  imports: [FormsModule],
  template: `
    <h1>Profile reviews</h1>
    <p class="muted">Coach profile edits waiting for approval. Live data stays unchanged until you approve.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    @for (review of reviews(); track review.id) {
      <article class="card review">
        <header class="review-head">
          @if (review.coach.profileImage) {
            <img class="avatar" [src]="img(review.coach.profileImage)" alt="" />
          }
          <div>
            <strong>{{ review.coach.name || 'Coach' }}</strong>
            <div class="muted">{{ review.coach.email }} · {{ review.coach.phone || 'No phone' }}</div>
            <div class="muted">
              Account {{ review.coach.accountStatus || '—' }}
              · {{ review.coach.sport || 'No sport' }}
              · {{ money(review.coach.coachPrice) }}
              · Submitted {{ formatWhen(review.submittedAt) }}
            </div>
          </div>
        </header>

        <div class="compare">
          <section>
            <h2>Before</h2>
            @for (field of review.fields; track field.key) {
              <div class="field" [class.diff]="field.changed">
                <div class="muted">{{ field.label }}</div>
                @if (field.key === 'profileImage') {
                  @if (field.before) {
                    <img class="shot" [src]="img(field.before)" alt="" />
                  } @else {
                    <div>—</div>
                  }
                } @else {
                  <div class="value">{{ display(field.key, field.before) }}</div>
                }
              </div>
            }
          </section>
          <section>
            <h2>After</h2>
            @for (field of review.fields; track field.key) {
              <div class="field" [class.diff]="field.changed">
                <div class="muted">{{ field.label }}</div>
                @if (field.key === 'profileImage') {
                  @if (field.after) {
                    <img class="shot" [src]="img(field.after)" alt="" />
                  } @else {
                    <div>—</div>
                  }
                } @else {
                  <div class="value">{{ display(field.key, field.after) }}</div>
                }
              </div>
            }
          </section>
        </div>

        <h2>Certificates</h2>
        <div class="compare">
          <section>
            <h3>Before</h3>
            @for (item of review.certificates.before; track item.id || item.name) {
              <div class="media" [class.diff]="item.change !== 'same'">
                @if (item.image) { <img class="shot" [src]="img(item.image)" alt="" /> }
                <div>
                  <div>{{ item.name }} <span class="tag">{{ item.change }}</span></div>
                  <div class="muted">{{ item.year }}</div>
                </div>
              </div>
            }
            @if (!review.certificates.before.length) { <p class="muted">None</p> }
          </section>
          <section>
            <h3>After</h3>
            @for (item of review.certificates.after; track (item.id || item.image || item.name)) {
              <div class="media" [class.diff]="item.change !== 'same'">
                @if (item.image) { <img class="shot" [src]="img(item.image)" alt="" /> }
                <div>
                  <div>{{ item.name }} <span class="tag">{{ item.change }}</span></div>
                  <div class="muted">{{ item.year }}</div>
                </div>
              </div>
            }
            @if (!review.certificates.after.length) { <p class="muted">None</p> }
          </section>
        </div>

        <h2>Achievements</h2>
        <div class="compare">
          <section>
            <h3>Before</h3>
            @for (item of review.achievements.before; track item.id || item.name) {
              <div class="media" [class.diff]="item.change !== 'same'">
                @if (item.image) { <img class="shot" [src]="img(item.image)" alt="" /> }
                <div>
                  <div>{{ item.name }} <span class="tag">{{ item.change }}</span></div>
                  <div class="muted">{{ item.rank }}</div>
                </div>
              </div>
            }
            @if (!review.achievements.before.length) { <p class="muted">None</p> }
          </section>
          <section>
            <h3>After</h3>
            @for (item of review.achievements.after; track (item.id || item.image || item.name)) {
              <div class="media" [class.diff]="item.change !== 'same'">
                @if (item.image) { <img class="shot" [src]="img(item.image)" alt="" /> }
                <div>
                  <div>{{ item.name }} <span class="tag">{{ item.change }}</span></div>
                  <div class="muted">{{ item.rank }}</div>
                </div>
              </div>
            }
            @if (!review.achievements.after.length) { <p class="muted">None</p> }
          </section>
        </div>

        <h2>Gallery</h2>
        <div class="compare">
          <section>
            <h3>Before</h3>
            <div class="thumbs">
              @for (item of review.gallery.before; track item.id || item.imageUrl) {
                <figure [class.diff]="item.change !== 'same'">
                  <img class="shot" [src]="img(item.imageUrl)" alt="" />
                  <figcaption class="tag">{{ item.change }}</figcaption>
                </figure>
              }
            </div>
            @if (!review.gallery.before.length) { <p class="muted">None</p> }
          </section>
          <section>
            <h3>After</h3>
            <div class="thumbs">
              @for (item of review.gallery.after; track item.id || item.imageUrl) {
                <figure [class.diff]="item.change !== 'same'">
                  <img class="shot" [src]="img(item.imageUrl)" alt="" />
                  <figcaption class="tag">{{ item.change }}</figcaption>
                </figure>
              }
            </div>
            @if (!review.gallery.after.length) { <p class="muted">None</p> }
          </section>
        </div>

        <label class="muted" [attr.for]="'reason-' + review.id">Rejection reason (optional)</label>
        <input [id]="'reason-' + review.id" [(ngModel)]="reasons[review.id]" />
        <div class="actions">
          <button class="btn sm" type="button" [disabled]="busyId() === review.id" (click)="approve(review)">
            Approve
          </button>
          <button class="btn sm danger" type="button" [disabled]="busyId() === review.id" (click)="reject(review)">
            Reject
          </button>
        </div>
      </article>
    }

    @if (!reviews().length && !error()) { <p class="muted pad">No profile reviews.</p> }

    @if (totalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="page === 1" (click)="changePage(-1)">Previous</button>
        <span class="muted">Page {{ page }} / {{ totalPages() }} ({{ total() }} reviews)</span>
        <button class="btn sm ghost" type="button" [disabled]="page >= totalPages()" (click)="changePage(1)">Next</button>
      </div>
    }
  `,
  styles: `
    .review { padding: 1rem; margin: 1rem 0; }
    .review-head { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
    .avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #11181f; }
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .field, .media {
      padding: 0.45rem 0.55rem;
      border-bottom: 1px solid var(--line);
    }
    .field.diff, .media.diff, figure.diff {
      background: rgba(232, 154, 60, 0.12);
      border-radius: 8px;
    }
    .value { white-space: pre-wrap; }
    .shot { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; background: #11181f; }
    .media { display: flex; gap: 0.6rem; align-items: center; }
    .thumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    figure { margin: 0; }
    .tag {
      display: inline-block;
      margin-left: 0.35rem;
      color: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    input { max-width: 420px; }
    @media (max-width: 800px) {
      .compare { grid-template-columns: 1fr; }
    }
  `,
})
export class ProfileReviewsComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  page = 1;
  reasons: Record<string, string> = {};
  reviews = signal<ProfileReview[]>([]);
  totalPages = signal(1);
  total = signal(0);
  error = signal('');
  msg = signal('');
  busyId = signal('');

  ngOnInit() {
    this.load();
  }

  img(path?: string | number | null) {
    return this.api.mediaUrl(path == null ? null : String(path)) || '';
  }

  display(key: string, value: string | number | null) {
    if (value == null || value === '') return '—';
    if (key === 'monthlyPriceEgp') return money(Number(value));
    return String(value);
  }

  formatWhen(value?: string) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  load() {
    this.error.set('');
    this.api
      .get<{ data?: ProfileReview[]; pagination?: Pagination }>(
        `/api/admin/coach-profile-reviews?status=in_review&page=${this.page}`
      )
      .subscribe({
        next: (response) => {
          this.reviews.set(response.data || []);
          this.totalPages.set(response.pagination?.totalPages || 1);
          this.total.set(response.pagination?.total || response.data?.length || 0);
        },
        error: (e) => this.error.set(e.message),
      });
  }

  changePage(delta: number) {
    this.page = Math.max(this.page + delta, 1);
    this.load();
  }

  approve(review: ProfileReview) {
    if (!confirm(`Approve profile changes for ${review.coach.name || review.coach.email}?`)) return;
    this.busyId.set(review.id);
    this.msg.set('');
    this.error.set('');
    this.api.put(`/api/admin/coach-profile-reviews/${review.id}/approve`).subscribe({
      next: () => {
        this.msg.set('Profile changes approved');
        this.busyId.set('');
        this.load();
      },
      error: (e) => {
        this.error.set(e.message);
        this.busyId.set('');
      },
    });
  }

  reject(review: ProfileReview) {
    if (!confirm(`Reject profile changes for ${review.coach.name || review.coach.email}?`)) return;
    this.busyId.set(review.id);
    this.msg.set('');
    this.error.set('');
    this.api
      .put(`/api/admin/coach-profile-reviews/${review.id}/reject`, {
        rejectionReason: this.reasons[review.id] || null,
      })
      .subscribe({
        next: () => {
          this.msg.set('Profile changes rejected');
          this.busyId.set('');
          this.load();
        },
        error: (e) => {
          this.error.set(e.message);
          this.busyId.set('');
        },
      });
  }
}
