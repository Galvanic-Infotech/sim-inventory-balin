import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/sim-dashboard/sim-dashboard.component').then(
            (m) => m.SimDashboardComponent,
          ),
      },
      {
        path: 'sim-inventory',
        loadComponent: () =>
          import('./features/sim-inventory/sim-inventory.component').then(
            (m) => m.SimInventoryComponent,
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/billing/billing.component').then(
            (m) => m.BillingComponent,
          ),
      },
      {
        path: 'devices',
        loadComponent: () =>
          import('./features/devices/devices.component').then(
            (m) => m.DevicesComponent,
          ),
      },
      {
        path: 'fitment',
        loadComponent: () =>
          import('./features/fitment/fitment.component').then(
            (m) => m.FitmentComponent,
          ),
      },
      {
        path: 'master',
        loadComponent: () =>
          import('./features/master/master.component').then(
            (m) => m.MasterComponent,
          ),
      },
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./features/onboarding/onboarding.component').then(
            (m) => m.OnboardingComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            (m) => m.ReportsComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
