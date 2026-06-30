import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  FitmentDetailGroup,
  FitmentDetailRow,
  FitmentReport,
} from '../../../shared/models/reports.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { trackEntityIdChange } from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';

interface FitmentFlatRow {
  entityName: string;
  entityType: string;
  fitment: FitmentDetailRow;
}

interface EntityChip {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface TrendCoord {
  x: number;
  y: number;
  count: number;
  date: string;
}

interface TrendGeometry {
  width: number;
  height: number;
  coords: TrendCoord[];
  linePath: string;
  areaPath: string;
}

const ENTITY_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

function colorForIndex(i: number): string {
  return ENTITY_COLORS[i % ENTITY_COLORS.length];
}

function toIsoStart(date: string): string {
  return `${date}T00:00:00Z`;
}

function toIsoEnd(date: string): string {
  return `${date}T23:59:00Z`;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function firstOfMonthIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}

@Component({
  selector: 'app-fitment-tab',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, TranslatePipe, SearchBarComponent],
  templateUrl: './fitment-tab.component.html',
  styleUrl: './fitment-tab.component.scss',
})
export class FitmentTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(AuthService);

  readonly fromDate = signal(firstOfMonthIso());
  readonly toDate = signal(todayIso());
  readonly maxDate = todayIso();

  readonly summary = signal<FitmentReport | null>(null);
  readonly groups = signal<FitmentDetailGroup[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(10);
  readonly tableFirst = signal(0);

  readonly loadingSummary = signal(false);
  readonly loadingDetail = signal(false);
  readonly error = signal('');

  readonly entityFilter = signal<string>('');
  readonly searchTerm = signal('');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);
  readonly totalFitments = computed(() => this.summary()?.totalFitments ?? 0);

  readonly entityChips = computed<EntityChip[]>(() => {
    return this.groups().map((g, i) => ({
      key: g.entityName,
      label: g.entityName,
      count: g.totalFitments,
      color: colorForIndex(i),
    }));
  });

  readonly allRows = computed<FitmentFlatRow[]>(() => {
    const out: FitmentFlatRow[] = [];
    for (const g of this.groups()) {
      for (const f of g.fitments ?? []) {
        out.push({ entityName: g.entityName, entityType: g.entityType, fitment: f });
      }
    }
    return out;
  });

  readonly rows = computed<FitmentFlatRow[]>(() => {
    const ef = this.entityFilter();
    const term = this.searchTerm().trim().toLowerCase();
    return this.allRows().filter((r) => {
      if (ef && r.entityName !== ef) return false;
      if (!term) return true;
      const f = r.fitment;
      return (
        f.fitmentNo?.toLowerCase().includes(term) ||
        f.serialNumber?.toLowerCase().includes(term) ||
        f.vehicleRegistrationNo?.toLowerCase().includes(term) ||
        f.vehicleMake?.toLowerCase().includes(term) ||
        f.vehicleModel?.toLowerCase().includes(term) ||
        f.customerName?.toLowerCase().includes(term) ||
        f.mobileNo?.toLowerCase().includes(term) ||
        r.entityName?.toLowerCase().includes(term)
      );
    });
  });

  readonly trendGeometry = computed<TrendGeometry | null>(() => {
    const points = this.summary()?.days ?? [];
    if (points.length === 0) return null;
    const width = 320;
    const height = 56;
    const max = points.reduce((m, p) => Math.max(m, p.totalFitments ?? 0), 0);
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;
    const coords = points.map((p, i) => {
      const x = points.length === 1 ? width / 2 : i * stepX;
      const y = max === 0 ? height : height - ((p.totalFitments ?? 0) / max) * height;
      return { x, y, count: p.totalFitments ?? 0, date: p.date };
    });
    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
      .join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    return { width, height, coords, linePath, areaPath };
  });

  readonly trendHover = signal<{ x: number; y: number; date: string; count: number } | null>(null);

  onTrendMove(event: MouseEvent): void {
    const geo = this.trendGeometry();
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
    this.trendHover.set({ x: pxX, y: pxY, date: nearest.date, count: nearest.count });
  }

  onTrendLeave(): void {
    this.trendHover.set(null);
  }

  selectEntity(key: string): void {
    this.entityFilter.set(key);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  private fetchGen = 0;
  private prevEntityId: string | undefined;

  constructor() {
    this.fetchAll();
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;
      this.entityFilter.set('');
      this.searchTerm.set('');
      this.pageNumber.set(1);
      this.tableFirst.set(0);
      this.fetchAll();
    });
  }

  apply(): void {
    this.entityFilter.set('');
    this.pageNumber.set(1);
    this.tableFirst.set(0);
    this.fetchAll();
  }

  refresh(): void {
    this.fetchAll();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.pageSize();
    const first = event.first ?? 0;
    const page = Math.floor(first / size) + 1;
    this.pageSize.set(size);
    this.pageNumber.set(page);
    this.tableFirst.set(first);
    this.fetchDetail();
  }

  statusChipColor(status: string): string {
    switch ((status ?? '').toLowerCase()) {
      case 'completed':
        return 'var(--color-success)';
      case 'pending':
      case 'inprogress':
      case 'in_progress':
        return 'var(--color-warning)';
      case 'failed':
      case 'rejected':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-muted)';
    }
  }

  private validateRange(): boolean {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from || !to || from > to) {
      this.error.set(this.i18n.instant('reports.fitment.errors.invalidRange'));
      return false;
    }
    this.error.set('');
    return true;
  }

  private fetchAll(): void {
    if (!this.validateRange()) return;
    this.fetchSummary();
    this.fetchDetail();
  }

  private fetchSummary(): void {
    const from = toIsoStart(this.fromDate());
    const to = toIsoEnd(this.toDate());
    this.loadingSummary.set(true);
    this.reports.getFitments(from, to).subscribe({
      next: (res) => {
        this.loadingSummary.set(false);
        this.summary.set(res.data ?? null);
      },
      error: () => {
        this.loadingSummary.set(false);
        this.summary.set(null);
      },
    });
  }

  private fetchDetail(): void {
    if (!this.validateRange()) return;
    const from = toIsoStart(this.fromDate());
    const to = toIsoEnd(this.toDate());
    const gen = ++this.fetchGen;
    this.loadingDetail.set(true);
    this.reports.getFitmentsDetailed(from, to, this.pageNumber(), this.pageSize()).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loadingDetail.set(false);
        this.groups.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loadingDetail.set(false);
        this.groups.set([]);
        this.pagination.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('reports.fitment.errors.load')));
      },
    });
  }

  onFromChange(value: string): void {
    this.fromDate.set(value);
  }

  onToChange(value: string): void {
    this.toDate.set(value);
  }
}
