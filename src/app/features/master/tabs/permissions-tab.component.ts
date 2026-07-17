import { Component, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { RbacService } from '../../../core/services/rbac.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { PermissionGroup } from '../../../shared/models/rbac.model';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-permissions-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SearchBarComponent],
  templateUrl: './permissions-tab.component.html',
  styleUrl: './permissions-tab.component.scss',
})
export class PermissionsTabComponent {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canCreate = this.perm.can(PERMS.PERMISSION_CREATE);
  readonly canCreateGroup = this.perm.can(PERMS.PERMISSION_GROUP_CREATE);

  readonly groups = signal<PermissionGroup[]>([]);
  readonly expandedGroups = signal<Set<string>>(new Set());
  readonly searchTerm = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly permDialogError = signal('');
  readonly groupDialogError = signal('');

  readonly showPermDialog = signal(false);
  permGroupId = '';
  permName = '';
  permDescription = '';

  readonly showGroupDialog = signal(false);
  groupName = '';
  groupDescription = '';

  readonly filteredGroups = computed(() => {
    const q = this.searchTerm().toLowerCase().trim();
    if (!q) return this.groups();

    return this.groups()
      .map((g) => {
        const groupMatch =
          g.name.toLowerCase().includes(q) ||
          (g.description ?? '').toLowerCase().includes(q);
        const matchingPerms = g.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description ?? '').toLowerCase().includes(q),
        );
        if (groupMatch) return g;
        if (matchingPerms.length) return { ...g, permissions: matchingPerms };
        return null;
      })
      .filter((g): g is PermissionGroup => g !== null);
  });

  readonly totalPermCount = computed(() =>
    this.filteredGroups().reduce((sum, g) => sum + g.permissions.length, 0),
  );

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.searchTerm.set('');
      this.fetch();
    });
  }

  fetch(): void {
    this.loading.set(true);
    this.error.set('');
    this.rbac.getPermissionGroupsByRole().subscribe({
      next: (groups) => {
        this.loading.set(false);
        this.groups.set(groups);
        this.expandedGroups.set(new Set(groups.map((g) => g.id)));
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('master.errors.loadPermissions')));
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    if (value.trim()) {
      this.expandedGroups.set(new Set(this.filteredGroups().map((g) => g.id)));
    }
  }

  isGroupExpanded(groupId: string): boolean {
    if (this.searchTerm().trim()) return true;
    return this.expandedGroups().has(groupId);
  }

  toggleGroup(groupId: string): void {
    if (this.searchTerm().trim()) return;
    const s = new Set(this.expandedGroups());
    s.has(groupId) ? s.delete(groupId) : s.add(groupId);
    this.expandedGroups.set(s);
  }

  openPermDialog(): void {
    this.permGroupId = '';
    this.permName = '';
    this.permDescription = '';
    this.permDialogError.set('');
    this.showPermDialog.set(true);
  }

  createPermission(): void {
    if (!this.permName || !this.permGroupId) return;
    this.saving.set(true);
    this.permDialogError.set('');
    this.rbac.createPermission({ groupId: this.permGroupId, name: this.permName, description: this.permDescription }).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.createPermission'));
        if (msg) {
          this.permDialogError.set(msg);
          return;
        }
        this.showPermDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.saving.set(false);
        this.permDialogError.set(extractApiError(err, this.i18n.instant('master.errors.createPermission')));
      },
    });
  }

  openGroupDialog(): void {
    this.groupName = '';
    this.groupDescription = '';
    this.groupDialogError.set('');
    this.showGroupDialog.set(true);
  }

  createGroup(): void {
    if (!this.groupName) return;
    this.saving.set(true);
    this.groupDialogError.set('');
    this.rbac.createPermissionGroup({ name: this.groupName, description: this.groupDescription }).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('master.errors.createPermGroup'));
        if (msg) {
          this.groupDialogError.set(msg);
          return;
        }
        this.showGroupDialog.set(false);
        this.fetch();
      },
      error: (err) => {
        this.saving.set(false);
        this.groupDialogError.set(extractApiError(err, this.i18n.instant('master.errors.createPermGroup')));
      },
    });
  }
}
