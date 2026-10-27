import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

type FreezeInfo = {
  freezeStart?: string | Date | null;
  freezeEnd?: string | Date | null;
  days?: number | null;
  status?: string | null;
  remainingDays?: number;
  isActive?: boolean;
  canUnfreeze?: boolean;
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
    freeze?: FreezeInfo | null;
  };
  workoutCalendar?: { hasCalendar?: boolean; currentWeek?: Week | null; weeks?: Week[] };
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
};

const MAX_FREEZE_DAYS = 14;

const toInputDate = (value: Date = new Date()) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const inclusiveDays = (start: string, end: string) => {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
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
    .freeze-badge {
      margin-top: 0.35rem;
      font-size: 0.75rem;
      color: var(--accent);
    }
    .actions-col { white-space: nowrap; }
    .actions-col .btn { margin: 0.15rem 0.15rem 0.15rem 0; }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.55);
    }
    .dialog {
      width: min(420px, 100%);
      padding: 1.1rem 1.2rem 1.25rem;
    }
    .dialog h2 { margin: 0 0 0.35rem; }
    .dialog-fields {
      display: grid;
      gap: 0.75rem;
      margin: 1rem 0;
    }
    .dialog-fields label {
      display: grid;
      gap: 0.3rem;
      font-size: 0.85rem;
    }
    .dialog-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
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

    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    @if (actionError()) { <p class="err">{{ actionError() }}</p> }
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
            <th>Freeze</th>
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
                @if (t.subscription?.freeze?.isActive) {
                  <div class="freeze-badge">
                    Frozen {{ t.subscription?.freeze?.days }}d
                    ({{ t.subscription?.freeze?.freezeStart | date:'mediumDate' }}
                    → {{ t.subscription?.freeze?.freezeEnd | date:'mediumDate' }})
                    @if (t.subscription?.freeze?.remainingDays; as rem) {
                      · {{ rem }}d left
                    }
                  </div>
                }
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
              <td class="actions-col">
                @if (canFreeze(t)) {
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="actingId() === t.subscriptionId"
                    (click)="openFreeze(t)"
                  >Freeze</button>
                }
                @if (t.subscription?.freeze?.canUnfreeze) {
                  <button
                    class="btn sm ghost"
                    type="button"
                    [disabled]="actingId() === t.subscriptionId"
                    (click)="unfreeze(t)"
                  >Unfreeze</button>
                }
                @if (!canFreeze(t) && !t.subscription?.freeze?.canUnfreeze) {
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

    @if (freezeTarget(); as target) {
      <div class="backdrop" (click)="closeFreeze()">
        <div class="card dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h2>Freeze subscription</h2>
          <p class="muted">
            {{ target.athlete?.name || 'Trainee' }} · max {{ maxFreezeDays }} days.
            Access stays active; end date and future weeks shift by the freeze length.
          </p>
          <div class="dialog-fields">
            <label>
              Freeze start
              <input type="date" [value]="freezeStart()" (input)="onFreezeStart($event)" />
            </label>
            <label>
              Freeze end
              <input type="date" [value]="freezeEnd()" (input)="onFreezeEnd($event)" />
            </label>
            <p [class.err]="!freezeDaysValid()" [class.muted]="freezeDaysValid()">
              Duration: {{ freezeDays() }} day(s)
              @if (!freezeDaysValid()) {
                · must be 1–{{ maxFreezeDays }}
              }
            </p>
          </div>
          @if (actionError()) { <p class="err">{{ actionError() }}</p> }
          <div class="dialog-actions">
            <button class="btn sm ghost" type="button" (click)="closeFreeze()">Cancel</button>
            <button
              class="btn sm"
              type="button"
              [disabled]="!freezeDaysValid() || actingId() === target.subscriptionId"
              (click)="confirmFreeze()"
            >Confirm freeze</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SubscriptionCoachComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  money = money;
  maxFreezeDays = MAX_FREEZE_DAYS;
  status = '';
  coachId = '';
  coachName = signal('');
  coachEmail = signal('');
  msg = signal('');
  actionError = signal('');
  actingId = signal<string | null>(null);
  freezeTarget = signal<Trainee | null>(null);
  freezeStart = signal(toInputDate());
  freezeEnd = signal(toInputDate());

  freezeDays = computed(() => inclusiveDays(this.freezeStart(), this.freezeEnd()));
  freezeDaysValid = computed(() => {
    const days = this.freezeDays();
    return days >= 1 && days <= MAX_FREEZE_DAYS;
  });

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

  canFreeze(t: Trainee) {
    return t.subscription?.status === 'active' && !t.subscription?.freeze?.isActive;
  }

  openFreeze(t: Trainee) {
    this.actionError.set('');
    this.msg.set('');
    this.freezeTarget.set(t);
    const start = toInputDate();
    this.freezeStart.set(start);
    this.freezeEnd.set(start);
  }

  closeFreeze() {
    if (this.actingId()) return;
    this.freezeTarget.set(null);
    this.actionError.set('');
  }

  onFreezeStart(event: Event) {
    this.freezeStart.set((event.target as HTMLInputElement).value);
  }

  onFreezeEnd(event: Event) {
    this.freezeEnd.set((event.target as HTMLInputElement).value);
  }

  confirmFreeze() {
    const target = this.freezeTarget();
    if (!target || !this.freezeDaysValid()) return;

    this.actingId.set(target.subscriptionId);
    this.actionError.set('');
    this.api
      .post<{ message?: string }>(`/api/admin/subscriptions/${target.subscriptionId}/freeze`, {
        freezeStart: this.freezeStart(),
        freezeEnd: this.freezeEnd(),
      })
      .subscribe({
        next: (r) => {
          this.msg.set(r.message || 'Subscription frozen');
          this.actingId.set(null);
          this.freezeTarget.set(null);
          this.list.reset();
        },
        error: (err: Error) => {
          this.actionError.set(err.message || 'Freeze failed');
          this.actingId.set(null);
        },
      });
  }

  unfreeze(t: Trainee) {
    const remaining = t.subscription?.freeze?.remainingDays ?? 0;
    if (
      !confirm(
        `Unfreeze ${t.athlete?.name || 'this trainee'}? This reverses ${remaining} remaining day(s) from the end date and future weeks.`
      )
    ) {
      return;
    }

    this.actingId.set(t.subscriptionId);
    this.actionError.set('');
    this.msg.set('');
    this.api
      .post<{ message?: string }>(`/api/admin/subscriptions/${t.subscriptionId}/unfreeze`, {})
      .subscribe({
        next: (r) => {
          this.msg.set(r.message || 'Subscription unfrozen');
          this.actingId.set(null);
          this.list.reset();
        },
        error: (err: Error) => {
          this.actionError.set(err.message || 'Unfreeze failed');
          this.actingId.set(null);
        },
      });
  }
}
