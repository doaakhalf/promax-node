import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

type WorkoutShell = {
  id?: string;
  name?: string;
  description?: string | null;
  type?: string;
};

type TrainingDay = {
  dayNumber: number;
  date?: string;
  isAssigned?: boolean;
  completedAt?: string | null;
  notes?: string | null;
  workout?: WorkoutShell | null;
};

type CalendarWeek = {
  weekNumber: number;
  startDate?: string;
  endDate?: string;
  isOpen?: boolean;
  trainingDays?: TrainingDay[];
};

type CalendarData = {
  calendarId?: string;
  trainingFrequency?: number;
  totalWeeks?: number;
  weeks?: CalendarWeek[];
  subscriptionPeriod?: { startDate?: string; endDate?: string };
};

type ExerciseSetDetail = {
  id?: string;
  sets?: number;
  reps?: number;
  restSeconds?: number;
  weight?: number | null;
  weightType?: string;
  durationType?: string;
  durationValue?: number | null;
};

type ExerciseInfo = {
  _id?: string;
  name?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  muscleGroup?: string;
  targetBodyParts?: string[];
  type?: string | null;
  image?: string | null;
  videoUrl?: string | null;
};

type ExerciseEntry = {
  exercise?: ExerciseInfo;
  order?: number;
  notes?: string | null;
  sets?: { setDetails?: ExerciseSetDetail[]; notes?: string | null }[];
};

type WorkoutDetail = {
  workoutId?: string;
  workout?: { name?: string; description?: string; workoutType?: string };
  exercises?: ExerciseEntry[];
};

