import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'coaches',
        loadComponent: () =>
          import('./pages/coaches.component').then((m) => m.CoachesComponent),
      },
      {
        path: 'athletes',
        loadComponent: () =>
          import('./pages/athletes.component').then((m) => m.AthletesComponent),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('./pages/subscriptions-list.component').then((m) => m.SubscriptionsListComponent),
      },
      {
        path: 'subscriptions/:coachId',
        loadComponent: () =>
          import('./pages/subscription-coach.component').then((m) => m.SubscriptionCoachComponent),
      },
      {
        path: 'payouts',
        loadComponent: () =>
          import('./pages/payouts.component').then((m) => m.PayoutsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'coming-soon/:feature',
        loadComponent: () =>
          import('./pages/coming-soon.component').then((m) => m.ComingSoonComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
