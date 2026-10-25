import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type WeightTracker = {
  id: string;
  name?: string | null;
  email?: string | null;
  entriesCount?: number;
  lastRecordedAt?: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

@Component({
  selector: 'app-weight-trackers',
  imports: [DatePipe, ScrollSentinelComponent],
  template: `
    <h1>Weight trackers</h1>
    <p class="muted">Athletes who logged weight more than their signup entry.</p>

    <div class="kpis">
      <div class="card kpi">
        <div class="label">Athletes tracking weight</div>
        <div class="num">{{ list.total() }}</div>
      </div>
    </div>

    @if (list.error()) { <p class="err">{{ list.error() }}</p> }

    <div class="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Logs</th>
            <th>Last logged</th>
          </tr>
        </thead>
        <tbody>
          @for (item of list.items(); track item.id) {
            <tr>
              <td>{{ item.name || 'Unknown' }}</td>
              <td>{{ item.email || '—' }}</td>
              <td>{{ item.entriesCount ?? 0 }}</td>
              <td class="when">
                @if (item.lastRecordedAt) {
                  {{ item.lastRecordedAt | date:'medium' }}
                } @else {
                  —
                }
              </td>
            </tr>
          } @empty {
            @if (!list.loading() && !list.error()) {
              <tr>
                <td colspan="4" class="muted pad">No weight trackers yet.</td>
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
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} athletes</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
  styles: `
    .table-wrap { margin-top: 0.5rem; }
    .when { white-space: nowrap; }
  `,
})
export class WeightTrackersComponent implements OnInit {
  private api = inject(ApiService);

  readonly list = new PagedList<WeightTracker>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      return this.api
        .get<{ data?: WeightTracker[]; pagination?: Pagination }>(
          `/api/admin/weight-trackers?${params.toString()}`
        )
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
}
