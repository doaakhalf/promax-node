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
    <p class="muted">Read-only — no athlete update API.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th></tr></thead>
        <tbody>
          @for (a of athletes(); track a.id) {
            <tr>
              <td>{{ a.athleteName }}</td>
              <td>{{ a.email }}</td>
              <td>{{ a.phone }}</td>
              <td>{{ a.gender }}</td>
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

  ngOnInit() {
    this.api.get<{ data?: Athlete[] }>('/api/athlete/all?page=1&limit=50').subscribe({
      next: (r) => this.athletes.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
  }
}
