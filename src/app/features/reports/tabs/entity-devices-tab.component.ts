import { Component, computed, effect, inject, signal } from '@angular/core';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { EntityDeviceCountRow } from '../../../shared/models/reports.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import {
  tableQueryFromLazyEvent,
  tableQuerySignature,
  isDuplicateTableFetch,
  trackEntityIdChange,
} from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { downloadExcel } from '../../../shared/utils/excel-export.util';
import { fetchAllPagedRows } from '../../../shared/utils/paged-export.util';

@Component({
  selector: 'app-entity-devices-tab',
  standalone: true,
  imports: [TableModule, TranslatePipe, SearchBarComponent],
  templateUrl: './entity-devices-tab.component.html',
  styleUrl: './entity-devices-tab.component.scss',
})
export class EntityDevicesTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(AuthService);

  readonly rows = signal<EntityDeviceCountRow[]>([]);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  entityTypeChip(t: string): string {
    return (t ?? '').toLowerCase().replace(/_/g, '-');
  }

  rowTotal(r: EntityDeviceCountRow): number {
    return (r.availableDeviceCount ?? 0) + (r.activeDeviceCount ?? 0) + (r.fittedDeviceCount ?? 0);
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

    this.exporting.set(true);
    this.error.set('');
    fetchAllPagedRows((pageNumber) =>
      this.reports.getEntityDeviceCounts({ ...baseQuery, pageNumber }),
    ).subscribe({
      next: (rows) => {
        this.exporting.set(false);
        if (!rows.length) return;
        const t = (key: string) => this.i18n.instant(key);
        downloadExcel(
          rows.map((r) => ({
            [t('reports.entityDevices.columns.entity')]: r.name,
            [t('reports.entityDevices.columns.entityType')]: r.entityType?.name ?? '',
            [t('reports.entityDevices.columns.status')]: r.isActive
              ? t('reports.entityDevices.active')
              : t('reports.entityDevices.inactive'),
            [t('reports.entityDevices.columns.available')]: r.availableDeviceCount,
            [t('reports.entityDevices.columns.active')]: r.activeDeviceCount,
            [t('reports.entityDevices.columns.fitted')]: r.fittedDeviceCount,
            [t('reports.entityDevices.columns.total')]: this.rowTotal(r),
          })),
          'entity-devices-report.xlsx',
          'Entity Devices',
        );
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(
          extractApiError(err, this.i18n.instant('reports.entityDevices.errors.export')),
        );
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
    this.reports.getEntityDeviceCounts(q).subscribe({
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
        this.error.set(extractApiError(err, this.i18n.instant('reports.entityDevices.errors.load')));
      },
    });
  }
}
