import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type RatingPerson = {
  id?: string;
  name?: string | null;
};

type RatingItem = {
  id: string;
  stars: number;
  comment: string;
  createdAt?: string;
  athlete?: RatingPerson | null;
  coach?: RatingPerson | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

@Component({
  selector: 'app-ratings',
  imports: [DatePipe, FormsModule],
  template: `
    <h1>Coach ratings</h1>
    <p class="muted">Stars and comments athletes leave for coaches.</p>

    <div class="filters card pad">
      <label>
        <span class="muted">Stars</span>
        <select [(ngModel)]="stars" (ngModelChange)="applyFilters()">
          <option value="">all</option>
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
      </label>
      <label>
        <span class="muted">Coach id</span>
        <input
          [(ngModel)]="coachId"
          (keyup.enter)="applyFilters()"
          placeholder="User id"
        />
      </label>
      <button class="btn sm" type="button" (click)="applyFilters()">Apply</button>
    </div>

    @if (error()) { <p class="err">{{ error() }}</p> }

    <div class="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Stars</th>
            <th>Comment</th>
            <th>Athlete</th>
            <th>Coach</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.id) {
            <tr>
              <td class="stars">{{ item.stars }}</td>
              <td class="body">{{ item.comment }}</td>
              <td>{{ item.athlete?.name || 'Unknown' }}</td>
              <td>{{ item.coach?.name || 'Unknown' }}</td>
              <td class="when">{{ item.createdAt | date:'medium' }}</td>
            </tr>
          } @empty {
            @if (!error()) {
              <tr>
                <td colspan="5" class="muted pad">No ratings.</td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (totalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="page <= 1" (click)="changePage(-1)">
          Previous
        </button>
        <span class="muted">Page {{ page }} / {{ totalPages() }} ({{ total() }})</span>
        <button
          class="btn sm ghost"
          type="button"
          [disabled]="page >= totalPages()"
          (click)="changePage(1)"
        >
          Next
        </button>
      </div>
    }
  `,
  styles: `
    .filters {
      margin: 1rem 0;
      display: flex;
      gap: 1rem;
      align-items: end;
      flex-wrap: wrap;
    }
    .filters label { display: block; min-width: 10rem; }
    .filters span { display: block; font-size: 0.8rem; margin-bottom: 0.15rem; }
    .filters select,
    .filters input { margin: 0; width: 100%; }
    .table-wrap { margin-top: 0.5rem; }
    .stars { font-weight: 600; }
    .body {
      white-space: pre-wrap;
      min-width: 16rem;
      max-width: 28rem;
    }
    .when { white-space: nowrap; }
  `,
})
export class RatingsComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<RatingItem[]>([]);
  error = signal('');
  page = 1;
  stars = '';
  coachId = '';
  total = signal(0);
  totalPages = signal(1);

  ngOnInit() {
    this.load();
  }

  applyFilters() {
    this.page = 1;
    this.load();
  }

  changePage(delta: number) {
    const next = this.page + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.page = next;
    this.load();
  }

  load() {
    this.error.set('');
    const params = new URLSearchParams({
      page: String(this.page),
      limit: '20',
    });
    if (this.stars) params.set('stars', this.stars);
    const coachId = this.coachId.trim();
    if (coachId) params.set('coachId', coachId);

    this.api
      .get<{ data?: RatingItem[]; pagination?: Pagination }>(
        `/api/admin/ratings?${params.toString()}`
      )
      .subscribe({
        next: (r) => {
          this.items.set(r.data || []);
          this.total.set(r.pagination?.total || 0);
          this.totalPages.set(r.pagination?.totalPages || 1);
        },
        error: (e) => this.error.set(e.message),
      });
  }
}
