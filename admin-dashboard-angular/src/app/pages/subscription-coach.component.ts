import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PagedList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';
import { money } from '../core/money';

type Week = {
  weekNumber: number;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  isOpen?: boolean;
  totalDays?: number;
  assignedDays?: number;
  complete?: boolean;
  days?: { dayNumber: number; date?: string; isAssigned?: boolean }[];
};

type Trainee = {
  subscriptionId: string;
  athlete?: { id: string; name?: string; email?: string; trainingFrequency?: string };
  subscription?: {
    plan?: string;
    status?: string;
    paymentStatus?: string;
    amount?: number;
    platformFee?: number;
    coachNetAmount?: number;
    startDate?: string;
    endDate?: string;
  };
  workoutCalendar?: { hasCalendar?: boolean; currentWeek?: Week | null; weeks?: Week[] };
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

@Component({
  selector: 'app-subscription-coach',
  imports: [RouterLink, DatePipe, ScrollSentinelComponent],
  styles: `
    .week-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .week {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.35rem 0.5rem;
      font-size: 0.8rem;
      min-width: 92px;
    }
    .week.current { border-color: var(--accent); }
    .week.ok { color: var(--ok); }
    .week.bad { color: var(--danger); }
    .week-dates { margin-top: 0.2rem; color: var(--muted); font-size: 0.72rem; white-space: nowrap; }
    .days { margin-top: 0.35rem; color: var(--muted); font-size: 0.75rem; }
    .back { display: inline-block; margin-bottom: 0.75rem; color: var(--muted); }
    .program-link { display: inline-block; margin-top: 0.35rem; font-size: 0.8rem; color: var(--accent); }
  `,
  template: `
    <a class="back" routerLink="/subscriptions">← All coaches</a>
    <h1>{{ coachName() || 'Coach subscriptions' }}</h1>
    <p class="muted">{{ coachEmail() }}</p>

    <div class="row" style="max-width: 200px">
      <select [value]="status" (change)="onStatus($event)">
        <option value="">all statuses</option>
        <option value="active">active</option>
        <option value="pending">pending</option>
        <option value="expired">expired</option>
        <option value="rejected">rejected</option>
        <option value="refunded">refunded</option>
      </select>
    </div>

    @if (list.error()) { <p class="err">{{ list.error() }}</p> }

    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trainee</th>
            <th>Plan / money</th>
            <th>Status</th>
            <th>Current week</th>
            <th>Weeks assignment</th>
            <th>Program</th>
          </tr>
        </thead>
        <tbody>
          @for (t of list.items(); track t.subscriptionId) {
            <tr>
              <td>
                <div>{{ t.athlete?.name }}</div>
                <div class="muted">{{ t.athlete?.email }}</div>
              </td>
              <td>
                <div>{{ t.subscription?.plan }}</div>
                <div class="muted">paid {{ money(t.subscription?.amount) }}</div>
                <div class="muted">coach {{ money(t.subscription?.coachNetAmount) }}</div>
              </td>
              <td>
                {{ t.subscription?.status }}
                <div class="muted">pay {{ t.subscription?.paymentStatus }}</div>
                <div class="muted">
                  {{ t.subscription?.startDate | date:'mediumDate' }}
                  → {{ t.subscription?.endDate | date:'mediumDate' }}
                </div>
              </td>
              <td>
                @if (t.workoutCalendar?.currentWeek; as w) {
                  Week {{ w.weekNumber }}
                  <div class="muted">{{ w.assignedDays }}/{{ w.totalDays }} assigned</div>
                } @else {
                  <span class="muted">Not in a week window</span>
                }
              </td>
              <td>
                @if (t.workoutCalendar?.hasCalendar) {
                  <div class="week-row">
                    @for (w of t.workoutCalendar?.weeks || []; track w.weekNumber) {
                      <div class="week" [class.current]="w.isCurrent" [class.ok]="w.complete" [class.bad]="!w.complete">
                        W{{ w.weekNumber }} {{ w.assignedDays }}/{{ w.totalDays }}
                        @if (w.isCurrent) { · now }
                        @if (w.startDate || w.endDate) {
                          <div class="week-dates">
                            {{ w.startDate | date:'MMM d' }} → {{ w.endDate | date:'MMM d, y' }}
                          </div>
                        }
                        <div class="days">
                          @for (d of w.days || []; track d.dayNumber) {
                            D{{ d.dayNumber }} {{ d.isAssigned ? '✓' : '—' }}
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <span class="muted">No calendar yet</span>
                }
              </td>
              <td>
                @if (t.workoutCalendar?.hasCalendar && coachId) {
                  @if (t.athlete?.id; as athleteId) {
                    <a
                      class="program-link"
                      [routerLink]="['/subscriptions', coachId, 'athletes', athleteId]"
                    >View program</a>
                  } @else {
                    <span class="muted">—</span>
                  }
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!list.items().length && !list.loading() && !list.error()) { <p class="muted pad">No trainees for this filter.</p> }
    </div>
    @if (list.loading()) { <p class="muted list-status">{{ list.items().length ? 'Loading more…' : 'Loading…' }}</p> }
    @if (list.error() && list.items().length) {
      <div class="list-status"><button class="btn sm ghost" type="button" (click)="list.loadMore()">Retry</button></div>
    }
    @if (!list.hasMore() && list.items().length) { <p class="muted list-status">Showing all {{ list.total() }} trainees</p> }
    <app-scroll-sentinel [disabled]="list.loading() || !list.hasMore() || !!list.error()" (reached)="list.loadMore()" />
  `,
})
export class SubscriptionCoachComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  money = money;
  status = '';
  coachId = '';
  coachName = signal('');
  coachEmail = signal('');

  readonly list = new PagedList<Trainee>(
    (page) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (this.status) params.set('status', this.status);
      return this.api
        .get<{ coach?: { name?: string; email?: string }; data?: Trainee[]; pagination?: Pagination }>(
          `/api/admin/subscriptions/coaches/${this.coachId}?${params.toString()}`
        )
        .pipe(
          map((r) => {
            this.coachName.set(r.coach?.name || '');
            this.coachEmail.set(r.coach?.email || '');
            return {
              items: r.data || [],
              totalPages: r.pagination?.totalPages || 1,
              total: r.pagination?.total || r.data?.length || 0,
            };
          })
        );
    },
    (t) => t.subscriptionId
  );

  ngOnInit() {
    this.coachId = this.route.snapshot.paramMap.get('coachId') || '';
    if (this.coachId) this.list.reset();
  }

  onStatus(event: Event) {
    this.status = (event.target as HTMLSelectElement).value;
    this.list.reset();
  }
}
