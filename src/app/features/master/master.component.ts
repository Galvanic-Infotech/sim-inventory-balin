import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { translateEntityTypeName } from '../../core/utils/entity-type-i18n.util';
import { UsersTabComponent } from './tabs/users-tab.component';
import { EntitiesTabComponent } from './tabs/entities-tab.component';
import { RolesTabComponent } from './tabs/roles-tab.component';
import { PermissionsTabComponent } from './tabs/permissions-tab.component';
import { MasterDataTabComponent } from './tabs/master-data-tab.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface Tab {
  labelKey: string;
  icon: string;
  key: string;
  permission: string;
  dynamicLabel?: boolean;
}

@Component({
  selector: 'app-master',
  standalone: true,
  imports: [
    UsersTabComponent,
    EntitiesTabComponent,
    RolesTabComponent,
    PermissionsTabComponent,
    MasterDataTabComponent,
    TranslatePipe,
  ],
  templateUrl: './master.component.html',
  styleUrl: './master.component.scss',
})
export class MasterComponent {
  readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);
  private readonly i18n = inject(TranslationService);

  readonly activeTabKey = signal('');

  private readonly tabDefs: Tab[] = [
    { labelKey: 'master.tabs.users', icon: 'people', key: 'users', permission: PERMS.USER_VIEW },
    {
      labelKey: 'layout.entityTypes.oem',
      icon: 'business',
      key: 'entities',
      permission: PERMS.ENTITY_VIEW,
      dynamicLabel: true,
    },
    { labelKey: 'master.tabs.roles', icon: 'shield', key: 'roles', permission: PERMS.ROLE_VIEW },
    { labelKey: 'master.tabs.permissions', icon: 'lock', key: 'permissions', permission: PERMS.PERMISSION_VIEW },
    { labelKey: 'master.tabs.masterData', icon: 'dataset', key: 'master-data', permission: PERMS.MASTER },
  ];

  readonly allTabs = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (key: string) => this.i18n.instant(key);
    return this.tabDefs.map((tab) => {
      let label = t(tab.labelKey);
      if (tab.dynamicLabel) {
        label = translateEntityTypeName(this.auth.menuName(), t) || t('layout.entityTypes.oem');
      }
      return { ...tab, label };
    });
  });

  readonly visibleTabs = computed(() =>
    this.allTabs().filter((t) => this.perm.has(t.permission)),
  );

  readonly currentTab = computed(() => {
    const visible = this.visibleTabs();
    const active = this.activeTabKey();
    if (visible.some((t) => t.key === active)) return active;
    return visible.length ? visible[0].key : '';
  });

  selectTab(key: string): void {
    this.activeTabKey.set(key);
  }
}
