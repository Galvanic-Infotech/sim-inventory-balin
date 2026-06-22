import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { DeviceService } from '../../../core/services/device.service';
import { RbacService } from '../../../core/services/rbac.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import {
  buildMovementChartGeometry,
  DeviceByStatus,
  MovementDayGroup,
  MovementLogItem,
  movementGroupsToChartDays,
} from '../../../shared/models/device.model';
import { PaginationMeta, RbacEntity } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import {
  isDuplicateTableFetch,
  tableQueryFromLazyEvent,
  tableQuerySignature,
  trackEntityIdChange,
} from '../../../shared/utils/table-query.util';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import {
  ActionSummaryDevice,
  ActionSummaryDialogComponent,
  ActionSummaryRow,
} from '../../../shared/components/action-summary-dialog/action-summary-dialog.component';

@Component({
  selector: 'app-devices-transfer-panel',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    TableModule,
    SearchBarComponent,
    ActionSummaryDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './transfer-panel.component.html',
  styleUrls: ['./panel-shared.scss', './transfer-panel.component.scss'],
})
export class DevicesTransferPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly devices = inject(DeviceService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);

  readonly summary = signal<MovementDayGroup[]>([]);
  /** Cached from page-1 fetches — powers chart/stats without a second API call. */
  readonly chartSource = signal<MovementDayGroup[]>([]);
  readonly tableLoading = signal(false);
  readonly tableError = signal('');
  readonly summarySearch = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);

  readonly movementRows = computed<MovementLogItem[]>(() =>
    this.summary().flatMap((g) => g.items),
  );

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly chartDays = computed(() => {
    const groups =
      this.chartSource().length > 0
        ? this.chartSource()
        : (this.tableQuery().pageNumber ?? 1) === 1
          ? this.summary()
          : [];
    return movementGroupsToChartDays(groups);
  });

  readonly chartGeometry = computed(() => buildMovementChartGeometry(this.chartDays()));

  readonly chartTotal = computed(() =>
    this.chartDays().reduce((sum, d) => sum + d.total, 0),
  );

  readonly chartHasData = computed(() => this.chartDays().some((d) => d.total > 0));

  readonly chartMaxValue = computed(() => {
    const pts = this.chartGeometry().points;
    return pts.length ? Math.max(...pts.map((p) => p.amount)) : 0;
  });

  readonly totalIn = computed(() =>
    this.chartDays().reduce((a, d) => a + d.movedIn, 0),
  );
  readonly totalOut = computed(() =>
    this.chartDays().reduce((a, d) => a + d.movedOut, 0),
  );
  readonly activeDays = computed(() =>
    this.chartDays().filter((d) => d.total > 0).length,
  );

  readonly hoveredChartDate = signal<string | null>(null);

  readonly hoveredChartPoint = computed(() => {
    const date = this.hoveredChartDate();
    if (!date) return null;
    return this.chartGeometry().points.find((p) => p.date === date) ?? null;
  });

  readonly todayChartDate = computed(() => {
    const days = this.chartDays();
    return days.length ? days[days.length - 1].date : null;
  });

  readonly showDialog = signal(false);
  readonly isReturn = signal(false);
  readonly pool = signal<DeviceByStatus[]>([]);
  readonly poolLoading = signal(false);
  readonly poolError = signal('');
  readonly poolSearch = signal('');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly toEntityId = signal('');
  readonly entitySearch = signal('');
  readonly entities = signal<RbacEntity[]>([]);
  readonly entitiesLoading = signal(false);
  readonly transferSaving = signal(false);
  readonly transferError = signal('');
  readonly showConfirm = signal(false);
  transferRemarks = '';

  readonly selectedDevices = computed<ActionSummaryDevice[]>(() => {
    const ids = this.selectedIds();
    return this.pool()
      .filter((d) => ids.has(d.itemId))
      .map((d) => ({ uid: d.uid, imei: d.imei, iccid: d.iccid }));
  });

  readonly confirmRows = computed<ActionSummaryRow[]>(() => {
    this.i18n.lang();
    this.i18n.revision();
    const t = (k: string) => this.i18n.instant(k);
    const rows: ActionSummaryRow[] = [
      {
        label: t('devices.transfer.confirmType'),
        value: this.isReturn() ? t('devices.transfer.typeReturn') : t('devices.transfer.typeTransfer'),
      },
      {
        label: t('devices.transfer.confirmTarget'),
        value: this.isReturn() ? t('devices.transfer.targetParent') : this.selectedEntityName() || '—',
      },
      {
        label: t('devices.transfer.confirmDevices'),
        value: String(this.selectedCount()),
      },
    ];
    const remarks = this.transferRemarks?.trim();
    if (remarks) {
      rows.push({ label: t('devices.transfer.confirmRemarks'), value: remarks });
    }
    return rows;
  });

  readonly confirmTitle = computed(() => this.i18n.instant('devices.transfer.confirmTitle'));
  readonly confirmLabel = computed(() => this.i18n.instant('devices.transfer.confirmLabel'));

  readonly filteredPool = computed(() => {
    const q = this.poolSearch().trim().toLowerCase();
    const list = this.pool();
    if (!q) return list;
    return list.filter(
      (d) =>
        d.uid.toLowerCase().includes(q) ||
        d.imei.toLowerCase().includes(q) ||
        d.iccid.toLowerCase().includes(q),
    );
  });

  readonly filteredEntities = computed(() => {
    const q = this.entitySearch().toLowerCase().trim();
    const currentEntityId = this.auth.entityId();
    const list = this.entities().filter((e) => e.id !== currentEntityId);
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q),
    );
  });

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly canSubmit = computed(
    () =>
      this.selectedCount() > 0 &&
      (this.isReturn() || !!this.toEntityId()) &&
      !this.transferSaving(),
  );

  private tableFetchGen = 0;
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;

      if (changed) {
        this.lastQuerySig = '';
        this.tableFirst.set(0);
        this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
        this.summarySearch.set('');
        this.chartSource.set([]);
        if (this.tableReady) {
          this.fetchTable();
        }
      } else if (!eid) {
        this.chartSource.set([]);
      }
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, {
      searchTerm: this.summarySearch(),
    });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetchTable(query);
  }

  onSummarySearch(value: string): void {
    this.summarySearch.set(value);
    this.lastQuerySig = '';
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    if (this.tableReady) {
      this.fetchTable({ pageNumber: 1, searchTerm: value });
    }
  }

  refreshAll(): void {
    this.lastQuerySig = '';
    this.fetchTable();
  }

  fetchTable(query?: TableQueryParams): void {
    const q: TableQueryParams = {
      ...this.tableQuery(),
      ...query,
      searchTerm: query?.searchTerm ?? this.summarySearch(),
    };
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.tableLoading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.tableFetchGen;
    this.tableLoading.set(true);
    this.tableError.set('');
    this.devices.getMovementSummary(q).subscribe({
      next: (res) => {
        if (gen !== this.tableFetchGen) return;
        this.tableLoading.set(false);
        const data = res.data ?? [];
        this.summary.set(data);
        this.pagination.set(res.metadata?.pagination ?? null);
        if ((q.pageNumber ?? 1) === 1 && !q.searchTerm?.trim()) {
          this.chartSource.set(data);
        }
      },
      error: (err) => {
        if (gen !== this.tableFetchGen) return;
        this.tableLoading.set(false);
        this.summary.set([]);
        this.pagination.set(null);
        this.tableError.set(
          extractApiError(err, this.i18n.instant('devices.errors.loadMovement')),
        );
      },
    });
  }

  chartDayLabel(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }

  chartFullDate(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  setHoveredChartDate(date: string | null): void {
    this.hoveredChartDate.set(date);
  }

  openDialog(): void {
    this.isReturn.set(false);
    this.selectedIds.set(new Set());
    this.toEntityId.set('');
    this.entitySearch.set('');
    this.poolSearch.set('');
    this.transferRemarks = '';
    this.transferError.set('');
    this.entities.set([]);
    this.showDialog.set(true);
    this.loadPool();
    this.loadEntities();
  }

  closeDialog(): void {
    this.showDialog.set(false);
  }

  toggleReturn(): void {
    this.isReturn.update((v) => !v);
    if (this.isReturn()) {
      this.toEntityId.set('');
    } else if (!this.entities().length) {
      this.loadEntities();
    }
  }

  loadPool(): void {
    this.poolLoading.set(true);
    this.poolError.set('');
    this.devices.getDevicesByStatus('Available').subscribe({
      next: (res) => {
        this.poolLoading.set(false);
        this.pool.set(res.data ?? []);
      },
      error: (err) => {
        this.poolLoading.set(false);
        this.poolError.set(extractApiError(err, this.i18n.instant('devices.errors.loadPool')));
      },
    });
  }

  loadEntities(): void {
    this.entitiesLoading.set(true);
    this.rbac.getAllEntities().subscribe({
      next: (list) => {
        this.entitiesLoading.set(false);
        this.entities.set(list);
      },
      error: () => {
        this.entitiesLoading.set(false);
        this.entities.set([]);
      },
    });
  }

  toggleDevice(itemId: string): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  toggleAllVisible(): void {
    const visible = this.filteredPool().map((d) => d.itemId);
    const selected = this.selectedIds();
    const allSelected = visible.every((id) => selected.has(id));
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visible) next.delete(id);
      } else {
        for (const id of visible) next.add(id);
      }
      return next;
    });
  }

  allVisibleSelected(): boolean {
    const visible = this.filteredPool();
    if (!visible.length) return false;
    const selected = this.selectedIds();
    return visible.every((d) => selected.has(d.itemId));
  }

  selectEntity(id: string): void {
    this.toEntityId.set(id);
  }

  selectedEntityName(): string {
    const id = this.toEntityId();
    return this.entities().find((e) => e.id === id)?.name ?? '';
  }

  openConfirmTransfer(): void {
    if (!this.canSubmit()) return;
    this.transferError.set('');
    this.showConfirm.set(true);
  }

  closeConfirm(): void {
    if (this.transferSaving()) return;
    this.showConfirm.set(false);
    this.transferError.set('');
  }

  confirmSubmitTransfer(): void {
    this.submitTransfer();
  }

  submitTransfer(): void {
    const itemIds = Array.from(this.selectedIds());
    const isReturn = this.isReturn();
    const toEntityId = this.toEntityId();
    if (!itemIds.length) return;
    if (!isReturn && !toEntityId) return;
    this.transferSaving.set(true);
    this.transferError.set('');
    this.devices
      .moveDevices({
        isReturn,
        toEntityId: isReturn ? undefined : toEntityId,
        itemIds,
        remarks: this.transferRemarks?.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.transferSaving.set(false);
          const msg = getApiResponseError(res, this.i18n.instant('devices.errors.transferFailed'));
          if (msg) {
            this.transferError.set(msg);
            return;
          }
          this.showConfirm.set(false);
          this.showDialog.set(false);
          this.selectedIds.set(new Set());
          this.refreshAll();
        },
        error: (err) => {
          this.transferSaving.set(false);
          this.transferError.set(
            extractApiError(err, this.i18n.instant('devices.errors.transferFailed')),
          );
        },
      });
  }

  trackItem(_: number, i: MovementLogItem): string {
    return i.logId;
  }

  trackPool(_: number, d: DeviceByStatus): string {
    return d.itemId;
  }

  trackEntity(_: number, e: RbacEntity): string {
    return e.id;
  }
}
