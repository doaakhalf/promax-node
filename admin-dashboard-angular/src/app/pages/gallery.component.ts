import { Component, inject, OnInit, signal } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type GalleryOwner = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type GalleryItem = {
  id: string;
  imageUrl: string;
  fileName: string;
  fileSize?: number;
  createdAt?: string;
  owner?: GalleryOwner | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

@Component({
  selector: 'app-gallery',
  imports: [ScrollSentinelComponent],
  template: `
    <h1>Gallery</h1>
    <p class="muted">All coach gallery images. Click download to save a file.</p>
    @if (list.error()) { <p class="err">{{ list.error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="gallery-grid">
      @for (item of list.items(); track item.id) {
        <div class="card gallery-card">
          <img
            class="gallery-img"
            [src]="img(item.imageUrl)"
            [alt]="item.fileName"
            loading="lazy"
          />
          <div class="gallery-meta">
            <div class="owner">{{ item.owner?.name || 'Unknown' }}</div>
            <div class="muted">{{ item.owner?.email || '' }}</div>
            <div class="muted">{{ item.fileName }}</div>
            <div class="actions">
              <button
                class="btn sm"
                type="button"
                [disabled]="downloadingId() === item.id"
                (click)="download(item)"
              >
                {{ downloadingId() === item.id ? 'Downloading…' : 'Download' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (!list.items().length && !list.loading() && !list.error()) {
      <p class="muted pad">No gallery images.</p>
    }
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} images</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
  styles: `
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .gallery-card { overflow: hidden; }
    .gallery-img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      display: block;
      background: #11181f;
    }
    .gallery-meta { padding: 0.75rem; }
    .owner { font-weight: 600; margin-bottom: 0.15rem; }
    @media (max-width: 800px) {
      .gallery-grid { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class GalleryComponent implements OnInit {
  private api = inject(ApiService);

  msg = signal('');
  downloadingId = signal<string | null>(null);

  readonly list = new PagedList<GalleryItem>(
    (page) =>
      this.api
        .get<{ data?: GalleryItem[]; pagination?: Pagination }>(`/api/admin/gallery?page=${page}&limit=24`)
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

  img(path?: string) {
    return this.api.mediaUrl(path) || '';
  }

  async download(item: GalleryItem) {
    const url = this.img(item.imageUrl);
    if (!url) return;

    this.msg.set('');
    this.list.error.set('');
    this.downloadingId.set(item.id);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = item.fileName || `gallery-${item.id}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      this.msg.set(`Downloaded ${item.fileName}`);
    } catch (e) {
      this.list.error.set(e instanceof Error ? e.message : 'Download failed');
    } finally {
      this.downloadingId.set(null);
    }
  }
}
