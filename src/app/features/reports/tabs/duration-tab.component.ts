import { Component, computed, effect, inject, signal } from '@angular/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AisDurationCountRow, DurationBucket } from '../../../shared/models/reports.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import {
  tableQueryFromLazyEvent,
  tableQuerySignature,
  isDuplicateTableFetch,
  trackEntityIdChange,
} from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { DurationChartComponent } from '../../../shared/components/duration-chart/duration-chart.component';
import { downloadExcel } from '../../../shared/utils/excel-export.util';
import { fetchAllPagedRows } from '../../../shared/utils/paged-export.util';

const DURATION_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

interface DurationTotal {
  durationMonths: number;
  count: number;
  color: string;
}

@Component({
  selector: 'app-duration-tab',
  standalone: true,
  imports: [TableModule, TranslatePipe, SearchBarComponent, DurationChartComponent],
  templateUrl: './duration-tab.component.html',
  styleUrl: './duration-tab.component.scss',
})
export class DurationTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(AuthService);

  readonly rows = signal<AisDurationCountRow[]>([]);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly grandTotalDevices = computed(() =>
    this.rows().reduce((sum, r) => sum + (r.totalDevices ?? 0), 0),
  );

  readonly durationTotals = computed<DurationTotal[]>(() => {
    const acc = new Map<number, number>();
    for (const r of this.rows()) {
      for (const d of r.durationCounts ?? []) {
        acc.set(d.durationMonths, (acc.get(d.durationMonths) ?? 0) + d.count);
      }
    }
    const sorted = Array.from(acc.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([months, count], i) => ({
      durationMonths: months,
      count,
      color: DURATION_COLORS[i % DURATION_COLORS.length],
    }));
  });

  readonly durationBuckets = computed<DurationBucket[]>(() =>
    this.durationTotals().map((t) => ({ durationMonths: t.durationMonths, count: t.count })),
  );

  private colorMap = computed<Map<number, string>>(() => {
    const m = new Map<number, string>();
    this.durationTotals().forEach((t) => m.set(t.durationMonths, t.color));
    return m;
  });

  colorFor(months: number): string {
    return this.colorMap().get(months) ?? DURATION_COLORS[0];
  }

  sortedBuckets(row: AisDurationCountRow): DurationBucket[] {
    return [...(row.durationCounts ?? [])].sort((a, b) => a.durationMonths - b.durationMonths);
  }

  entityTypeChip(t: string): string {
    return (t ?? '').toLowerCase();
  }

  private fetchGen = 0;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;
      if (!changed) return;
      this.lastQuerySig = '';
      this.searchTerm.set('');
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      this.fetch();
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const query = tableQueryFromLazyEvent(event, { searchTerm: this.searchTerm() });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.fetch();
  }

  refresh(): void {
    this.lastQuerySig = '';
    this.fetch();
  }

  exportExcel(): void {
    if (this.exporting() || this.totalRecords() === 0) return;

    const pageSize = this.tableQuery().pageSize ?? 10;
    const baseQuery: TableQueryParams = {
      pageNumber: 1,
      pageSize,
      searchTerm: this.searchTerm(),
    };
    const mo = this.i18n.instant('reports.duration.monthAbbr');

    this.exporting.set(true);
    this.error.set('');
    fetchAllPagedRows((pageNumber) =>
      this.reports.getAisDurationCount({ ...baseQuery, pageNumber }),
    ).subscribe({
      next: (rows) => {
        this.exporting.set(false);
        if (!rows.length) return;
        const t = (key: string) => this.i18n.instant(key);
        downloadExcel(
          rows.map((r) => ({
            [t('reports.duration.columns.entity')]: r.entityName,
            [t('reports.duration.columns.entityType')]: r.entityType,
            [t('reports.duration.columns.totalDevices')]: r.totalDevices,
            [t('reports.duration.columns.breakdown')]: [...(r.durationCounts ?? [])]
              .sort((a, b) => a.durationMonths - b.durationMonths)
              .map((b) => `${b.durationMonths}${mo}: ${b.count}`)
              .join(', '),
          })),
          'duration-report.xlsx',
          'Duration',
        );
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('reports.duration.errors.export')));
      },
    });
  }

  fetch(query?: TableQueryParams): void {
    const q: TableQueryParams = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.reports.getAisDurationCount(q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.rows.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.rows.set([]);
        this.pagination.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('reports.duration.errors.load')));
      },
    });
  }
}
