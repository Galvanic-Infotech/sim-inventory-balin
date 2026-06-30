import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { PermissionService } from '../services/permission.service';

const decide = (perm: PermissionService, router: Router, perms: string[]): boolean | UrlTree => {
  if (perms.length === 0) return true;
  if (perm.hasAny(...perms)) return true;
  return router.parseUrl('/dashboard');
};

export const permGuard = (...perms: string[]): CanActivateFn => {
  return () => {
    const perm = inject(PermissionService);
    const router = inject(Router);
    if (perms.length === 0) return true;
    if (perm.loaded()) return decide(perm, router, perms);
    return toObservable(perm.loaded).pipe(
      filter((v) => v),
      take(1),
      map(() => decide(perm, router, perms)),
    );
  };
};
