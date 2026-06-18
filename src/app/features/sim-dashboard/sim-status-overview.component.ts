import { Component, input, computed } from '@angular/core';
import { BasketDetails, ChartSegment } from '../../shared/models/sim.model';

@Component({
  selector: 'app-sim-status-overview',
  standalone: true,
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

  private buildSegments(b: BasketDetails): ChartSegment[] {
    return [
      { label: 'Active', value: b.totalActiveSims, color: 'var(--color-success)' },
      { label: 'Available', value: b.totalAvailableSims, color: '#42a5f5' },
      { label: 'Temp Disconnected', value: b.tempDisconnected, color: '#78909c' },
      { label: 'Safe Custody', value: b.totalSafeCustodySims, color: '#8b5cf6' },
      { label: 'In-Active', value: b.totalInActiveSims, color: 'var(--color-danger)' },
      { label: 'In-Progress', value: b.totalInProgressSims, color: '#ff9100' },
      { label: 'Suspended', value: b.totalSuspendedSims, color: 'var(--color-warning)' },
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
