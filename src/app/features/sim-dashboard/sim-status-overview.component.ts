import { Component, input, computed } from '@angular/core';
import { BasketDetails } from '../../shared/models/sim.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface OverviewSegment {
  labelKey: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-sim-status-overview',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './sim-status-overview.component.html',
  styleUrl: './sim-status-overview.component.scss',
})
export class SimStatusOverviewComponent {
  readonly basket = input.required<BasketDetails>();

  readonly segments = computed(() => this.buildSegments(this.basket()));

  readonly donutGradient = computed(() => {
    const segs = this.segments().filter((s) => s.value > 0);
    const total = this.basket().totalSim;
    if (!total || !segs.length) {
      return 'conic-gradient(var(--color-border) 0deg 360deg)';
    }
    let angle = 0;
    const parts: string[] = [];
    for (const s of segs) {
      const sweep = (s.value / total) * 360;
      const end = angle + sweep;
      parts.push(`${s.color} ${angle}deg ${end}deg`);
      angle = end;
    }
    return `conic-gradient(${parts.join(', ')})`;
  });

  private buildSegments(b: BasketDetails): OverviewSegment[] {
    return [
      { labelKey: 'simDashboard.status.active', value: b.totalActiveSims, color: 'var(--color-success)' },
      { labelKey: 'simDashboard.status.available', value: b.totalAvailableSims, color: '#42a5f5' },
      { labelKey: 'simDashboard.status.tempDisconnected', value: b.tempDisconnected, color: '#78909c' },
      { labelKey: 'simDashboard.status.safeCustody', value: b.totalSafeCustodySims, color: '#8b5cf6' },
      { labelKey: 'simDashboard.status.inactive', value: b.totalInActiveSims, color: 'var(--color-danger)' },
      { labelKey: 'simDashboard.status.inProgress', value: b.totalInProgressSims, color: '#ff9100' },
      { labelKey: 'simDashboard.status.suspended', value: b.totalSuspendedSims, color: 'var(--color-warning)' },
    ];
  }

  barPercent(value: number, total: number): number {
    return total > 0 ? Math.min(100, (value / total) * 100) : 0;
  }

  barLabel(value: number, total: number): string {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const formatted = pct === 100 ? '0' : pct.toFixed(2);
    return `${value} (${pct === 100 ? '100' : formatted}%)`;
  }
}
