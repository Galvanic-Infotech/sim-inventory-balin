import { Component, computed, inject, model } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  anyOfPermissions?: string[];
}

const MASTER_SECTION_PERMS = [
  PERMS.MASTER,
  PERMS.USER_VIEW,
  PERMS.ROLE_VIEW,
  PERMS.PERMISSION_VIEW,
  PERMS.PERMISSION_GROUP_VIEW,
  PERMS.ENTITY_VIEW,
  PERMS.ENTITY_TYPE_VIEW,
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly perm = inject(PermissionService);
  private readonly i18n = inject(TranslationService);

  collapsed = model(false);

  readonly appName = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.i18n.instant('layout.appName');
  });

  private readonly allNavItems = computed<NavItem[]>(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (key: string) => this.i18n.instant(key);
    return [
      {
        label: t('layout.nav.dashboard'),
        icon: 'dashboard',
        route: '/dashboard',
        permission: PERMS.SIM_DASHBOARD,
      },
      {
        label: t('layout.nav.simInventory'),
        icon: 'sim_card',
        route: '/sim-inventory',
        permission: PERMS.SIM_VIEW,
      },
      {
        label: t('layout.nav.billing'),
        icon: 'receipt_long',
        route: '/billing',
        permission: PERMS.BILLING_VIEW,
      },
      {
        label: t('layout.nav.devices'),
        icon: 'memory',
        route: '/devices',
        permission: PERMS.AIS_DEVICE_VIEW,
      },
      {
        label: t('layout.nav.jobs'),
        icon: 'work_history',
        route: '/jobs',
        permission: PERMS.AIS_DEVICE_VIEW,
      },
      {
        label: t('layout.nav.fitment'),
        icon: 'build',
        route: '/fitment',
        permission: PERMS.FITMENT_VIEW,
      },
      {
        label: t('layout.nav.master'),
        icon: 'dataset',
        route: '/master',
        anyOfPermissions: MASTER_SECTION_PERMS,
      },
      {
        label: t('layout.nav.reports'),
        icon: 'assessment',
        route: '/reports',
        permission: PERMS.REPORTS_VIEW,
      },
      {
        label: t('layout.nav.onboarding'),
        icon: 'rocket_launch',
        route: '/onboarding',
        permission: PERMS.ENTITY_CREATE,
      },
    ];
  });

  readonly navItems = computed(() =>
    this.allNavItems().filter((item) => {
      if (item.anyOfPermissions?.length) return this.perm.hasAny(...item.anyOfPermissions);
      if (item.permission) return this.perm.has(item.permission);
      return true;
    }),
  );

  toggle(): void {
    this.collapsed.update((v) => !v);
  }
}
