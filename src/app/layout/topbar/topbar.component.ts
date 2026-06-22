import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { LangSwitcherComponent } from '../../shared/components/lang-switcher/lang-switcher.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

const PAGE_META: Record<string, { icon: string; titleKey: string }> = {
  dashboard: { icon: 'dashboard', titleKey: 'layout.nav.dashboard' },
  'sim-inventory': { icon: 'sim_card', titleKey: 'layout.nav.simInventory' },
  billing: { icon: 'receipt_long', titleKey: 'layout.nav.billing' },
  devices: { icon: 'memory', titleKey: 'layout.nav.devices' },
  fitment: { icon: 'build', titleKey: 'layout.nav.fitment' },
  master: { icon: 'dataset', titleKey: 'layout.nav.master' },
  onboarding: { icon: 'rocket_launch', titleKey: 'layout.nav.onboarding' },
  profile: { icon: 'manage_accounts', titleKey: 'layout.profilePassword' },
};

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, LangSwitcherComponent, TranslatePipe],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);
  readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);
  readonly showEntityMenu = signal(false);
  readonly showUserMenu = signal(false);
  readonly canSwitchEntity = this.perm.can(PERMS.ENTITY_VIEW);
  readonly entitySearch = signal('');

  private readonly navUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly currentSegment = computed(() => {
    const segment = this.navUrl().split('?')[0].split('/').filter(Boolean)[0];
    return segment || 'dashboard';
  });

  readonly pageMeta = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const meta = PAGE_META[this.currentSegment()] ?? PAGE_META['dashboard'];
    return {
      icon: meta.icon,
      title: this.i18n.instant(meta.titleKey),
    };
  });

  readonly greeting = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const hour = new Date().getHours();
    const name = this.auth.userName();
    if (hour < 12) return this.i18n.instant('layout.greetingMorning', { name });
    if (hour < 17) return this.i18n.instant('layout.greetingAfternoon', { name });
    return this.i18n.instant('layout.greetingEvening', { name });
  });

  readonly userInitials = computed(() => {
    const name = (this.auth.userName() || '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  readonly filteredEntities = computed(() => {
    const q = this.entitySearch().toLowerCase().trim();
    const list = this.auth.entities();
    if (!q) return list;
    return list.filter(
      (e) => e.name.toLowerCase().includes(q) || e.entityType?.name?.toLowerCase().includes(q),
    );
  });

  userName = this.auth.userName;

  toggleEntityMenu(): void {
    const opening = !this.showEntityMenu();
    this.showEntityMenu.set(opening);
    if (opening) {
      this.auth.fetchEntities();
    } else {
      this.entitySearch.set('');
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu.update((v) => !v);
    if (this.showUserMenu()) this.showEntityMenu.set(false);
  }

  selectEntity(id: string | null): void {
    this.auth.switchEntity(id);
    this.showEntityMenu.set(false);
  }

  goToProfile(): void {
    this.showUserMenu.set(false);
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.showUserMenu.set(false);
    this.auth.logout();
  }

  entityIcon(type?: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('oem')) return 'factory';
    if (t.includes('vendor') || t.includes('manufact')) return 'precision_manufacturing';
    if (t.includes('admin')) return 'admin_panel_settings';
    if (t.includes('dealer')) return 'storefront';
    if (t.includes('transport') || t.includes('fleet')) return 'local_shipping';
    return 'apartment';
  }
}
