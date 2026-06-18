import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { LangSwitcherComponent } from '../../shared/components/lang-switcher/lang-switcher.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, LangSwitcherComponent, TranslatePipe],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);
  readonly showEntityMenu = signal(false);
  readonly showUserMenu = signal(false);
  readonly canSwitchEntity = this.perm.can(PERMS.ENTITY_VIEW);
  readonly entitySearch = signal('');

  readonly filteredEntities = computed(() => {
    const q = this.entitySearch().toLowerCase().trim();
    const list = this.auth.entities();
    if (!q) return list;
    return list.filter(
      (e) => e.name.toLowerCase().includes(q) || e.entityType?.name?.toLowerCase().includes(q),
    );
  });

  userName = this.auth.userName;
  menuName = this.auth.menuName;

  ngOnInit(): void {
    // Profile, perms, entities now fetched via shell bootstrap
  }

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
