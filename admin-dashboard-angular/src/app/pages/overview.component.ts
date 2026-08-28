import { Component, inject, OnInit, signal } from '@angular/core';
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
    this.api.get<{
      data?: {
        pendingCoaches?: number;
        activeCoaches?: number;
        pendingPayments?: number;
        upcomingTotal?: number;
        upcomingCoaches?: number;
      };
    }>('/api/admin/overview/summary').subscribe({
      next: (r) => {
        const d = r.data;
        this.pendingCoaches.set(d?.pendingCoaches ?? 0);
        this.activeCoaches.set(d?.activeCoaches ?? 0);
        this.pendingPayments.set(d?.pendingPayments ?? 0);
        this.upcomingTotal.set(d?.upcomingTotal ?? 0);
        this.upcomingCoaches.set(d?.upcomingCoaches ?? 0);
      },
      error: (e) => this.error.set(e.message),
    });
  }
}
