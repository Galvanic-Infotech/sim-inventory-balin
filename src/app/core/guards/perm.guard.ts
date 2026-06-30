import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const permGuard = (...perms: string[]): CanMatchFn => {
  return () => {
    const perm = inject(PermissionService);
    const router = inject(Router);
    if (perms.length === 0 || perm.hasAny(...perms)) {
      return true;
    }
    router.navigate(['/dashboard']);
    return false;
  };
};
