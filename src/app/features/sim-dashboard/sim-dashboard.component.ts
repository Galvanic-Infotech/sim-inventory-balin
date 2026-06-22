import { Component, inject, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SimService } from '../../core/services/sim.service';
import { PermissionService, PERMS } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { BasketDetails } from '../../shared/models/sim.model';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SimStatusOverviewComponent } from './sim-status-overview.component';
import { SimSearchPanelComponent } from './sim-search-panel.component';

interface Kpi {
  labelKey: string;
  value: number;
  subtitle: string;
  icon: string;
  color: string;
  tint: string;
  spark: string;
}

@Component({
  selector: 'app-sim-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe, SimStatusOverviewComponent, SimSearchPanelComponent],
  templateUrl: './sim-dashboard.component.html',
  styleUrl: './sim-dashboard.component.scss',
})
export class SimDashboardComponent {
  private static readonly WIP = false;

  private readonly auth = inject(AuthService);
  private readonly sim = inject(SimService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);

  readonly wip = SimDashboardComponent.WIP;
  readonly canView = this.perm.can(PERMS.SIM_DASHBOARD);

  readonly basket = signal<BasketDetails | null>(null);
  readonly loadingBasket = signal(false);
  readonly basketError = signal('');

  readonly healthyPercent = computed(() => this.pct(this.healthyCount(), this.totalSim()));
  readonly utilisation = computed(() => this.pct(this.basket()?.totalActiveSims ?? 0, this.totalSim()));
  readonly aboutExpired = computed(() => 0);

  readonly kpis = computed<Kpi[]>(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (key: string, params?: Record<string, string | number>) =>
      this.i18n.translate(key, params);

    const b = this.basket();
    if (!b) {
      const empty = (labelKey: string, icon: string, color: string, tint: string): Kpi => ({
        labelKey,
        value: 0,
        subtitle: '—',
        icon,
        color,
        tint,
        spark: this.flatSpark(),
      });
      return [
        empty('simDashboard.kpi.active', 'bolt', 'var(--color-success)', 'var(--color-success-bg)'),
        empty('simDashboard.kpi.available', 'inventory_2', 'var(--color-primary)', 'var(--color-primary-soft)'),
        empty('simDashboard.kpi.inProgress', 'sync', '#8b5cf6', 'rgba(139, 92, 246, 0.12)'),
        empty('simDashboard.kpi.expired', 'event_busy', 'var(--color-danger)', 'var(--color-danger-bg)'),
      ];
    }
    const total = this.totalSim();
    const kpi = (
      labelKey: string,
      value: number,
      icon: string,
      color: string,
      tint: string,
      seed: number,
    ): Kpi => ({
      labelKey,
      value,
      subtitle:
        total > 0
          ? t('simDashboard.kpi.ofFleet', { percent: this.pct(value, total) })
          : '—',
      icon,
      color,
      tint,
      spark: this.spark(seed, value),
    });
    return [
      kpi('simDashboard.kpi.active', b.totalActiveSims, 'bolt', 'var(--color-success)', 'var(--color-success-bg)', 1),
      kpi('simDashboard.kpi.available', b.totalAvailableSims, 'inventory_2', 'var(--color-primary)', 'var(--color-primary-soft)', 2),
      kpi('simDashboard.kpi.inProgress', b.totalInProgressSims, 'sync', '#8b5cf6', 'rgba(139, 92, 246, 0.12)', 3),
      kpi('simDashboard.kpi.expired', b.totalInActiveSims, 'event_busy', 'var(--color-danger)', 'var(--color-danger-bg)', 4),
    ];
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
        this.basketError.set(
          extractApiError(err, this.i18n.translate('simDashboard.errors.loadBasket')),
        );
      },
    });
  }

  private totalSim(): number {
    return this.basket()?.totalSim ?? 0;
  }

  private healthyCount(): number {
    const b = this.basket();
    if (!b) return 0;
    return b.totalActiveSims + b.totalAvailableSims;
  }

  private pct(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  /** Tiny deterministic sparkline so each KPI looks alive without real history. */
  private spark(seed: number, value: number): string {
    const points = 8;
    const amp = 8;
    const base = 12;
    const out: string[] = [];
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * 64;
      const wobble = Math.sin((i + seed) * 1.2) * amp * 0.6;
      const trend = ((value % 9) - 4) * 0.4 * (i / points);
      const y = base - wobble + trend;
      out.push(`${x.toFixed(1)},${Math.max(2, Math.min(22, y)).toFixed(1)}`);
    }
    return out.join(' ');
  }

  private flatSpark(): string {
    return '0,12 64,12';
  }
}
