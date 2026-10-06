import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type Athlete = {
  id?: string;
  athleteName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  status?: string;
};

type Pagination = {
  currentPage: number;
  totalPages: number;
  totalAthletes?: number;
};

@Component({
  selector: 'app-athletes',
  imports: [FormsModule],
  template: `
    <h1>Athletes</h1>
    <div class="row">
      <select [(ngModel)]="status" (ngModelChange)="onStatusChange()">
        <option value="">all</option>
        <option value="active">active</option>
        <option value="inactive">inactive</option>
      </select>
    </div>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Gender</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (a of athletes(); track a.id) {
            <tr>
              <td>{{ a.athleteName }}</td>
              <td>{{ a.email }}</td>
              <td>{{ a.phone }}</td>
              <td>{{ a.gender }}</td>
              <td>{{ a.status }}</td>
              <td class="actions">
                @if (a.status === 'active') {
                  <button
                    class="btn sm warning"
                    type="button"
                    [disabled]="busyId() === a.id"
                    (click)="changeStatus(a, 'inactive')"
                  >
                    Deactivate
                  </button>
                }
                @if (a.status === 'inactive') {
                  <button
                    class="btn sm"
                    type="button"
                    [disabled]="busyId() === a.id"
                    (click)="changeStatus(a, 'active')"
                  >
                    Activate
                  </button>
                }
                <button
                  class="btn sm danger"
                  type="button"
                  [disabled]="busyId() === a.id"
                  (click)="remove(a)"
                >
                  Delete
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!athletes().length && !error()) { <p class="muted pad">No athletes.</p> }
    </div>
    @if (totalPages() > 1) {
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="page === 1" (click)="changePage(-1)">Previous</button>
        <span class="muted">Page {{ page }} / {{ totalPages() }} ({{ totalAthletes() }} athletes)</span>
        <button class="btn sm ghost" type="button" [disabled]="page >= totalPages()" (click)="changePage(1)">Next</button>
      </div>
    }
  `,
})
export class AthletesComponent implements OnInit {
  private api = inject(ApiService);
  athletes = signal<Athlete[]>([]);
  totalPages = signal(1);
  totalAthletes = signal(0);
  error = signal('');
  msg = signal('');
  busyId = signal<string | undefined>(undefined);
  status = '';
  page = 1;
  private readonly limit = 20;

  ngOnInit() {
    this.load();
  }

  onStatusChange() {
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
      limit: String(this.limit),
    });
    if (this.status) params.set('status', this.status);
    this.api
      .get<{ data?: Athlete[]; pagination?: Pagination }>(`/api/athlete/all?${params}`)
      .subscribe({
        next: (r) => {
          const list = r.data || [];
          const pages = r.pagination?.totalPages || 1;
          if (!list.length && this.page > 1) {
            this.page = Math.min(this.page - 1, pages);
            this.load();
            return;
          }
          this.athletes.set(list);
          this.totalPages.set(pages);
          this.totalAthletes.set(r.pagination?.totalAthletes || list.length);
        },
        error: (e) => this.error.set(e.message),
      });
  }

  changeStatus(a: Athlete, status: 'active' | 'inactive') {
    if (!a.id) return;
    const label = a.athleteName || a.email || 'this athlete';
    const action = status === 'inactive' ? 'deactivate' : 'activate';
    if (!confirm(`${action} ${label}?`)) return;

    this.msg.set('');
    this.error.set('');
    this.busyId.set(a.id);

    this.api
      .put<{ status?: string; message?: string }>(
        `/api/athlete/${a.id}/change-status?status=${status}`,
        {}
      )
      .subscribe({
        next: () => {
          this.busyId.set(undefined);
          this.msg.set(`Athlete ${status === 'inactive' ? 'deactivated' : 'activated'}`);
          this.load();
        },
        error: (e) => {
          this.busyId.set(undefined);
          this.error.set(e.message);
        },
      });
  }

  remove(a: Athlete) {
    if (!a.id) return;

    const label = a.athleteName || a.email || 'this athlete';
    const confirmed = confirm(
      `Delete ${label}? The athlete will be hidden and active subscriptions will be cancelled. Payment history will be kept.`
    );
    if (!confirmed) return;

    this.msg.set('');
    this.error.set('');
    this.busyId.set(a.id);

    this.api.delete<{ status?: string; message?: string }>(`/api/athlete/${a.id}`).subscribe({
      next: () => {
        this.busyId.set(undefined);
        this.msg.set('Athlete deleted successfully');
        this.load();
      },
      error: (e) => {
        this.busyId.set(undefined);
        this.error.set(e.message);
      },
    });
  }
}
