import { Component, inject, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { RbacRole, RbacPermission, PermissionGroup, PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent, tableQuerySignature, isDuplicateTableFetch, trackEntityIdChange } from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions/row-actions.component';

@Component({
  selector: 'app-roles-tab',
  standalone: true,
  imports: [FormsModule, TableModule, InputTextModule, SearchBarComponent, TranslatePipe, RowActionsComponent],
  templateUrl: './roles-tab.component.html',
})
export class RolesTabComponent {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canCreate = this.perm.can(PERMS.ROLE_CREATE);
  readonly canAssignPerms = this.perm.can(PERMS.ROLE_PERMISSIONS_MAP);

  /** Ignores out-of-order HTTP responses when filters/search/pagination change quickly. */
  private fetchGen = 0;
  /** True after the table has fired its first lazy-load (avoids duplicate init fetch). */
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  readonly roles = signal<RbacRole[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showDialog = signal(false);
  readonly saving = signal(false);
  readonly dialogError = signal('');

  readonly showPermDialog = signal(false);
  readonly permDialogRole = signal<RbacRole | null>(null);
  readonly permissionGroups = signal<PermissionGroup[]>([]);
  readonly expandedGroups = signal<Set<string>>(new Set());
  readonly selectedPermIds = signal<Set<string>>(new Set());
  readonly permLoading = signal(false);
  readonly permDialogError = signal('');

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? this.roles().length);

  name = '';
  description = '';
  entityId = '';

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;

      this.lastQuerySig = '';
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
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.rbac.getRoles(eid, q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.roles.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.errors.loadRolesList')));
      },
    });
  }

  openDialog(): void {
    this.name = this.description = '';
    this.entityId = this.auth.entityId() ?? '';
    this.dialogError.set('');
    this.showDialog.set(true);
  }

  create(): void {
    if (!this.name || !this.entityId) return;
    this.saving.set(true);
    this.dialogError.set('');
    this.rbac.createRole({ name: this.name, description: this.description, entityId: this.entityId }).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.createRole'));
        if (msg) {
          this.dialogError.set(msg);
          return;
        }
        this.showDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.saving.set(false);
        this.dialogError.set(extractApiError(err, this.i18n.instant('master.errors.createRole')));
      },
    });
  }

  rowActions(r: RbacRole): RowAction[] {
    if (!this.canAssignPerms()) return [];
    return [
      {
        label: this.i18n.instant('master.roles.editPerms'),
        icon: 'edit',
        iconColor: 'var(--color-primary)',
        onClick: () => this.openAssign(r),
      },
    ];
  }

  openAssign(role: RbacRole): void {
    this.permDialogRole.set(role);
    this.permLoading.set(true);
    this.permDialogError.set('');
    this.showPermDialog.set(true);

    this.rbac.getPermissionGroupsByEntity().subscribe({
      next: (groups) => {
        this.permissionGroups.set(groups);
        this.expandedGroups.set(new Set(groups.map((g) => g.id)));
      },
      error: (err) => {
        this.permLoading.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadPermGroups')));
      },
    });
    this.rbac.getRolePermissions(role.id).subscribe({
      next: (perms) => {
        this.selectedPermIds.set(new Set(perms.map((p) => p.id)));
        this.permLoading.set(false);
      },
      error: (err) => {
        this.permLoading.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.loadRolePerms')));
      },
    });
  }

  toggleGroup(groupId: string): void {
    const s = new Set(this.expandedGroups());
    s.has(groupId) ? s.delete(groupId) : s.add(groupId);
    this.expandedGroups.set(s);
  }

  toggleGroupAll(group: PermissionGroup): void {
    const s = new Set(this.selectedPermIds());
    const allSelected = group.permissions.every((p) => s.has(p.id));
    group.permissions.forEach((p) => allSelected ? s.delete(p.id) : s.add(p.id));
    this.selectedPermIds.set(s);
  }

  isGroupAllSelected(group: PermissionGroup): boolean {
    return group.permissions.length > 0 && group.permissions.every((p) => this.selectedPermIds().has(p.id));
  }

  isGroupPartial(group: PermissionGroup): boolean {
    const sel = this.selectedPermIds();
    const some = group.permissions.some((p) => sel.has(p.id));
    const all = group.permissions.every((p) => sel.has(p.id));
    return some && !all;
  }

  togglePerm(id: string): void {
    const s = new Set(this.selectedPermIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedPermIds.set(s);
  }

  savePermissions(): void {
    const role = this.permDialogRole();
    if (!role) return;
    this.saving.set(true);
    this.permDialogError.set('');
    this.rbac.assignRolePermissions(role.id, [...this.selectedPermIds()]).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.assignPerms'));
        if (msg) {
          this.permDialogError.set(msg);
          return;
        }
        this.showPermDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.saving.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.assignPerms')));
      },
    });
  }
}
