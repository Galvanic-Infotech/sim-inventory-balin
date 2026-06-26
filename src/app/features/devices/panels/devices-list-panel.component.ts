import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { DeviceService } from '../../../core/services/device.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import {
  AIS_DEVICE_FILTER_STATUSES,
  AisDevice,
  AisDeviceStatus,
  AisDeviceSummary,
} from '../../../shared/models/device.model';
import { TranslationService } from '../../../core/services/translation.service';
import { translatedItemStatusMeta } from '../../../core/utils/item-status-i18n.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { isItemActive } from '../../../shared/models/item-status.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent } from '../../../shared/utils/table-query.util';
import { BulkUploadDialogComponent } from '../../../shared/components/bulk-upload-dialog/bulk-upload-dialog.component';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { DeviceRcDetailsDialogComponent } from './device-rc-details-dialog.component';
import { DeviceDetailsDrawerComponent } from './device-details-drawer.component';

@Component({
  selector: 'app-devices-list-panel',
  standalone: true,
  imports: [
    TableModule,
    DatePipe,
    FormsModule,
    SearchBarComponent,
    BulkUploadDialogComponent,
    DeviceRcDetailsDialogComponent,
    DeviceDetailsDrawerComponent,
    TranslatePipe,
  ],
  templateUrl: './devices-list-panel.component.html',
  styleUrl: './devices-list-panel.component.scss',
})
export class DevicesListPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly devices = inject(DeviceService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canBulkUpload = this.perm.can(PERMS.DEVICE_BULK_UPLOAD);
  readonly canCreateFitment = this.perm.can(PERMS.FITMENT_CREATE);
  readonly canDeviceMapping = this.perm.can(PERMS.FITMENT_DEVICE_MAPPING);

  canStartFitment(d: AisDevice): boolean {
    return this.canCreateFitment() && isItemActive(d.status) && !!d.serialNumber;
  }

  startFitment(d: AisDevice): void {
    this.router.navigate(['/fitment'], { queryParams: { serial: d.serialNumber } });
  }

  /** Ignores out-of-order HTTP responses when filters/search/pagination change quickly. */
  private fetchGen = 0;
  /** True after the table has fired its first lazy-load (avoids duplicate init fetch). */
  private tableReady = false;

  readonly statuses = AIS_DEVICE_FILTER_STATUSES;

  readonly rows = signal<AisDevice[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<AisDeviceStatus | ''>('');
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);
  readonly summary = signal<AisDeviceSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly showBulkUpload = signal(false);
  readonly showRcDetails = signal(false);
  readonly rcDetailsSerial = signal<string | null>(null);
  readonly showDetails = signal(false);
  readonly detailsDevice = signal<AisDevice | null>(null);

  openDetails(d: AisDevice): void {
    this.detailsDevice.set(d);
    this.showDetails.set(true);
  }

  closeDetails(): void {
    this.showDetails.set(false);
    this.detailsDevice.set(null);
  }

  openRcDetails(d: AisDevice): void {
    if (!d.serialNumber) return;
    this.showDetails.set(false);
    this.rcDetailsSerial.set(d.serialNumber);
    this.showRcDetails.set(true);
  }

  closeRcDetails(): void {
    this.showRcDetails.set(false);
    this.rcDetailsSerial.set(null);
  }

  onRcDetailsSaved(): void {
    this.load();
    this.fetchSummary();
  }

  summaryCount(status: AisDeviceStatus): number {
    const s = this.summary();
    if (!s) return 0;
    const breakdown = s.statusBreakdown?.[status];
    if (typeof breakdown === 'number') return breakdown;
    switch (status) {
      case 'Activated':
        return s.activated ?? 0;
      case 'Fitted':
        return s.fitted ?? 0;
      case 'Expired':
        return s.expired ?? 0;
      case 'AboutExpired':
        return s.aboutToExpire ?? 0;
      case 'Available':
        return s.available ?? 0;
      case 'InProgress':
        return s.inProgress ?? 0;
      default:
        return 0;
    }
  }

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.resetListState();
      this.fetchSummary();
      if (this.tableReady) {
        this.load({ pageNumber: 1, pageSize: this.tableQuery().pageSize ?? 10 });
      }
    });
  }

  private fetchSummary(): void {
    const gen = ++this.summaryGen;
    this.summaryLoading.set(true);
    this.devices.getSummary().subscribe({
      next: (res) => {
        if (gen !== this.summaryGen) return;
        this.summaryLoading.set(false);
        this.summary.set(res.data ?? null);
      },
      error: () => {
        if (gen !== this.summaryGen) return;
        this.summaryLoading.set(false);
        this.summary.set(null);
      },
    });
  }

  private summaryGen = 0;

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const prev = this.tableQuery();
    const query = tableQueryFromLazyEvent(event, {
      searchTerm: this.searchTerm(),
      sortBy: prev.sortBy,
      sortOrder: prev.sortOrder,
    });
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.load(query);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, searchTerm: value }));
    this.load({ pageNumber: 1, searchTerm: value });
  }

  selectStatus(status: AisDeviceStatus | ''): void {
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1 }));
    this.load({ pageNumber: 1 });
  }

  statusInfo(status: AisDeviceStatus | string) {
    this.i18n.lang();
    this.i18n.revision();
    return translatedItemStatusMeta(String(status), (k) => this.i18n.instant(k));
  }

  fetch(query?: TableQueryParams): void {
    this.load(query);
    this.fetchSummary();
  }

  private resetListState(): void {
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.tableFirst.set(0);
    this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
  }

  private load(query?: TableQueryParams): void {
    const q = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const status = this.statusFilter();
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.devices.getDevices(q, status ? { status } : {}).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.rows.set(res.data ?? []);
        this.pagination.set(res.metadata?.pagination ?? null);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('devices.errors.loadDevices')));
      },
    });
  }
}
