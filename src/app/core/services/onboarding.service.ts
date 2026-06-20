import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { API_ENDPOINTS } from '../constants/api.constants';
import { AuthService } from './auth.service';
import { RbacService } from './rbac.service';
import { getApiResponseError } from '../utils/api-error.util';
import {
  OnboardingRequest,
  OnboardingResult,
  OnboardingStep,
  OnboardingStepKey,
} from '../../shared/models/onboarding.model';
import {
  PermissionGroup,
  RbacResponse,
  RbacRole,
} from '../../shared/models/rbac.model';

const DEFAULT_ROLE_NAME = 'Admin';

const STEP_DEFS: { key: Exclude<OnboardingStepKey, 'idle' | 'error' | 'done' | 'resolveEntityType'>; labelKey: string }[] = [
  { key: 'createEntity', labelKey: 'onboarding.steps.createEntity' },
  { key: 'createRole', labelKey: 'onboarding.steps.createRole' },
  { key: 'assignPermissions', labelKey: 'onboarding.steps.assignPermissions' },
  { key: 'createUser', labelKey: 'onboarding.steps.createUser' },
];

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly rbac = inject(RbacService);
  private readonly auth = inject(AuthService);
  private readonly EP = API_ENDPOINTS.RBAC;

  initialSteps(): OnboardingStep[] {
    return STEP_DEFS.map((s) => ({ ...s, status: 'pending' }));
  }

  run(
    input: OnboardingRequest,
    onProgress: (steps: OnboardingStep[]) => void,
  ): Observable<OnboardingResult> {
    const entityTypeId = input.entityTypeId.trim();
    const roleName = (input.roleName ?? DEFAULT_ROLE_NAME).trim();
    const parentEntityId = this.auth.entityId();
    if (!parentEntityId) {
      return throwError(() => new Error('No active entity context'));
    }
    if (!entityTypeId) {
      return throwError(() => new Error('Entity type is required'));
    }

    let steps = this.initialSteps();
    const patch = (key: OnboardingStepKey, status: OnboardingStep['status'], detail?: string) => {
      steps = steps.map((s) => {
        if (s.key === key) return { ...s, status, detail };
        if (status === 'active') {
          const order = STEP_DEFS.map((d) => d.key);
          const activeIdx = order.indexOf(key as (typeof order)[number]);
          const thisIdx = order.indexOf(s.key as (typeof order)[number]);
          if (thisIdx >= 0 && thisIdx < activeIdx && s.status === 'pending') {
            return { ...s, status: 'done' as const };
          }
        }
        return s;
      });
      onProgress([...steps]);
    };

    patch('createEntity', 'active');

    return this.rbac
      .createEntity({
        name: input.entityName.trim(),
        description: input.entityName.trim(),
        entityTypeId,
        parentEntityId,
      })
      .pipe(
        switchMap((createRes) => {
          const createMsg = getApiResponseError(createRes, 'Failed to create entity');
          if (createMsg) return throwError(() => new Error(createMsg));
          return this.resolveEntityId(input.entityName.trim(), entityTypeId, createRes).pipe(
            map((entityId) => ({ entityId })),
          );
        }),
        switchMap(({ entityId }) => {
        patch('createEntity', 'done', entityId);
        patch('createRole', 'active');

        return this.postAsEntity(this.EP.ROLE, entityId, {
          name: roleName,
          description: `${roleName} role`,
          entityId,
        }).pipe(
          switchMap((roleRes) => {
            const roleMsg = getApiResponseError(roleRes, 'Failed to create role');
            if (roleMsg) return throwError(() => new Error(roleMsg));
            return this.resolveRoleId(entityId, roleName, roleRes).pipe(
              map((roleId) => ({ entityId, roleId })),
            );
          }),
        );
      }),
      switchMap(({ entityId, roleId }) => {
        patch('createRole', 'done', roleId);
        patch('assignPermissions', 'active');

        return this.getAsEntity<{ permissions: PermissionGroup[] }>(
          this.EP.PERMISSION_GROUPS_BY_ENTITY,
          entityId,
        ).pipe(
          switchMap((permRes) => {
            const permMsg = getApiResponseError(permRes, 'Failed to load permissions');
            if (permMsg) return throwError(() => new Error(permMsg));
            const permissionIds = collectPermissionIds(permRes.data?.permissions ?? []);
            if (!permissionIds.length) {
              return throwError(() => new Error('No permissions available for this entity'));
            }
            return this.postAsEntity(this.EP.ASSIGN_ROLE_PERMISSIONS, entityId, {
              roleId,
              permissionIds,
            }).pipe(
              switchMap((assignRes) => {
                const assignMsg = getApiResponseError(assignRes, 'Failed to assign permissions');
                if (assignMsg) return throwError(() => new Error(assignMsg));
                return of({ entityId, roleId, permissionCount: permissionIds.length });
              }),
            );
          }),
        );
      }),
      switchMap(({ entityId, roleId, permissionCount }) => {
        patch('assignPermissions', 'done', String(permissionCount));
        patch('createUser', 'active');

        return this.postAsEntity(this.EP.USERS, entityId, {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim(),
          mobileNumber: input.mobile.trim(),
          password: input.password,
          roleId,
          entityId,
        }).pipe(
          switchMap((userRes) => {
            const userMsg = getApiResponseError(userRes, 'Failed to create user');
            if (userMsg) return throwError(() => new Error(userMsg));
            patch('createUser', 'done');
            this.auth.fetchEntities();
            return of({
              entityId,
              entityName: input.entityName.trim(),
              roleId,
              roleName,
              userId: extractResourceId(userRes.data) ?? undefined,
              email: input.email.trim(),
              mobile: input.mobile.trim(),
              password: input.password,
            } satisfies OnboardingResult);
          }),
        );
      }),
    );
  }

  private resolveEntityId(
    name: string,
    entityTypeId: string,
    createRes: RbacResponse<unknown>,
  ): Observable<string> {
    const id = extractResourceId(createRes.data);
    if (id) return of(id);
    return this.rbac.getEntities(entityTypeId, { searchTerm: name, pageNumber: 1, pageSize: 20 }).pipe(
      map((res) => {
        const match = (res.data ?? []).find((e) => e.name.trim() === name);
        if (!match) throw new Error(`Created entity "${name}" but could not resolve its ID`);
        return match.id;
      }),
    );
  }

  private resolveRoleId(
    entityId: string,
    roleName: string,
    createRes: RbacResponse<unknown>,
  ): Observable<string> {
    const id = extractResourceId(createRes.data);
    if (id) return of(id);
    return this.getAsEntity<RbacRole[]>(this.EP.ROLE, entityId, { entityId, pageNumber: '1', pageSize: '50' }).pipe(
      map((res) => {
        const match = (res.data ?? []).find(
          (r) => r.roleName?.trim().toLowerCase() === roleName.toLowerCase(),
        );
        if (!match) throw new Error(`Created role "${roleName}" but could not resolve its ID`);
        return match.id;
      }),
    );
  }

  private getAsEntity<T>(
    path: string,
    entityId: string,
    params?: Record<string, string>,
  ): Observable<RbacResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => (httpParams = httpParams.set(k, v)));
    }
    return this.http.get<RbacResponse<T>>(path, {
      params: httpParams,
      headers: { 'X-Entity-ID': entityId },
    });
  }

  private postAsEntity<T>(
    path: string,
    entityId: string,
    body: unknown,
  ): Observable<RbacResponse<T>> {
    return this.http.post<RbacResponse<T>>(path, body, {
      headers: { 'X-Entity-ID': entityId },
    });
  }
}

function collectPermissionIds(groups: PermissionGroup[]): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const perm of group.permissions ?? []) {
      if (perm.id) ids.add(perm.id);
    }
  }
  return [...ids];
}

function extractResourceId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  for (const key of ['id', 'entityId', 'roleId', 'userId']) {
    const val = record[key];
    if (typeof val === 'string' && val) return val;
  }
  return null;
}
