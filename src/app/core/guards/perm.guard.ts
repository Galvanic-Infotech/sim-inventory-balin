import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

const decide = (perm: PermissionService, router: Router, perms: string[]): boolean | UrlTree => {
  if (perms.length === 0) return true;
  if (perm.hasAny(...perms)) return true;
  return router.parseUrl('/dashboard');
};

export const permGuard = (...perms: string[]): CanActivateFn => {
  return async () => {
    const perm = inject(PermissionService);
    const router = inject(Router);
    const auth = inject(AuthService);
    if (perms.length === 0) return true;
    if (!perm.loaded() && !perm.loading() && auth.isLoggedIn()) {
      perm.fetch();
    }
    await perm.whenLoaded();
    return decide(perm, router, perms);
  };
};
