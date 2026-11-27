import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { money } from '../core/money';
import { RevealList } from '../core/paged-list';
import { ScrollSentinelComponent } from '../core/scroll-sentinel.component';

type PackagePlan = 'quarterly' | 'semiannual' | 'annual';

type CoachPackage = {
  plan: PackagePlan;
  months: number;
  price: number;
  fullPrice: number;
  reducedBy: number;
};

type CoachPackages = {
  id: string;
  name?: string;
  email?: string | null;
  monthlyPrice: number;
  packages: CoachPackage[];
};

const PLAN_COLUMNS: { plan: PackagePlan; label: string }[] = [
  { plan: 'quarterly', label: '3 months' },
  { plan: 'semiannual', label: '6 months' },
  { plan: 'annual', label: '12 months' },
];

@Component({
  selector: 'app-packages',
  imports: [ScrollSentinelComponent],
  styles: `
    .pkg { white-space: nowrap; }
    .pkg .price { font-weight: 600; }
    .pkg .off { font-size: 0.8rem; }
    .saved { color: #0f7a3a; }
    .raised { color: #b42318; }
  `,
  template: `
    <h1>Packages</h1>
    <p class="muted">Coaches who set a 3, 6, or 12 month price. Reduction is monthly price × months, minus the package price they entered.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Coach</th>
            <th>Email</th>
            <th>Monthly</th>
            @for (col of columns; track col.plan) {
              <th>{{ col.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (c of list.visible(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td>{{ c.email }}</td>
              <td>{{ format(c.monthlyPrice) }}</td>
              @for (col of columns; track col.plan) {
                <td class="pkg">
                  @if (packageFor(c, col.plan); as pkg) {
                    <div class="price">{{ format(pkg.price) }}</div>
                    <div class="off" [class.saved]="pkg.reducedBy > 0" [class.raised]="pkg.reducedBy < 0">
                      {{ pkg.reducedBy > 0 ? 'reduced' : 'above monthly' }} {{ format(abs(pkg.reducedBy)) }}
                      <span class="muted">from {{ format(pkg.fullPrice) }}</span>
                    </div>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (!list.total() && !error()) { <p class="muted pad">No coaches have set a package price yet.</p> }
    </div>
    @if (list.hasMore()) { <p class="muted list-status">Scroll to show more coaches ({{ list.visible().length }} / {{ list.total() }})</p> }
    @if (!list.hasMore() && list.total()) { <p class="muted list-status">Showing all {{ list.total() }} coaches</p> }
    <app-scroll-sentinel [disabled]="!list.hasMore()" (reached)="list.showMore()" />
  `,
})
export class PackagesComponent implements OnInit {
  private api = inject(ApiService);
  readonly columns = PLAN_COLUMNS;
  readonly list = new RevealList<CoachPackages>(20);
  readonly format = money;
  error = signal('');

  ngOnInit() {
    this.api.get<{ data?: CoachPackages[] }>('/api/admin/coach-packages').subscribe({
      next: (r) => this.list.set(r.data || []),
      error: (e) => this.error.set(e.message),
    });
  }

  packageFor(coach: CoachPackages, plan: PackagePlan) {
    return coach.packages.find((pkg) => pkg.plan === plan) ?? null;
  }

  abs(value: number) {
    return Math.abs(value);
  }
}
