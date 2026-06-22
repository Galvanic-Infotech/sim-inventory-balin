import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DeviceService } from '../../../core/services/device.service';
import { RbacService } from '../../../core/services/rbac.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import {
  DeviceByStatus,
  MovementDayGroup,
} from '../../../shared/models/device.model';
import { RbacEntity } from '../../../shared/models/rbac.model';
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
  imports: [DatePipe, FormsModule, SearchBarComponent, ActionSummaryDialogComponent, TranslatePipe],
  templateUrl: './transfer-panel.component.html',
  styleUrls: ['./panel-shared.scss', './transfer-panel.component.scss'],
})
export class DevicesTransferPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly devices = inject(DeviceService);
  private readonly rbac = inject(RbacService);
  private readonly i18n = inject(TranslationService);

  readonly summary = signal<MovementDayGroup[]>([]);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal('');
  readonly summarySearch = signal('');
  readonly expandedDates = signal<Set<string>>(new Set());

  readonly totalIn = computed(() =>
    this.summary().reduce((a, g) => a + g.movedIn, 0),
  );
  readonly totalOut = computed(() =>
    this.summary().reduce((a, g) => a + g.movedOut, 0),
  );

  readonly filteredSummary = computed<MovementDayGroup[]>(() => {
    const q = this.summarySearch().trim().toLowerCase();
    const list = this.summary();
    if (!q) return list;
    return list
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.serialNumber.toLowerCase().includes(q) ||
            i.fromEntityName?.toLowerCase().includes(q) ||
            i.toEntityName?.toLowerCase().includes(q) ||
            i.remarks?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
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

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.loadSummary();
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryError.set('');
    this.devices.getMovementSummary({ pageNumber: 1, pageSize: 50 }).subscribe({
      next: (res) => {
        this.summaryLoading.set(false);
        const data = res.data ?? [];
        this.summary.set(data);
        if (data.length) this.expandedDates.set(new Set([data[0].date]));
      },
      error: (err) => {
        this.summaryLoading.set(false);
        this.summaryError.set(
          extractApiError(err, this.i18n.instant('devices.errors.loadMovement')),
        );
      },
    });
  }

  toggleDate(date: string): void {
    this.expandedDates.update((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  isExpanded(date: string): boolean {
    return this.expandedDates().has(date);
  }

  onSummarySearch(value: string): void {
    this.summarySearch.set(value);
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
          this.loadSummary();
        },
        error: (err) => {
          this.transferSaving.set(false);
          this.transferError.set(
            extractApiError(err, this.i18n.instant('devices.errors.transferFailed')),
          );
        },
      });
  }

  trackDay(_: number, g: MovementDayGroup): string {
    return g.date;
  }

  trackItem(_: number, i: { logId: string }): string {
    return i.logId;
  }

  trackPool(_: number, d: DeviceByStatus): string {
    return d.itemId;
  }

  trackEntity(_: number, e: RbacEntity): string {
    return e.id;
  }
}
