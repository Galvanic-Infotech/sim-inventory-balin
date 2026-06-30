import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_ENDPOINTS } from '../constants/api.constants';
import { PermissionGroup, RbacResponse } from '../../shared/models/rbac.model';
import { firstValueFrom, ReplaySubject, map } from 'rxjs';

/** All known permission keys */
export const PERMS = {
  // Users
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  // Entities
  ENTITY_VIEW: 'ENTITY_VIEW',
  ENTITY_CREATE: 'ENTITY_CREATE',
  ENTITY_UPDATE: 'ENTITY_UPDATE',
  // Roles
  ROLE_VIEW: 'ROLE_VIEW',
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_PERMISSIONS_VIEW: 'ROLE_PERMISSIONS_VIEW',
  ROLE_PERMISSIONS_MAP: 'ROLE_PERMISSIONS_MAP',
  // Permissions
  PERMISSION_VIEW: 'PERMISSION_VIEW',
  PERMISSION_CREATE: 'PERMISSION_CREATE',
  // Permission Groups
  PERMISSION_GROUP_VIEW: 'PERMISSION_GROUP_VIEW',
  PERMISSION_GROUP_CREATE: 'PERMISSION_GROUP_CREATE',
  // Entity Types
  ENTITY_TYPE_VIEW: 'ENTITY_TYPE_VIEW',
  ENTITY_TYPE_CREATE: 'ENTITY_TYPE_CREATE',
  ENTITY_TYPE_PERMISSIONS_VIEW: 'ENTITY_TYPE_PERMISSIONS_VIEW',
  ENTITY_TYPE_PERMISSIONS_MAP: 'ENTITY_TYPE_PERMISSIONS_MAP',
  ENTITY_ENTITY_TYPES_MAP: 'ENTITY_ENTITY_TYPES_MAP',
  // Master
  MASTER: 'MASTER',
  // SIM
  SIM_DASHBOARD: 'SIM_DASHBOARD',
  SIM_VIEW: 'SIM_VIEW',
  SIM_ACTIVATE: 'SIM_ACTIVATE',
  SIM_TEMP_SUSPEND: 'SIM_TEMP_SUSPEND',
  SIM_RESUME: 'SIM_RESUME',
  SIM_EDIT: 'SIM_EDIT',
  // Device
  DEVICE_MANAGEMENT: 'DEVICE_MANAGEMENT',
  DEVICE_BULK_UPLOAD: 'DEVICE_BULK_UPLOAD',
  // Device Model
  DEVICE_MODEL_CREATE: 'DEVICE_MODEL_CREATE',
  DEVICE_MODEL_UPDATE: 'DEVICE_MODEL_UPDATE',
  DEVICE_MODEL_APPROVE: 'DEVICE_MODEL_APPROVE',
  // AIS Device
  AIS_DEVICE_VIEW: 'AIS_DEVICE_VIEW',
  AIS_DEVICE_EDIT: 'AIS_DEVICE_EDIT',
  // Audit
  AUDIT_LOGS_VIEW: 'AUDIT_LOGS_VIEW',
  // Firmware
  FIRMWARE_VIEW: 'FIRMWARE_VIEW',
  FIRMWARE_UPLOAD: 'FIRMWARE_UPLOAD',
  FIRMWARE_DELETE: 'FIRMWARE_DELETE',
  // Fitment
  FITMENT_VIEW: 'FITMENT_VIEW',
  FITMENT_CREATE: 'FITMENT_CREATE',
  FITMENT_DELETE: 'FITMENT_DELETE',
  FITMENT_DEVICE_MAPPING: 'FITMENT_DEVICE_MAPPING',
  // Billing
  BILLING_VIEW: 'BILLING_VIEW',
  BILLING_GENERATE: 'BILLING_GENERATE',
  BILLING_CONFIG_VIEW: 'BILLING_CONFIG_VIEW',
  BILLING_CONFIG_UPDATE: 'BILLING_CONFIG_UPDATE',
  BILLING_AMOUNT_CREDIT: 'BILLING_AMOUNT_CREDIT',
  // Reports
  REPORTS_VIEW: 'REPORTS_VIEW',
} as const;

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);

  private readonly _permissions = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly loaded = signal(false);
  private readonly loaded$ = new ReplaySubject<boolean>(1);

  /** Resolves once perms are loaded (success or error). */
  whenLoaded(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    return firstValueFrom(this.loaded$).then(() => void 0);
  }

  /** Check single permission */
  has(perm: string): boolean {
    return this._permissions().has(perm);
  }

  /** Check any of given permissions */
  hasAny(...perms: string[]): boolean {
    const set = this._permissions();
    return perms.some((p) => set.has(p));
  }

  /** Reactive computed for template bindings */
  can = (perm: string) => computed(() => this._permissions().has(perm));

  canAny = (...perms: string[]) =>
    computed(() => {
      const set = this._permissions();
      return perms.some((p) => set.has(p));
    });

  /** Fetch permissions from API and store */
  fetch(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.http
      .get<RbacResponse<{ permissions: PermissionGroup[] }>>(API_ENDPOINTS.RBAC.PERMISSION_GROUPS_BY_ROLE)
      .pipe(
        map((res) => {
          const groups = res.data?.permissions ?? [];
          return groups.flatMap((g) => g.permissions ?? []);
        }),
      )
      .subscribe({
        next: (perms) => {
          this._permissions.set(new Set(perms.map((p) => p.name)));
          this.loading.set(false);
          this.loaded.set(true);
          this.loaded$.next(true);
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
          this.loaded$.next(true);
        },
      });
  }

  /** Clear on logout */
  clear(): void {
    this._permissions.set(new Set());
    this.loaded.set(false);
  }
}
