import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

type Athlete = {
  id?: string;
  athleteName?: string;
  email?: string;
  phone?: string;
  gender?: string;
};

@Component({
  selector: 'app-athletes',
  template: `
    <h1>Athletes</h1>
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
              <td class="actions">
                <button
                  class="btn sm danger"
                  type="button"
                  [disabled]="deletingId() === a.id"
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
  `,
})
export class AthletesComponent implements OnInit {
  private api = inject(ApiService);
  athletes = signal<Athlete[]>([]);
  error = signal('');
  msg = signal('');
  deletingId = signal<string | undefined>(undefined);

  ngOnInit() {
    this.load();
  }

  load() {
    this.error.set('');
    this.api.get<{ data?: Athlete[] }>('/api/athlete/all?page=1&limit=50').subscribe({
      next: (r) => this.athletes.set(r.data || []),
      error: (e) => this.error.set(e.message),
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
    this.deletingId.set(a.id);

    this.api.delete<{ status?: string; message?: string }>(`/api/athlete/${a.id}`).subscribe({
      next: () => {
        this.deletingId.set(undefined);
        this.msg.set('Athlete deleted successfully');
        this.load();
      },
      error: (e) => {
        this.deletingId.set(undefined);
        this.error.set(e.message);
      },
    });
  }
}
