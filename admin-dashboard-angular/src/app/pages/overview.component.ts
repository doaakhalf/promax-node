import { Component, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';

@Component({
  selector: 'app-overview',
  template: `
    <h1>Overview</h1>
    <p class="muted">KPIs from existing list APIs (no stats endpoint).</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    <div class="kpis">
      <div class="card kpi"><div class="label">Pending coaches</div><div class="num">{{ pendingCoaches() }}</div></div>
      <div class="card kpi"><div class="label">Active coaches</div><div class="num">{{ activeCoaches() }}</div></div>
      <div class="card kpi"><div class="label">Pending payments</div><div class="num">{{ pendingPayments() }}</div></div>
      <div class="card kpi"><div class="label">Upcoming coach payouts (net)</div><div class="num sm">{{ money(upcomingTotal()) }}</div></div>
      <div class="card kpi"><div class="label">Coaches with upcoming</div><div class="num">{{ upcomingCoaches() }}</div></div>
    </div>
  `,
})
export class OverviewComponent implements OnInit {
  private api = inject(ApiService);
  money = money;
  pendingCoaches = signal(0);
  activeCoaches = signal(0);
  pendingPayments = signal(0);
  upcomingTotal = signal(0);
  upcomingCoaches = signal(0);
  error = signal('');

  ngOnInit() {
    forkJoin({
      pending: this.api.get<{ pagination?: { totalCoaches?: number } }>('/api/coaches?status=pending&page=1'),
      active: this.api.get<{ pagination?: { totalCoaches?: number } }>('/api/coaches?status=active&page=1'),
      payments: this.api.get<{ data?: unknown[] }>('/api/admin/coaches/subscription'),
      payouts: this.api.get<{ data?: { totalAmount?: number; coachCount?: number; payouts?: unknown[] } }>(
        '/api/admin/payouts/upcoming'
      ),
    }).subscribe({
      next: (r) => {
        this.pendingCoaches.set(r.pending.pagination?.totalCoaches ?? 0);
        this.activeCoaches.set(r.active.pagination?.totalCoaches ?? 0);
        this.pendingPayments.set(r.payments.data?.length ?? 0);
        const d = r.payouts.data;
        this.upcomingTotal.set(d?.totalAmount ?? 0);
        this.upcomingCoaches.set(d?.coachCount ?? d?.payouts?.length ?? 0);
      },
      error: (e) => this.error.set(e.message),
    });
  }
}
