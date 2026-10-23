import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type FeedbackSender = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type FeedbackItem = {
  id: string;
  title: string;
  type: 'complaint' | 'suggestion';
  body: string;
  createdAt?: string;
  sender?: FeedbackSender | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

@Component({
  selector: 'app-feedback',
  imports: [DatePipe, FormsModule, ScrollSentinelComponent],
  template: `
    <h1>Complaints & suggestions</h1>
    <p class="muted">Messages sent by athletes and coaches.</p>

    <div class="filters card pad">
      <label>
        <span class="muted">Type</span>
        <select [(ngModel)]="type" (ngModelChange)="applyFilters()">
          <option value="">all</option>
          <option value="complaint">complaint</option>
          <option value="suggestion">suggestion</option>
        </select>
      </label>
    </div>

    @if (list.error()) { <p class="err">{{ list.error() }}</p> }

    <div class="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Message</th>
            <th>Sender</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          @for (item of list.items(); track item.id) {
            <tr>
              <td class="title">{{ item.title }}</td>
              <td>
                <span class="badge" [class.suggestion]="item.type === 'suggestion'">
                  {{ item.type }}
                </span>
              </td>
              <td class="body">{{ item.body }}</td>
              <td>
                <div>{{ item.sender?.name || 'Unknown' }}</div>
                <div class="muted small">{{ item.sender?.email || '—' }}</div>
                <div class="muted small">{{ item.sender?.role || '—' }}</div>
              </td>
              <td class="when">{{ item.createdAt | date:'medium' }}</td>
            </tr>
          } @empty {
            @if (!list.loading() && !list.error()) {
              <tr>
                <td colspan="5" class="muted pad">No complaints or suggestions.</td>
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
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} messages</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
  styles: `
    .filters { margin: 1rem 0; max-width: 220px; }
    .filters label { display: block; }
    .filters span { display: block; font-size: 0.8rem; margin-bottom: 0.15rem; }
    .filters select { margin: 0; width: 100%; }
    .table-wrap { margin-top: 0.5rem; }
    .title { font-weight: 600; min-width: 8rem; }
    .body {
      white-space: pre-wrap;
      min-width: 16rem;
      max-width: 28rem;
    }
    .when { white-space: nowrap; }
    .small { font-size: 0.8rem; }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--danger, #c44) 22%, transparent);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.suggestion {
      background: color-mix(in srgb, var(--accent) 25%, transparent);
    }
  `,
})
export class FeedbackComponent implements OnInit {
  private api = inject(ApiService);

  type = '';

  readonly list = new PagedList<FeedbackItem>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.type) params.set('type', this.type);
      return this.api
        .get<{ data?: FeedbackItem[]; pagination?: Pagination }>(`/api/admin/feedback?${params.toString()}`)
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