@Component({
  selector: 'app-subscription-program',
  imports: [RouterLink, DatePipe],
  styles: `
    .back { display: inline-block; margin-bottom: 0.75rem; color: var(--muted); }
    .header-meta { margin-bottom: 1.25rem; }
    .week-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0 0.75rem;
    }
    .pill {
      border: 1px solid var(--line);
      background: transparent;
      color: var(--text);
      border-radius: 999px;
      padding: 0.45rem 0.95rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .pill.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .pill .lock { opacity: 0.75; font-size: 0.75rem; }
    .week-title { margin: 0.5rem 0 1rem; }
    .week-title h2 { margin: 0 0 0.2rem; }
    .days { display: flex; flex-direction: column; gap: 0.65rem; max-width: 640px; }
    .day {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
      overflow: hidden;
    }
    .day-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      padding: 0.85rem 1rem;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .day.expanded .day-head {
      background: color-mix(in srgb, var(--warning) 18%, var(--panel));
    }
    .day-head-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
    }
    .day-head-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
      font-weight: 700;
      background: color-mix(in srgb, var(--ok) 25%, transparent);
      color: var(--ok);
    }
    .toggle {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      border: 1px solid var(--line);
      display: grid;
      place-items: center;
      font-size: 1rem;
      line-height: 1;
      color: var(--muted);
    }
    .day-body { padding: 0 1rem 1rem; }
    .section-label {
      color: var(--muted);
      font-size: 0.85rem;
      margin: 0.25rem 0 0.65rem;
    }
    .workout-card {
      display: flex;
      gap: 0.85rem;
      align-items: stretch;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0.75rem;
      background: #11181f;
      margin-bottom: 0.75rem;
    }
    .workout-thumb {
      width: 72px;
      height: 72px;
      border-radius: 10px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: color-mix(in srgb, var(--accent) 18%, #11181f);
      color: var(--accent);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      text-align: center;
      padding: 0;
    }
    .workout-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .workout-thumb .thumb-label { padding: 0.25rem; }
    .workout-info { min-width: 0; flex: 1; }
    .workout-info strong { display: block; margin-bottom: 0.25rem; }
    .workout-info p {
      margin: 0;
      color: var(--muted);
      font-size: 0.85rem;
      white-space: pre-wrap;
    }
    .empty {
      color: var(--muted);
      font-size: 0.9rem;
      padding: 0.5rem 0 0.25rem;
    }
    .view-btn { width: 100%; }
    .exercises {
      margin-top: 0.75rem;
      border-top: 1px solid var(--line);
      padding-top: 0.75rem;
    }
    .ex-item {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.65rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #0f1419;
    }
    .ex-top {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
    .ex-text { min-width: 0; flex: 1; }
    .ex-item strong { display: block; margin-bottom: 0.25rem; }
    .ex-meta { color: var(--muted); font-size: 0.8rem; }
    .ex-sets { margin: 0.35rem 0 0; padding-left: 1rem; font-size: 0.8rem; color: var(--muted); }
    .ex-media { margin-top: 0.65rem; display: grid; gap: 0.5rem; }
    .ex-img {
      width: 100%;
      max-height: 220px;
      object-fit: contain;
      border-radius: 8px;
      background: #11181f;
      border: 1px solid var(--line);
    }
    .ex-video {
      width: 100%;
      max-height: 280px;
      border-radius: 8px;
      background: #000;
      border: 1px solid var(--line);
    }
    .ex-iframe {
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
      border-radius: 8px;
      background: #000;
    }
    .ex-link {
      color: var(--accent);
      font-size: 0.85rem;
      word-break: break-all;
    }
  `,
  template: `
    <a class="back" [routerLink]="['/subscriptions', coachId]">← Back to trainees</a>
    <h1>Program preparation</h1>
    <div class="header-meta muted">
      @if (athleteName()) {
        <div>{{ athleteName() }}</div>
      }
      @if (coachName()) {
        <div>Coach: {{ coachName() }}</div>
      }
    </div>

    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (loading()) { <p class="muted">Loading calendar…</p> }

    @if (calendar(); as cal) {
      <div class="week-pills">
        @for (w of cal.weeks || []; track w.weekNumber) {
          <button
            type="button"
            class="pill"
            [class.active]="selectedWeekNumber() === w.weekNumber"
            (click)="selectWeek(w.weekNumber)"
          >
            Week {{ w.weekNumber }}
            @if (!w.isOpen) { <span class="lock" title="Locked">lock</span> }
          </button>
        }
      </div>

      @if (selectedWeek(); as week) {
        <div class="week-title">
          <h2>Week {{ week.weekNumber }}</h2>
          <div class="muted">
            {{ week.startDate | date:'mediumDate' }}
            –
            {{ week.endDate | date:'mediumDate' }}
            @if (!week.isOpen) { · locked }
          </div>
        </div>

        <div class="days">
          @for (day of week.trainingDays || []; track day.dayNumber) {
            <div class="day" [class.expanded]="expandedDayNumber() === day.dayNumber">
              <button type="button" class="day-head" (click)="toggleDay(day.dayNumber)">
                <span class="day-head-left">Day {{ day.dayNumber }}</span>
                <span class="day-head-right">
                  @if (day.isAssigned) {
                    <span class="badge">Assigned</span>
                  }
                  <span class="toggle">{{ expandedDayNumber() === day.dayNumber ? '−' : '+' }}</span>
                </span>
              </button>

              @if (expandedDayNumber() === day.dayNumber) {
                <div class="day-body">
                  @if (day.isAssigned && day.workout) {
                    <div class="section-label">Assigned workout</div>
                    <div class="workout-card">
                      <div class="workout-thumb">
                        @if (workoutThumbUrl(day); as thumb) {
                          <img [src]="thumb" alt="" />
                        } @else {
                          <span class="thumb-label">{{ day.workout.type || 'workout' }}</span>
                        }
                      </div>
                      <div class="workout-info">
                        <strong>{{ day.workout.name || 'Untitled workout' }}</strong>
                        @if (day.workout.description) {
                          <p>{{ day.workout.description }}</p>
                        }
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn view-btn"
                      [disabled]="workoutLoading()"
                      (click)="viewWorkout(day)"
                    >
                      {{
                        showingWorkoutForDay() === day.dayNumber
                          ? 'Hide workout'
                          : workoutLoading() && loadingDayNumber() === day.dayNumber
                            ? 'Loading…'
                            : 'View workout'
                      }}
                    </button>

                    @if (showingWorkoutForDay() === day.dayNumber) {
                      @if (workoutError()) {
                        <p class="err">{{ workoutError() }}</p>
                      }
                      @if (workoutDetail(); as detail) {
                        <div class="exercises">
                          @if (!detail.exercises?.length) {
                            <p class="empty">No exercises in this workout.</p>
                          }
                          @for (ex of detail.exercises || []; track ex.exercise?._id || $index) {
                            <div class="ex-item">
                              <div class="ex-top">
                                <div class="ex-text">
                                  <strong>{{ exerciseName(ex.exercise) }}</strong>
                                  @if (exerciseParts(ex.exercise); as parts) {
                                    <div class="ex-meta">{{ parts }}</div>
                                  }
                                  @if (ex.notes) {
                                    <div class="ex-meta">{{ ex.notes }}</div>
                                  }
                                </div>
                              </div>

                              @if (ex.exercise?.image || ex.exercise?.videoUrl) {
                                <div class="ex-media">
                                  @if (media(ex.exercise?.image); as imgUrl) {
                                    <img class="ex-img" [src]="imgUrl" [alt]="exerciseName(ex.exercise)" />
                                  }
                                  @if (ex.exercise?.videoUrl; as video) {
                                    @if (youtubeEmbed(video); as embed) {
                                      <iframe
                                        class="ex-iframe"
                                        [src]="embed"
                                        title="Exercise video"
                                        allowfullscreen
                                        loading="lazy"
                                      ></iframe>
                                    } @else if (isDirectVideo(video)) {
                                      <video class="ex-video" [src]="media(video) || ''" controls playsinline></video>
                                    } @else {
                                      @if (media(video); as href) {
                                        <a class="ex-link" [href]="href" target="_blank" rel="noopener noreferrer">
                                          Open video
                                        </a>
                                      }
                                    }
                                  }
                                </div>
                              }

                              <ul class="ex-sets">
                                @for (set of ex.sets || []; track $index) {
                                  @for (sd of set.setDetails || []; track sd.id || $index) {
                                    <li>
                                      @if (sd.sets != null) { {{ sd.sets }} sets }
                                      @if (sd.reps != null) { · {{ sd.reps }} reps }
                                      @if (sd.weight != null) {
                                        · {{ sd.weight }}{{ sd.weightType ? ' ' + sd.weightType : '' }}
                                      }
                                      @if (sd.durationValue != null) {
                                        · {{ sd.durationValue }}{{ sd.durationType ? ' ' + sd.durationType : '' }}
                                      }
                                      @if (sd.restSeconds != null) { · rest {{ sd.restSeconds }}s }
                                    </li>
                                  }
                                }
                              </ul>
                            </div>
                          }
                        </div>
                      }
                    }
                  } @else {
                    <p class="empty">No workout assigned</p>
                  }
                </div>
              }
            </div>
          }
          @if (!(week.trainingDays || []).length) {
            <p class="muted">No training days in this week.</p>
          }
        </div>
      }
    }
  `,
})
export class SubscriptionProgramComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  coachId = '';
  athleteId = '';

  loading = signal(true);
  error = signal('');
  calendar = signal<CalendarData | null>(null);
  coachName = signal('');
  athleteName = signal('');

  selectedWeekNumber = signal(1);
  expandedDayNumber = signal<number | null>(1);

  workoutLoading = signal(false);
  workoutError = signal('');
  workoutDetail = signal<WorkoutDetail | null>(null);
  showingWorkoutForDay = signal<number | null>(null);
  loadingDayNumber = signal<number | null>(null);

  selectedWeek = computed(() => {
    const cal = this.calendar();
    const n = this.selectedWeekNumber();
    return (cal?.weeks || []).find((w) => w.weekNumber === n) || null;
  });

  ngOnInit() {
    this.coachId = this.route.snapshot.paramMap.get('coachId') || '';
    this.athleteId = this.route.snapshot.paramMap.get('athleteId') || '';
    this.loadCoachContext();
    this.loadCalendar();
  }

  media(path?: string | null): string | null {
    return this.api.mediaUrl(path);
  }

  exerciseName(ex?: ExerciseInfo | null): string {
    return ex?.nameAr || ex?.nameEn || ex?.name || 'Exercise';
  }

  exerciseParts(ex?: ExerciseInfo | null): string | null {
    if (ex?.muscleGroup) return ex.muscleGroup;
    const parts = ex?.targetBodyParts?.filter(Boolean);
    return parts?.length ? parts.join(', ') : null;
  }

  workoutThumbUrl(day: TrainingDay): string | null {
    if (this.showingWorkoutForDay() !== day.dayNumber) return null;
    const firstImage = (this.workoutDetail()?.exercises || [])
      .map((e) => e.exercise?.image)
      .find((img) => !!img);
    return this.media(firstImage || null);
  }

  youtubeEmbed(url: string): SafeResourceUrl | null {
    const id = this.youtubeId(url);
    if (!id) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${id}`
    );
  }

  isDirectVideo(url: string): boolean {
    if (this.youtubeId(url)) return false;
    const cleaned = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(cleaned) || !/^https?:\/\//i.test(url);
  }

  private youtubeId(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace(/^\//, '').slice(0, 11) || null;
      }
      if (u.hostname.includes('youtube.com')) {
        return u.searchParams.get('v') || u.pathname.match(/\/embed\/([\w-]{11})/)?.[1] || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  selectWeek(weekNumber: number) {
    this.selectedWeekNumber.set(weekNumber);
    this.expandedDayNumber.set(null);
    this.clearWorkoutDetail();
  }

  toggleDay(dayNumber: number) {
    if (this.expandedDayNumber() === dayNumber) {
      this.expandedDayNumber.set(null);
      this.clearWorkoutDetail();
      return;
    }
    this.expandedDayNumber.set(dayNumber);
    this.clearWorkoutDetail();
  }

  viewWorkout(day: TrainingDay) {
    if (this.showingWorkoutForDay() === day.dayNumber) {
      this.clearWorkoutDetail();
      return;
    }

    const workoutId = day.workout?.id;
    const calendarId = this.calendar()?.calendarId;
    if (!workoutId) {
      this.workoutError.set('Workout id missing');
      return;
    }

    this.workoutLoading.set(true);
    this.loadingDayNumber.set(day.dayNumber);
    this.workoutError.set('');
    this.workoutDetail.set(null);

    const qs = calendarId ? `?calendarId=${calendarId}` : '';
    this.api.get<{ data?: WorkoutDetail }>(`/api/workout/${workoutId}${qs}`).subscribe({
      next: (r) => {
        this.workoutDetail.set(r.data || null);
        this.showingWorkoutForDay.set(day.dayNumber);
        this.workoutLoading.set(false);
        this.loadingDayNumber.set(null);
      },
      error: (e) => {
        this.workoutError.set(e.message);
        this.workoutLoading.set(false);
        this.loadingDayNumber.set(null);
        this.showingWorkoutForDay.set(day.dayNumber);
      },
    });
  }

  private clearWorkoutDetail() {
    this.showingWorkoutForDay.set(null);
    this.workoutDetail.set(null);
    this.workoutError.set('');
    this.loadingDayNumber.set(null);
  }

  private loadCoachContext() {
    if (!this.coachId) return;
    this.api
      .get<{ coach?: { name?: string }; data?: { athlete?: { id?: string; name?: string } }[] }>(
        `/api/admin/subscriptions/coaches/${this.coachId}?limit=50`
      )
      .subscribe({
        next: (r) => {
          this.coachName.set(r.coach?.name || '');
          const match = (r.data || []).find(
            (t) => String(t.athlete?.id) === String(this.athleteId)
          );
          if (match?.athlete?.name) this.athleteName.set(match.athlete.name);
        },
        error: () => {
          /* optional context */
        },
      });
  }

  private loadCalendar() {
    if (!this.coachId || !this.athleteId) {
      this.loading.set(false);
      this.error.set('Missing coach or athlete id');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.api
      .get<{ data?: CalendarData }>(
        `/api/admin/subscriptions/coaches/${this.coachId}/athletes/${this.athleteId}/calendar`
      )
      .subscribe({
        next: (r) => {
          const cal = r.data || null;
          this.calendar.set(cal);
          const weeks = cal?.weeks || [];
          const preferred =
            weeks.find((w) => w.isOpen)?.weekNumber ?? weeks[0]?.weekNumber ?? 1;
          this.selectedWeekNumber.set(preferred);
          const firstDay =
            weeks.find((w) => w.weekNumber === preferred)?.trainingDays?.[0]?.dayNumber ??
            null;
          this.expandedDayNumber.set(firstDay);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e.message);
          this.calendar.set(null);
          this.loading.set(false);
        },
      });
  }
}
