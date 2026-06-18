import { Component, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { SimService } from '../../core/services/sim.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import {
  BasketDetails,
  StatItem,
  statSubtitle,
} from '../../shared/models/sim.model';
import { extractApiError } from '../../core/utils/api-error.util';
import { SimStatusOverviewComponent } from './sim-status-overview.component';
import { SimSearchPanelComponent } from './sim-search-panel.component';

@Component({
  selector: 'app-sim-dashboard',
  standalone: true,
  imports: [SimStatusOverviewComponent, SimSearchPanelComponent],
  templateUrl: './sim-dashboard.component.html',
  styleUrl: './sim-dashboard.component.scss',
})
export class SimDashboardComponent {
  /** Set to false when the dashboard is ready to ship. */
  private static readonly WIP = false;

  private readonly auth = inject(AuthService);
  private readonly sim = inject(SimService);
  readonly perm = inject(PermissionService);

  readonly wip = SimDashboardComponent.WIP;
  readonly canView = this.perm.can(PERMS.SIM_DASHBOARD);

  readonly basket = signal<BasketDetails | null>(null);
  readonly loadingBasket = signal(false);
  readonly basketError = signal('');

  readonly statItems = computed(() => {
    const b = this.basket();
    if (!b) return [];
    const total = b.totalSim;
    const items: StatItem[] = [
      { label: 'Total SIMs', value: b.totalSim, icon: 'sim_card', color: 'var(--color-primary)' },
      { label: 'Active SIMs', value: b.totalActiveSims, icon: 'check_circle', color: 'var(--color-success)' },
      { label: 'Available SIMs', value: b.totalAvailableSims, icon: 'inventory_2', color: '#42a5f5' },
      { label: 'Safe Custody SIMs', value: b.totalSafeCustodySims, icon: 'shield', color: '#8b5cf6' },
      { label: 'In-Active SIMs', value: b.totalInActiveSims, icon: 'cancel', color: 'var(--color-danger)' },
      { label: 'In-Progress SIMs', value: b.totalInProgressSims, icon: 'hourglass_empty', color: '#ff9100' },
      { label: 'Suspended SIMs', value: b.totalSuspendedSims, icon: 'pause_circle', color: 'var(--color-warning)' },
      { label: 'Temporarily Disconnected', value: b.tempDisconnected, icon: 'wifi_off', color: '#78909c' },
    ];
    return items.map((item) => ({
      ...item,
      subtitle: statSubtitle(item.value, total),
    }));
  });

  constructor() {
    effect(() => {
      const _eid = this.auth.entityId();
      const _loaded = this.perm.loaded();
      if (!this.wip && _loaded && this.perm.has(PERMS.SIM_DASHBOARD)) {
        this.fetchBasket();
      }
    });
  }

  fetchBasket(): void {
    this.loadingBasket.set(true);
    this.basketError.set('');
    this.sim.fetchBasketDetails().subscribe({
      next: (data) => {
        this.loadingBasket.set(false);
        this.basket.set(data);
      },
      error: (err) => {
        this.loadingBasket.set(false);
        this.basketError.set(extractApiError(err, 'Failed to load basket details'));
      },
    });
  }
}
