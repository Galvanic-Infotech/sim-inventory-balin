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
}

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
      { label: t('layout.nav.master'), icon: 'dataset', route: '/master' },
    ];
  });

  readonly navItems = computed(() =>
    this.allNavItems().filter((item) => !item.permission || this.perm.has(item.permission)),
  );

  toggle(): void {
    this.collapsed.update((v) => !v);
  }
}
