import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

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
  template: `
    <h1>Gallery</h1>
    <p class="muted">All coach gallery images. Click download to save a file.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="gallery-grid">
      @for (item of items(); track item.id) {
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

    @if (!items().length && !error()) {
      <p class="muted pad">No gallery images.</p>
    }

    @if (totalPages() > 1) {
      <div class="actions" style="margin-top: 1rem">
        <button class="btn ghost sm" type="button" [disabled]="page <= 1" (click)="prev()">
          Prev
        </button>
        <span class="muted">Page {{ page }} / {{ totalPages() }}</span>
        <button
          class="btn ghost sm"
          type="button"
          [disabled]="page >= totalPages()"
          (click)="next()"
        >
          Next
        </button>
      </div>
    }
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
  `,
})
export class GalleryComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<GalleryItem[]>([]);
  error = signal('');
  msg = signal('');
  downloadingId = signal<string | null>(null);
  page = 1;
  totalPages = signal(1);

  ngOnInit() {
    this.load();
  }

  img(path?: string) {
    return this.api.mediaUrl(path) || '';
  }

  load() {
    this.error.set('');
    this.api
      .get<{ data?: GalleryItem[]; pagination?: Pagination }>(
        `/api/admin/gallery?page=${this.page}&limit=24`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data || []);
          this.totalPages.set(r.pagination?.totalPages || 1);
        },
        error: (e) => this.error.set(e.message),
      });
  }

  prev() {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  next() {
    if (this.page >= this.totalPages()) return;
    this.page += 1;
    this.load();
  }

  async download(item: GalleryItem) {
    const url = this.img(item.imageUrl);
    if (!url) return;

    this.msg.set('');
    this.error.set('');
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
      this.error.set(e instanceof Error ? e.message : 'Download failed');
    } finally {
      this.downloadingId.set(null);
    }
  }
}
