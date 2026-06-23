import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { DeviceService } from '../../../core/services/device.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import {
  AisDeviceStatus,
  DeviceByStatus,
  DeviceSimOperation,
  RECHARGE_BY_STATUS_PARAM,
  ITEM_STATUS,
} from '../../../shared/models/device.model';
import { TranslationService } from '../../../core/services/translation.service';
import { translatedItemStatusMeta } from '../../../core/utils/item-status-i18n.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import {
  ActionSummaryDevice,
  ActionSummaryDialogComponent,
  ActionSummaryRow,
} from '../../../shared/components/action-summary-dialog/action-summary-dialog.component';

@Component({
  selector: 'app-devices-activate-recharge-panel',
  standalone: true,
  imports: [TableModule, FormsModule, SearchBarComponent, ActionSummaryDialogComponent, TranslatePipe],
  templateUrl: './activate-recharge-panel.component.html',
  styleUrls: ['./panel-shared.scss', './activate-recharge-panel.component.scss'],
})
export class DevicesActivateRechargePanelComponent {
  private readonly auth = inject(AuthService);
  private readonly devices = inject(DeviceService);
  private readonly i18n = inject(TranslationService);

  private fetchGen = 0;

  readonly operation = signal<DeviceSimOperation | null>(null);

  readonly allRows = signal<DeviceByStatus[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searchTerm = signal('');

  readonly filteredRows = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this.allRows();
    if (!q) return list;
    return list.filter(
      (d) =>
        d.uid.toLowerCase().includes(q) ||
        d.imei.toLowerCase().includes(q) ||
        d.iccid.toLowerCase().includes(q),
    );
  });

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly submitSuccess = signal('');
  readonly showConfirm = signal(false);

  readonly selectedDevices = computed<ActionSummaryDevice[]>(() => {
    const ids = this.selectedIds();
    return this.allRows()
      .filter((d) => ids.has(d.itemId))
      .map((d) => ({
        uid: d.uid,
        imei: d.imei,
        iccid: d.iccid,
        status: this.statusInfo(d.status).label,
      }));
  });

  readonly confirmRows = computed<ActionSummaryRow[]>(() => {
    this.i18n.lang();
    this.i18n.revision();
    const op = this.operation();
    const t = (k: string) => this.i18n.instant(k);
    return [
      {
        label: t('devices.activate.operation'),
        value: op === 'Activate' ? t('devices.activate.activateSim') : t('devices.activate.renewRecharge'),
      },
      { label: t('devices.transfer.confirmDevices'), value: String(this.selectedCount()) },
    ];
  });

  readonly confirmTitle = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.operation() === 'Activate'
      ? this.i18n.instant('devices.activate.confirmActivateTitle')
      : this.i18n.instant('devices.activate.confirmRechargeTitle');
  });

  readonly confirmLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    return this.operation() === 'Activate'
      ? this.i18n.instant('devices.activate.confirmActivateLabel')
      : this.i18n.instant('devices.activate.confirmRechargeLabel');
  });

  readonly activateButtonLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const n = this.selectedCount();
    const key = n === 1 ? 'devices.activate.activateDevices' : 'devices.activate.activateDevicesPlural';
    return this.i18n.instant(key, { count: n || '' });
  });

  readonly rechargeButtonLabel = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const n = this.selectedCount();
    const key = n === 1 ? 'devices.activate.rechargeDevices' : 'devices.activate.rechargeDevicesPlural';
    return this.i18n.instant(key, { count: n || '' });
  });

  readonly canSubmit = computed(
    () => !!this.operation() && this.selectedCount() > 0 && !this.submitting(),
  );

  readonly allVisibleSelected = computed(() => {
    const visible = this.filteredRows();
    if (!visible.length) return false;
    const selected = this.selectedIds();
    return visible.every((d) => selected.has(d.itemId));
  });

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.resetForEntity();
    });
  }

  selectOperation(op: DeviceSimOperation): void {
    if (this.operation() === op) return;
    this.operation.set(op);
    this.selectedIds.set(new Set());
    this.submitError.set('');
    this.submitSuccess.set('');
    this.searchTerm.set('');
    this.load();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  fetch(): void {
    this.load();
  }

  statusInfo(status: AisDeviceStatus | string) {
    this.i18n.lang();
    this.i18n.revision();
    return translatedItemStatusMeta(String(status), (k) => this.i18n.instant(k));
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
    const visible = this.filteredRows();
    const selected = this.selectedIds();
    const allSelected = visible.every((d) => selected.has(d.itemId));
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const d of visible) next.delete(d.itemId);
      } else {
        for (const d of visible) next.add(d.itemId);
      }
      return next;
    });
  }

  openConfirm(): void {
    if (!this.canSubmit()) return;
    this.submitError.set('');
    this.showConfirm.set(true);
  }

  closeConfirm(): void {
    if (this.submitting()) return;
    this.showConfirm.set(false);
    this.submitError.set('');
  }

  confirmSubmit(): void {
    this.submit();
  }

  submit(): void {
    const operation = this.operation();
    const itemIds = Array.from(this.selectedIds());
    if (!operation || !itemIds.length) return;

    this.submitting.set(true);
    this.submitError.set('');
    this.submitSuccess.set('');

    this.devices.activateDevices({ operation, itemIds }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('devices.errors.requestFailed'));
        if (msg) {
          this.submitError.set(msg);
          return;
        }
        this.showConfirm.set(false);
        this.selectedIds.set(new Set());
        this.submitSuccess.set(
          operation === 'Activate'
            ? this.i18n.instant('devices.activate.queuedActivate', { count: itemIds.length })
            : this.i18n.instant('devices.activate.queuedRecharge', { count: itemIds.length }),
        );
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(extractApiError(err, this.i18n.instant('devices.errors.requestFailed')));
      },
    });
  }

  private resetForEntity(): void {
    this.operation.set(null);
    this.allRows.set([]);
    this.selectedIds.set(new Set());
    this.searchTerm.set('');
    this.error.set('');
    this.submitError.set('');
    this.submitSuccess.set('');
  }

  private statusParam(): string | undefined {
    const op = this.operation();
    if (op === 'Activate') return ITEM_STATUS.Available;
    if (op === 'Recharge') return RECHARGE_BY_STATUS_PARAM;
    return undefined;
  }

  private load(): void {
    const status = this.statusParam();
    if (!status) return;

    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');

    this.devices.getDevicesByStatus(status).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.allRows.set(res.data ?? []);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('devices.errors.loadDevices')));
      },
    });
  }
}
