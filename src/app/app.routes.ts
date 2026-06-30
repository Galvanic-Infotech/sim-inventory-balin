import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permGuard } from './core/guards/perm.guard';
import { PERMS } from './core/services/permission.service';

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
        canActivate: [permGuard(PERMS.SIM_VIEW)],
        loadComponent: () =>
          import('./features/sim-inventory/sim-inventory.component').then(
            (m) => m.SimInventoryComponent,
          ),
      },
      {
        path: 'billing',
        canActivate: [permGuard(PERMS.BILLING_VIEW)],
        loadComponent: () =>
          import('./features/billing/billing.component').then(
            (m) => m.BillingComponent,
          ),
      },
      {
        path: 'devices',
        canActivate: [permGuard(PERMS.AIS_DEVICE_VIEW)],
        loadComponent: () =>
          import('./features/devices/devices.component').then(
            (m) => m.DevicesComponent,
          ),
      },
      {
        path: 'fitment',
        canActivate: [permGuard(PERMS.FITMENT_VIEW)],
        loadComponent: () =>
          import('./features/fitment/fitment.component').then(
            (m) => m.FitmentComponent,
          ),
      },
      {
        path: 'master',
        canActivate: [
          permGuard(
            PERMS.MASTER,
            PERMS.USER_VIEW,
            PERMS.ROLE_VIEW,
            PERMS.PERMISSION_VIEW,
            PERMS.PERMISSION_GROUP_VIEW,
            PERMS.ENTITY_VIEW,
            PERMS.ENTITY_TYPE_VIEW,
          ),
        ],
        loadComponent: () =>
          import('./features/master/master.component').then(
            (m) => m.MasterComponent,
          ),
      },
      {
        path: 'onboarding',
        canActivate: [permGuard(PERMS.ENTITY_CREATE)],
        loadComponent: () =>
          import('./features/onboarding/onboarding.component').then(
            (m) => m.OnboardingComponent,
          ),
      },
      {
        path: 'reports',
        canActivate: [permGuard(PERMS.REPORTS_VIEW)],
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
