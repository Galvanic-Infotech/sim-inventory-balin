import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  LoginRequest, LoginResponse, LoginData, TokenPayload, UserProfile,
  ForgotPasswordInitiateRequest, ForgotPasswordOtpResponse,
  ForgotPasswordVerifyRequest, ForgotPasswordResetRequest, ApiResponse,
  ChangePasswordRequest,
} from '../../shared/models/auth.model';
import { RbacResponse } from '../../shared/models/rbac.model';
import { RbacEntity, EntityProfile } from '../../shared/models/rbac.model';
import { API_ENDPOINTS, STORAGE_KEYS } from '../constants/api.constants';
import { PermissionService } from './permission.service';
import { RbacService } from './rbac.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly rbac = inject(RbacService);

  private readonly tokenSignal = signal<string | null>(this.stored(STORAGE_KEYS.AUTH_TOKEN));
  private readonly userData = signal<LoginData | null>(this.storedJson(STORAGE_KEYS.RBAC_USER));
  readonly profile = signal<UserProfile | null>(null);
  readonly entityProfile = signal<EntityProfile | null>(null);

  readonly isLoggedIn = computed(() => !!this.tokenSignal() && !this.isTokenExpired());

  readonly user = computed(() => this.userData());

  readonly decoded = computed<TokenPayload | null>(() => {
    const t = this.tokenSignal();
    if (!t) return null;
    try {
      return JSON.parse(atob(t.split('.')[1]));
    } catch {
      return null;
    }
  });

  readonly userId = computed(
    () =>
      this.decoded()?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? '',
  );

  // ── Entity Switcher ──
  private readonly jwtEntityId = computed(() => this.decoded()?.entityId ?? '');
  private readonly _selectedEntityId = signal<string | null>(null);
  readonly entities = signal<RbacEntity[]>([]);
  readonly loadingEntities = signal(false);

  /** Active entity: user-selected OR JWT default */
  readonly entityId = computed(() => this._selectedEntityId() ?? this.jwtEntityId());

  /** True when user has switched away from default entity */
  readonly isEntitySwitched = computed(() => this._selectedEntityId() !== null);

  readonly selectedEntityName = computed(() => {
    const sid = this._selectedEntityId();
    if (sid === null) return this.profile()?.entity?.name ?? 'My Entity';
    return this.entities().find((e) => e.id === sid)?.name ?? 'Entity';
  });

  readonly userName = computed(() => {
    const p = this.profile();
    if (p) return `${p.firstName} ${p.lastName}`.trim();
    const u = this.userData();
    return u ? `${u.firstName} ${u.lastName}`.trim() : 'User';
  });

  readonly menuName = computed(
    () => this.entityProfile()?.entityType?.menuName?.trim() || '',
  );

  readonly entityTypeName = computed(() => {
    const name = this.entityProfile()?.entityType?.name?.trim() || '';
    return name.split('(')[0].trim();
  });

  switchEntity(entityId: string | null): void {
    this._selectedEntityId.set(entityId);
    this.fetchProfile();
    this.fetchEntityProfile();
  }

  fetchEntities(): void {
    this.loadingEntities.set(true);
    this.rbac.getAllEntities().subscribe({
      next: (entities) => {
        this.entities.set(entities);
        this.loadingEntities.set(false);
      },
      error: () => this.loadingEntities.set(false),
    });
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(API_ENDPOINTS.RBAC.LOGIN, payload)
      .pipe(
        tap((res) => {
          if (res.success && res.data?.token) {
            this.tokenSignal.set(res.data.token);
            this.userData.set(res.data);
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.data.token);
            localStorage.setItem(STORAGE_KEYS.RBAC_USER, JSON.stringify(res.data));
            // Fetch profile, permissions + entities after login
            this.fetchProfile();
            this.fetchEntityProfile();
            this.perms.fetch();
            this.fetchEntities();
          }
        }),
      );
  }

  // ── Forgot Password ──
  forgotPasswordInitiate(payload: ForgotPasswordInitiateRequest): Observable<ForgotPasswordOtpResponse> {
    return this.http.post<ForgotPasswordOtpResponse>(API_ENDPOINTS.RBAC.FORGOT_PASSWORD_INITIATE, payload);
  }

  forgotPasswordResendOtp(requestId: string): Observable<ForgotPasswordOtpResponse> {
    return this.http.post<ForgotPasswordOtpResponse>(API_ENDPOINTS.RBAC.FORGOT_PASSWORD_RESEND_OTP, { requestId });
  }

  forgotPasswordVerifyOtp(payload: ForgotPasswordVerifyRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(API_ENDPOINTS.RBAC.FORGOT_PASSWORD_VERIFY_OTP, payload);
  }

  forgotPasswordReset(payload: ForgotPasswordResetRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(API_ENDPOINTS.RBAC.FORGOT_PASSWORD_RESET, payload);
  }

  changePassword(payload: ChangePasswordRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(API_ENDPOINTS.RBAC.CHANGE_PASSWORD, payload);
  }

  fetchProfile(): void {
    this.http.get<RbacResponse<UserProfile>>(API_ENDPOINTS.RBAC.PROFILE).subscribe({
      next: (res) => {
        if (res.data) this.profile.set(res.data);
      },
    });
  }

  fetchEntityProfile(): void {
    this.rbac.getEntityProfile().subscribe({
      next: (res) => {
        if (res.data) this.entityProfile.set(res.data);
      },
    });
  }

  /** Bootstrap — call on app init when token exists */
  bootstrap(): void {
    if (!this.isLoggedIn()) return;
    this.fetchProfile();
    this.fetchEntityProfile();
    this.perms.fetch();
    this.fetchEntities();
  }

  logout(options?: { navigate?: boolean }): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.RBAC_USER);
    this.tokenSignal.set(null);
    this.userData.set(null);
    this.profile.set(null);
    this.entityProfile.set(null);
    this._selectedEntityId.set(null);
    this.entities.set([]);
    this.perms.clear();
    if (options?.navigate !== false) {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private isTokenExpired(): boolean {
    const d = this.decoded();
    return !d || d.exp * 1000 < Date.now();
  }

  private stored(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private storedJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
