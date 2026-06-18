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
        path: 'master',
        loadComponent: () =>
          import('./features/master/master.component').then(
            (m) => m.MasterComponent,
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
