import { Component, inject, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { isStrongPassword } from '../../../core/utils/password-strength.util';
import { RbacUser, RbacRole, PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent } from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { PasswordStrengthFieldComponent } from '../../../shared/components/password-strength-field/password-strength-field.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-users-tab',
  standalone: true,
  imports: [FormsModule, TableModule, InputTextModule, SearchBarComponent, PasswordStrengthFieldComponent, TranslatePipe],
  templateUrl: './users-tab.component.html',
})
export class UsersTabComponent {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canCreate = this.perm.can(PERMS.USER_CREATE);
  readonly canUpdate = this.perm.can(PERMS.USER_UPDATE);
  readonly canAssignRole = this.perm.canAny(PERMS.ROLE_PERMISSIONS_MAP, PERMS.USER_UPDATE);
  readonly canBlock = this.perm.can(PERMS.USER_CREATE);
  readonly hasActions = computed(() => this.canAssignRole() || this.canBlock());
  readonly togglingId = signal<string | null>(null);
  readonly confirmUser = signal<RbacUser | null>(null);
  readonly toggleError = signal('');

  /** Ignores out-of-order HTTP responses when filters/search/pagination change quickly. */
  private fetchGen = 0;
  /** True after the table has fired its first lazy-load (avoids duplicate init fetch). */
  private tableReady = false;

  readonly users = signal<RbacUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDialog = signal(false);
  readonly saving = signal(false);
  readonly dialogError = signal('');

  readonly showRoleDialog = signal(false);
  readonly savingRole = signal(false);
  readonly roleDialogError = signal('');
  readonly roleDialogUser = signal<RbacUser | null>(null);
  readonly roleDialogRoles = signal<RbacRole[]>([]);
  newRoleId = '';

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly roles = signal<RbacRole[]>([]);
  firstName = '';
  lastName = '';
  email = '';
  mobile = '';
  password = signal('');
  selectedEntityId = '';
  selectedRoleId = '';

