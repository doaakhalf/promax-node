import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type IntroVideoMedia = {
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  approvedAt?: string | null;
};

type IntroVideoReview = {
  id: string;
  status: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reason?: string | null;
  url?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  published?: IntroVideoMedia | null;
  coach: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profileImage?: string | null;
  };
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

@Component({
  selector: 'app-intro-videos',
  imports: [FormsModule, ScrollSentinelComponent],
  template: `
    <h1>Intro videos</h1>
    <p class="muted">Coach introduction videos waiting for review. The live profile keeps the last approved video until you approve a replacement.</p>
    @if (list.error()) { <p class="err">{{ list.error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <label class="muted" for="intro-status">Status</label>
    <select id="intro-status" [ngModel]="status()" (ngModelChange)="setStatus($event)">
      <option value="pending">Pending</option>
      <option value="changes_requested">Changes requested</option>
      <option value="rejected">Rejected</option>
      <option value="approved">Approved</option>
    </select>

    @for (item of list.items(); track item.id) {
      <article class="card review">
        <header class="review-head">
          @if (item.coach.profileImage) {
            <img class="avatar" [src]="img(item.coach.profileImage)" alt="" />
          }
          <div>
            <strong>{{ item.coach.name || 'Coach' }}</strong>
            <div class="muted">{{ item.coach.email }} · {{ item.coach.phone || 'No phone' }}</div>
            <div class="muted">
              {{ label(item.status) }}
              · {{ formatDuration(item.durationSeconds) }}
              · {{ formatSize(item.sizeBytes) }}
              · Submitted {{ formatWhen(item.submittedAt) }}
            </div>
          </div>
        </header>

        @if (item.url) {
          <video
            class="player"
            [src]="img(item.url)"
            controls
            playsinline
            (error)="markFailed(item.id)"
          ></video>
          @if (failed()[item.id]) {
            <p class="muted">This browser could not play the file. Common for iPhone HEVC video.</p>
          }
          <p><a [href]="img(item.url)" target="_blank" rel="noopener">Open video</a></p>
        } @else {
          <p class="muted">No video file.</p>
        }

        @if (item.published; as live) {
          @if (live.url && live.url !== item.url) {
            <p class="muted">
              Current live video stays published until this one is approved.
              <a [href]="img(live.url)" target="_blank" rel="noopener">Open live video</a>
            </p>
          }
        }

        @if (item.reason) {
          <p><span class="muted">Reason</span> {{ item.reason }}</p>
        }

        @if (item.status === 'pending') {
          <label class="muted" [attr.for]="'reason-' + item.id">Reason (required to reject or request changes)</label>
          <textarea [id]="'reason-' + item.id" rows="3" [(ngModel)]="reasons[item.id]"></textarea>
          <div class="actions">
            <button class="btn sm" type="button" [disabled]="busyId() === item.id" (click)="approve(item)">
              Approve
            </button>
            <button class="btn sm warning" type="button" [disabled]="busyId() === item.id" (click)="requestChanges(item)">
              Request changes
            </button>
            <button class="btn sm danger" type="button" [disabled]="busyId() === item.id" (click)="reject(item)">
              Reject
            </button>
          </div>
        }
      </article>
    }

    @if (!list.items().length && !list.loading() && !list.error()) { <p class="muted pad">No intro videos.</p> }
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} videos</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
  styles: `
    select { max-width: 280px; }
    .review { padding: 1rem; margin: 1rem 0; }
    .review-head { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
    .avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #11181f; }
    .player {
      display: block;
      width: min(100%, 420px);
      max-height: 420px;
      background: #11181f;
      border-radius: 8px;
    }
    textarea { max-width: 520px; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    a { color: var(--accent); }
  `,
})
export class IntroVideosComponent implements OnInit {
  private api = inject(ApiService);
  reasons: Record<string, string> = {};
  msg = signal('');
  status = signal('pending');
  busyId = signal('');
  failed = signal<Record<string, boolean>>({});

  readonly list = new PagedList<IntroVideoReview>(
    (page) =>
      this.api
        .get<{ data?: IntroVideoReview[]; pagination?: Pagination }>(
          `/api/admin/coach-intro-videos?status=${this.status()}&page=${page}&limit=20`
        )
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.total || r.data?.length || 0,
          }))
        ),
    (item) => item.id
  );

  ngOnInit() {
    this.list.reset();
  }

  setStatus(value: string) {
    this.status.set(value);
    this.msg.set('');
    this.failed.set({});
    this.list.reset();
  }

  img(path?: string | null) {
    return this.api.mediaUrl(path) || '';
  }

  markFailed(id: string) {
    this.failed.update((prev) => ({ ...prev, [id]: true }));
  }

  label(status: string) {
    if (status === 'pending') return 'Pending';
    if (status === 'changes_requested') return 'Changes requested';
    if (status === 'rejected') return 'Rejected';
    if (status === 'approved') return 'Approved';
    return status;
  }

  formatDuration(seconds?: number | null) {
    if (seconds == null) return '—';
    return `${Number(seconds).toFixed(1)}s`;
  }

  formatSize(bytes?: number | null) {
    if (bytes == null) return '—';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatWhen(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  approve(item: IntroVideoReview) {
    if (!confirm(`Approve intro video for ${item.coach.name || item.coach.email}?`)) return;
    this.busyId.set(item.id);
    this.msg.set('');
    this.list.error.set('');
    this.api.put(`/api/admin/coach-intro-videos/${item.id}/approve`).subscribe({
      next: () => {
        this.msg.set('Intro video approved');
        this.busyId.set('');
        this.list.refresh();
      },
      error: (e) => {
        this.list.error.set(e.message);
        this.busyId.set('');
      },
    });
  }

  reject(item: IntroVideoReview) {
    const reason = (this.reasons[item.id] || '').trim();
    if (!reason) {
      this.list.error.set('A reason is required');
      return;
    }
    if (!confirm(`Reject intro video for ${item.coach.name || item.coach.email}?`)) return;
    this.busyId.set(item.id);
    this.msg.set('');
    this.list.error.set('');
    this.api.put(`/api/admin/coach-intro-videos/${item.id}/reject`, { reason }).subscribe({
      next: () => {
        this.msg.set('Intro video rejected');
        this.busyId.set('');
        this.list.refresh();
      },
      error: (e) => {
        this.list.error.set(e.message);
        this.busyId.set('');
      },
    });
  }

  requestChanges(item: IntroVideoReview) {
    const reason = (this.reasons[item.id] || '').trim();
    if (!reason) {
      this.list.error.set('A reason is required');
      return;
    }
    if (!confirm(`Ask ${item.coach.name || item.coach.email} to edit this intro video?`)) return;
    this.busyId.set(item.id);
    this.msg.set('');
    this.list.error.set('');
    this.api
      .put(`/api/admin/coach-intro-videos/${item.id}/request-changes`, { reason })
      .subscribe({
        next: () => {
          this.msg.set('Changes requested');
          this.busyId.set('');
          this.list.refresh();
        },
        error: (e) => {
          this.list.error.set(e.message);
          this.busyId.set('');
        },
      });
  }
}
