import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
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
  imports: [RouterLink, DatePipe],
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
    .days { margin-top: 0.35rem; color: var(--muted); font-size: 0.75rem; }
    .back { display: inline-block; margin-bottom: 0.75rem; color: var(--muted); }
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

    @if (error()) { <p class="err">{{ error() }}</p> }

    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trainee</th>
            <th>Plan / money</th>
            <th>Status</th>
            <th>Current week</th>
            <th>Weeks assignment</th>
          </tr>
        </thead>
        <tbody>
          @for (t of trainees(); track t.subscriptionId) {
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
            </tr>
          }
        </tbody>
      </table>
      @if (!trainees().length && !error()) { <p class="muted pad">No trainees for this filter.</p> }
    </div>
    @if (totalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="page === 1" (click)="changePage(-1)">Previous</button>
        <span class="muted">Page {{ page }} / {{ totalPages() }}</span>
        <button class="btn sm ghost" type="button" [disabled]="page >= totalPages()" (click)="changePage(1)">Next</button>
      </div>
    }
  `,
})
export class SubscriptionCoachComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  money = money;
  status = '';
  trainees = signal<Trainee[]>([]);
  coachName = signal('');
  coachEmail = signal('');
  error = signal('');
  page = 1;
  totalPages = signal(1);

  ngOnInit() {
    this.load();
  }

  onStatus(event: Event) {
    this.status = (event.target as HTMLSelectElement).value;
    this.page = 1;
    this.load();
  }

  load() {
    const coachId = this.route.snapshot.paramMap.get('coachId');
    if (!coachId) return;
    this.error.set('');
    const params = new URLSearchParams({
      page: String(this.page),
      limit: '20',
    });
    if (this.status) params.set('status', this.status);
    this.api
      .get<{ coach?: { name?: string; email?: string }; data?: Trainee[]; pagination?: Pagination }>(
        `/api/admin/subscriptions/coaches/${coachId}?${params.toString()}`
      )
      .subscribe({
        next: (r) => {
          this.coachName.set(r.coach?.name || '');
          this.coachEmail.set(r.coach?.email || '');
          this.trainees.set(r.data || []);
          this.totalPages.set(r.pagination?.totalPages || 1);
        },
        error: (e) => this.error.set(e.message),
      });
  }

  changePage(delta: number) {
    this.page = Math.max(this.page + delta, 1);
    this.load();
  }
}
