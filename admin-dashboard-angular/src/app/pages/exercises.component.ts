import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ApiService } from '../core/api.service';

type ExerciseItem = {
  exerciseId: string;
  name: string;
  gifUrl?: string;
  bodyParts?: string[];
  targetMuscles?: string[];
  equipments?: string[];
  instructions?: string[];
};

type LiveMeta = {
  total: number;
  hasNextPage: boolean;
  nextCursor: string | null;
};

@Component({
  selector: 'app-exercises',
  template: `
    <h1>Exercises</h1>
    <p class="muted">
      Live ExerciseDB catalog ({{ total() || '…' }} total). Scroll to load more.
    </p>
    @if (error()) {
      <p class="err">{{ error() }}</p>
    }

    <div class="exercise-grid">
      @for (item of items(); track item.exerciseId) {
        <div class="card exercise-card">
          <img
            class="exercise-img"
            [src]="item.gifUrl || ''"
            [alt]="item.name"
            loading="lazy"
          />
          <div class="exercise-meta">
            <div class="name">{{ item.name }}</div>
            <div class="muted">{{ labels(item.targetMuscles) || labels(item.bodyParts) }}</div>
            <div class="muted">{{ labels(item.equipments) }}</div>
          </div>
        </div>
      }
    </div>

    @if (!items().length && !loading() && !error()) {
      <p class="muted pad">No exercises found.</p>
    }

    @if (loading()) {
      <p class="muted pad">{{ items().length ? 'Loading more…' : 'Loading…' }}</p>
    }

    @if (!hasNextPage() && items().length) {
      <p class="muted pad">End of catalog.</p>
    }

    <div #sentinel class="sentinel" aria-hidden="true"></div>
  `,
  styles: `
    .exercise-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .exercise-card {
      overflow: hidden;
    }
    .exercise-img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
      background: #11181f;
    }
    .exercise-meta {
      padding: 0.75rem;
    }
    .name {
      font-weight: 600;
      margin-bottom: 0.15rem;
      text-transform: capitalize;
    }
    .sentinel {
      height: 1px;
      width: 100%;
    }
    @media (max-width: 800px) {
      .exercise-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ExercisesComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLElement>;

  items = signal<ExerciseItem[]>([]);
  error = signal('');
  loading = signal(false);
  total = signal(0);
  hasNextPage = signal(true);
  private nextCursor: string | null = null;
  private observer: IntersectionObserver | null = null;
  private readonly pageSize = 24;

  ngOnInit() {
    this.loadMore();
  }

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.loadMore();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    if (this.sentinel?.nativeElement) {
      this.observer.observe(this.sentinel.nativeElement);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  labels(values?: string[]) {
    return (values || []).filter(Boolean).join(', ');
  }

  loadMore() {
    if (this.loading() || !this.hasNextPage()) return;

    this.loading.set(true);
    this.error.set('');

    const params = new URLSearchParams({ limit: String(this.pageSize) });
    if (this.nextCursor) params.set('after', this.nextCursor);

    this.api
      .get<{ data?: ExerciseItem[]; meta?: LiveMeta }>(
        `/api/admin/exercises/live?${params}`
      )
      .subscribe({
        next: (r) => {
          const batch = r.data || [];
          const seen = new Set(this.items().map((x) => x.exerciseId));
          const unique = batch.filter((x) => x.exerciseId && !seen.has(x.exerciseId));
          this.items.update((prev) => [...prev, ...unique]);

          const meta = r.meta;
          this.total.set(meta?.total ?? this.total());
          this.hasNextPage.set(!!meta?.hasNextPage);
          this.nextCursor = meta?.nextCursor || null;
          this.loading.set(false);

          // Keep loading while the sentinel stays in view (short first pages).
          queueMicrotask(() => this.loadMoreIfSentinelVisible());
        },
        error: (e) => {
          this.error.set(e.message || 'Failed to load exercises');
          this.loading.set(false);
        },
      });
  }

  private loadMoreIfSentinelVisible() {
    const el = this.sentinel?.nativeElement;
    if (!el || this.loading() || !this.hasNextPage()) return;
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 200) {
      this.loadMore();
    }
  }
}
