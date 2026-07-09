import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DurationBucket } from '../../models/reports.model';

interface Coord {
  x: number;
  y: number;
  months: number;
  count: number;
}

interface Geometry {
  width: number;
  height: number;
  coords: Coord[];
  linePath: string;
  areaPath: string;
}

interface HoverPoint {
  x: number;
  y: number;
  months: number;
  count: number;
}

@Component({
  selector: 'app-duration-chart',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './duration-chart.component.html',
  styleUrl: './duration-chart.component.scss',
})
export class DurationChartComponent {
  readonly buckets = input<DurationBucket[]>([]);
  readonly total = input<number>(0);
  readonly titleKey = input<string>('reports.duration.chartTitle');
  readonly totalLabelKey = input<string>('reports.duration.totalDevices');
  readonly subKey = input<string>('reports.duration.chartSub');

  readonly hover = signal<HoverPoint | null>(null);

  readonly sortedBuckets = computed<DurationBucket[]>(() =>
    [...this.buckets()].sort((a, b) => a.durationMonths - b.durationMonths),
  );

  readonly geometry = computed<Geometry | null>(() => {
    const buckets = this.sortedBuckets();
    if (buckets.length === 0) return null;

    const width = 320;
    const height = 56;
    const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
    const stepX = buckets.length > 1 ? width / (buckets.length - 1) : 0;

    const coords: Coord[] = buckets.map((b, i) => {
      const x = buckets.length === 1 ? width / 2 : i * stepX;
      const y = max === 0 ? height : height - (b.count / max) * height;
      return { x, y, months: b.durationMonths, count: b.count };
    });

    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
      .join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

    return { width, height, coords, linePath, areaPath };
  });

  onMove(event: MouseEvent): void {
    const geo = this.geometry();
    if (!geo) return;
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const xViewBox = ratio * geo.width;
    let nearest = geo.coords[0];
    let bestDist = Math.abs(nearest.x - xViewBox);
    for (const c of geo.coords) {
      const d = Math.abs(c.x - xViewBox);
      if (d < bestDist) {
        bestDist = d;
        nearest = c;
      }
    }
    const pxX = (nearest.x / geo.width) * rect.width;
    const pxY = (nearest.y / geo.height) * rect.height;
    this.hover.set({ x: pxX, y: pxY, months: nearest.months, count: nearest.count });
  }

  onLeave(): void {
    this.hover.set(null);
  }
}
