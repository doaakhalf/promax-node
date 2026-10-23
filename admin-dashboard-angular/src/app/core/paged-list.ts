import { computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export type PageResult<T> = {
  items: T[];
  totalPages: number;
  total?: number;
};

/**
 * Server-paginated list driven by infinite scrolling.
 *
 * `fetchPage(page)` returns one page (1-based). Call `reset()` for the
 * first load and whenever filters change, `loadMore()` from the scroll
 * sentinel, and `refresh()` after a mutation to reload the pages the
 * user has already scrolled through (without losing their place).
 *
 * Duplicate rows (same `key`) are dropped, so an item that shifts between
 * pages while scrolling never renders twice.
 */
export class PagedList<T> {
  readonly items = signal<T[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly hasMore = signal(true);

  private page = 0;
  private generation = 0;
  private subscription: Subscription | null = null;

  constructor(
    private readonly fetchPage: (page: number) => Observable<PageResult<T>>,
    private readonly keyOf: (item: T) => string | number | undefined
  ) {}

  get loadedPage() {
    return this.page;
  }

  /** Discard everything and load page 1 again (initial load / filters). */
  reset() {
    this.generation += 1;
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.page = 0;
    this.items.set([]);
    this.total.set(0);
    this.totalPages.set(1);
    this.hasMore.set(true);
    this.loading.set(false);
    this.loadMore();
  }

  /** Append the next page. No-op while loading or at the end of the list. */
  loadMore() {
    if (this.loading() || !this.hasMore()) return;
    const generation = this.generation;
    const nextPage = this.page + 1;
    this.loading.set(true);
    this.error.set('');

    this.subscription = this.fetchPage(nextPage).subscribe({
      next: (r) => {
        if (generation !== this.generation) return;
        const batch = r.items || [];
        const seen = new Set(this.items().map((x) => this.keyOf(x)));
        const unique = batch.filter((x) => {
          const key = this.keyOf(x);
          return key === undefined || !seen.has(key);
        });
        this.items.update((prev) => [...prev, ...unique]);
        this.totalPages.set(r.totalPages || 1);
        this.total.set(r.total ?? this.items().length);
        this.page = nextPage;
        this.hasMore.set(batch.length > 0 && nextPage < this.totalPages());
        this.loading.set(false);
      },
      error: (e) => {
        if (generation !== this.generation) return;
        this.error.set(e instanceof Error ? e.message : 'Failed to load');
        this.loading.set(false);
      },
    });
  }

  /** Reload every page loaded so far and replace the items with the result. */
  refresh(onSettled?: () => void) {
    if (this.loading()) return;
    const pagesToLoad = Math.max(this.page, 1);
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');

    const collected: T[] = [];
    const loadPage = (page: number) => {
      this.subscription = this.fetchPage(page).subscribe({
        next: (r) => {
          if (generation !== this.generation) return;
          collected.push(...(r.items || []));
          this.totalPages.set(r.totalPages || 1);
          this.total.set(r.total ?? collected.length);
          if (page < pagesToLoad && r.items?.length) {
            loadPage(page + 1);
            return;
          }
          const seen = new Set<string | number>();
          this.items.set(
            collected.filter((x) => {
              const key = this.keyOf(x);
              if (key === undefined) return true;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
          );
          this.page = page;
          this.hasMore.set(page < this.totalPages() && collected.length > 0);
          this.loading.set(false);
          onSettled?.();
        },
        error: (e) => {
          if (generation !== this.generation) return;
          this.error.set(e instanceof Error ? e.message : 'Failed to load');
          this.loading.set(false);
          onSettled?.();
        },
      });
    };
    loadPage(1);
  }
}

/**
 * Client-side infinite scrolling for endpoints that already return the
 * whole list: items are revealed one chunk at a time as the user scrolls.
 */
export class RevealList<T> {
  private readonly all = signal<T[]>([]);
  readonly visibleCount = signal(0);
  readonly visible = computed(() => this.all().slice(0, this.visibleCount()));
  readonly total = computed(() => this.all().length);
  readonly hasMore = computed(() => this.visibleCount() < this.all().length);

  constructor(private readonly chunkSize = 20) {
    this.visibleCount.set(chunkSize);
  }

  set(items: T[]) {
    this.all.set([...items]);
    this.visibleCount.set(this.chunkSize);
  }

  showMore() {
    if (this.hasMore()) this.visibleCount.update((c) => c + this.chunkSize);
  }
}
