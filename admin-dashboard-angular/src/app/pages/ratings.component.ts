import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

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
  imports: [DatePipe, FormsModule, ScrollSentinelComponent],
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

    @if (list.error()) { <p class="err">{{ list.error() }}</p> }

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
          @for (item of list.items(); track item.id) {
            <tr>
              <td class="stars">{{ item.stars }}</td>
              <td class="body">{{ item.comment }}</td>
              <td>{{ item.athlete?.name || 'Unknown' }}</td>
              <td>{{ item.coach?.name || 'Unknown' }}</td>
              <td class="when">{{ item.createdAt | date:'medium' }}</td>
            </tr>
          } @empty {
            @if (!list.loading() && !list.error()) {
              <tr>
                <td colspan="5" class="muted pad">No ratings.</td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} ratings</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
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

  stars = '';
  coachId = '';

  readonly list = new PagedList<RatingItem>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.stars) params.set('stars', this.stars);
      const coachId = this.coachId.trim();
      if (coachId) params.set('coachId', coachId);
      return this.api
        .get<{ data?: RatingItem[]; pagination?: Pagination }>(`/api/admin/ratings?${params.toString()}`)
        .pipe(
          map((r) => ({
            items: r.data || [],
            totalPages: r.pagination?.totalPages || 1,
            total: r.pagination?.total || 0,
          }))
        );
    },
    (item) => item.id
  );

  ngOnInit() {
    this.list.reset();
  }

  applyFilters() {
    this.list.reset();
  }
}