  readonly emailStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  readonly mobileStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  private emailTimer?: ReturnType<typeof setTimeout>;
  private mobileTimer?: ReturnType<typeof setTimeout>;
  private emailGen = 0;
  private mobileGen = 0;
  private readonly DEBOUNCE_MS = 400;
  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly MOBILE_RE = /^[6-9]\d{9}$/;

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.searchTerm.set('');
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      if (this.tableReady) {
        this.fetch({ pageNumber: 1, pageSize: 10 });
      }
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, { searchTerm: this.searchTerm() });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetch({ ...this.tableQuery(), searchTerm: value });
  }

  fetch(query?: TableQueryParams): void {
    const eid = this.auth.entityId();
    if (!eid) return;
    const q = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.rbac.getUsers(eid, q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.users.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.errors.loadUsers')));
      },
    });
  }

  onEntityChange(entityId: string): void {
    this.selectedEntityId = entityId;
    this.selectedRoleId = '';
    if (entityId) {
      this.rbac.getRoles(entityId).subscribe({
        next: (res) => this.roles.set(res.data ?? []),
        error: (err) => this.dialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadRoles'))),
      });
    } else {
      this.roles.set([]);
    }
  }

  openDialog(): void {
    this.resetForm();
    this.dialogError.set('');
    const eid = this.auth.entityId();
    if (eid) {
      this.onEntityChange(eid);
    }
    this.showDialog.set(true);
  }

  onEmailChange(value: string): void {
    this.email = value;
    clearTimeout(this.emailTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.emailStatus.set('idle');
      return;
    }
    if (!this.EMAIL_RE.test(trimmed)) {
      this.emailStatus.set('invalid');
      return;
    }
    this.emailStatus.set('checking');
    this.emailTimer = setTimeout(() => {
      const gen = ++this.emailGen;
      this.rbac.checkEmailExists(trimmed).subscribe({
        next: (res) => {
          if (gen !== this.emailGen) return;
          this.emailStatus.set(res.data?.exists ? 'taken' : 'available');
        },
        error: () => {
          if (gen !== this.emailGen) return;
          this.emailStatus.set('idle');
        },
      });
    }, this.DEBOUNCE_MS);
  }

  onMobileChange(value: string): void {
    this.mobile = value;
    clearTimeout(this.mobileTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.mobileStatus.set('idle');
      return;
    }
    if (!this.MOBILE_RE.test(trimmed)) {
      this.mobileStatus.set('invalid');
      return;
    }
    this.mobileStatus.set('checking');
    this.mobileTimer = setTimeout(() => {
      const gen = ++this.mobileGen;
      this.rbac.checkMobileExists(trimmed).subscribe({
        next: (res) => {
          if (gen !== this.mobileGen) return;
          this.mobileStatus.set(res.data?.exists ? 'taken' : 'available');
        },
        error: () => {
          if (gen !== this.mobileGen) return;
          this.mobileStatus.set('idle');
        },
      });
    }, this.DEBOUNCE_MS);
  }

  readonly canSubmit = computed(
    () =>
      this.emailStatus() === 'available' &&
      this.mobileStatus() === 'available' &&
      !this.saving(),
  );

  create(): void {
    const pwd = this.password();
    if (!this.firstName || !this.email || !this.mobile || !pwd || !this.selectedRoleId || !this.selectedEntityId) return;
    if (this.emailStatus() !== 'available') {
      this.dialogError.set(this.i18n.instant('master.errors.emailUnavailable'));
      return;
    }
    if (this.mobileStatus() !== 'available') {
      this.dialogError.set(this.i18n.instant('master.errors.mobileUnavailable'));
      return;
    }
    if (!isStrongPassword(pwd)) {
      this.dialogError.set(this.i18n.instant('master.errors.passwordWeak'));
      return;
    }
    this.saving.set(true);
    this.dialogError.set('');
    this.rbac
      .createUser({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        mobileNumber: this.mobile,
        password: pwd,
        roleId: this.selectedRoleId,
        entityId: this.selectedEntityId,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          const msg = getApiResponseError(res, this.i18n.instant('master.errors.createUser'));
          if (msg) {
            this.dialogError.set(msg);
            return;
          }
          this.showDialog.set(false);
          this.fetch();
        },
        error: (err) => {
          this.saving.set(false);
          this.dialogError.set(extractApiError(err, this.i18n.instant('master.errors.createUser')));
        },
      });
  }

  openRoleDialog(user: RbacUser): void {
    this.roleDialogUser.set(user);
    this.newRoleId = user.role?.id ?? '';
    this.roleDialogRoles.set([]);
    this.roleDialogError.set('');
    this.showRoleDialog.set(true);

    const entityId = user.entity?.id ?? this.auth.entityId();
    if (entityId) {
      this.rbac.getRoles(entityId).subscribe({
        next: (res) => this.roleDialogRoles.set(res.data ?? []),
        error: (err) => this.roleDialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadRoles'))),
      });
    }
  }

  changeRole(): void {
    const user = this.roleDialogUser();
    if (!user || !this.newRoleId || this.newRoleId === user.role?.id) return;
    this.savingRole.set(true);
    this.roleDialogError.set('');
    this.rbac.updateUserRole(user.id, this.newRoleId).subscribe({
      next: (res) => {
        this.savingRole.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.updateRole'));
        if (msg) {
          this.roleDialogError.set(msg);
          return;
        }
        this.showRoleDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.savingRole.set(false);
        this.roleDialogError.set(extractApiError(err, this.i18n.instant('master.errors.updateRole')));
      },
    });
  }

  openToggleConfirm(user: RbacUser): void {
    if (this.togglingId()) return;
    this.toggleError.set('');
    this.confirmUser.set(user);
  }

  closeToggleConfirm(): void {
    if (this.togglingId()) return;
    this.confirmUser.set(null);
    this.toggleError.set('');
  }

  confirmToggle(): void {
    const user = this.confirmUser();
    if (!user || this.togglingId()) return;
    const nextEnabled = !user.isActive;
    this.togglingId.set(user.id);
    this.toggleError.set('');
    this.rbac.setUserEnabled(user.id, nextEnabled).subscribe({
      next: (res) => {
        this.togglingId.set(null);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.toggleUser'));
        if (msg) {
          this.toggleError.set(msg);
          return;
        }
        this.users.update((list) =>
          list.map((u) => (u.id === user.id ? { ...u, isActive: nextEnabled } : u)),
        );
        this.confirmUser.set(null);
      },
      error: (err) => {
        this.togglingId.set(null);
        this.toggleError.set(extractApiError(err, this.i18n.instant('master.errors.toggleUser')));
      },
    });
  }

  private resetForm(): void {
    this.firstName = this.lastName = this.email = this.mobile = '';
    this.password.set('');
    this.selectedEntityId = this.selectedRoleId = '';
    this.roles.set([]);
    this.emailStatus.set('idle');
    this.mobileStatus.set('idle');
    clearTimeout(this.emailTimer);
    clearTimeout(this.mobileTimer);
    this.emailGen++;
    this.mobileGen++;
  }
}
