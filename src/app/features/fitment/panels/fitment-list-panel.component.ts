import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { FitmentService } from '../../../core/services/fitment.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { Fitment, FitmentStatusCount } from '../../../shared/models/fitment.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import { tableQueryFromLazyEvent } from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { FitmentOtpDialogComponent } from './fitment-otp-dialog.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { downloadExcel } from '../../../shared/utils/excel-export.util';

@Component({
  selector: 'app-fitment-list-panel',
  standalone: true,
  imports: [TableModule, DatePipe, FormsModule, SearchBarComponent, DeleteConfirmDialogComponent, FitmentOtpDialogComponent, TranslatePipe],
  templateUrl: './fitment-list-panel.component.html',
  styleUrl: './fitment-list-panel.component.scss',
})
export class FitmentListPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly fitment = inject(FitmentService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);
  readonly canDelete = this.perm.can(PERMS.FITMENT_DELETE);

  readonly selected = signal<Fitment | null>(null);

  openDetail(f: Fitment): void {
    this.selected.set(f);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  private fetchGen = 0;
  private tableReady = false;

  readonly rows = signal<Fitment[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | undefined>(undefined);
  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly otpDialogOpen = signal(false);
  readonly otpFitment = signal<Fitment | null>(null);

  readonly regeneratingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deleteTarget = signal<Fitment | null>(null);
  readonly exporting = signal(false);

  askDeleteFitment(f: Fitment): void {
    if (this.deletingId()) return;
    this.deleteTarget.set(f);
  }

  cancelDeleteFitment(): void {
    if (this.deletingId()) return;
    this.deleteTarget.set(null);
  }

  confirmDeleteFitment(): void {
    const f = this.deleteTarget();
    if (!f || this.deletingId()) return;
    this.deletingId.set(f.id);
    this.fitment.deleteFitment(f.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleteTarget.set(null);
        if (this.selected()?.id === f.id) this.closeDetail();
        this.refresh();
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('fitment.errors.deleteFailed')));
      },
    });
  }

  regenerateCertificate(f: Fitment): void {
    if (this.regeneratingId()) return;
    this.regeneratingId.set(f.id);
    this.fitment.generateCertificate(f.id).subscribe({
      next: (res) => {
        this.regeneratingId.set(null);
        const updatedUrl = res.data?.data ?? null;
        if (updatedUrl) {
          this.rows.update((rows) =>
            rows.map((r) => (r.id === f.id ? { ...r, fitmentCertificateUrl: updatedUrl } : r)),
          );
          if (this.selected()?.id === f.id) {
            this.selected.update((s) => (s ? { ...s, fitmentCertificateUrl: updatedUrl } : s));
          }
        } else {
          this.load();
        }
      },
      error: (err) => {
        this.regeneratingId.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('fitment.errors.regenerateFailed')));
      },
    });
  }

  readonly statusCount = signal<FitmentStatusCount | null>(null);
  readonly statusLoading = signal(false);
  readonly totalFitments = computed(() => {
    const c = this.statusCount();
    if (!c) return 0;
    return (c.OtpPending ?? 0) + (c.Completed ?? 0) + (c.Expired ?? 0);
  });

  private fetchStatusCount(): void {
    this.statusLoading.set(true);
    this.fitment.getStatusCount().subscribe({
      next: (res) => {
        this.statusLoading.set(false);
        this.statusCount.set(res.data ?? null);
      },
      error: () => {
        this.statusLoading.set(false);
        this.statusCount.set(null);
      },
    });
  }

  openOtpDialog(f: Fitment): void {
    this.otpFitment.set(f);
    this.otpDialogOpen.set(true);
  }

  closeOtpDialog(): void {
    this.otpDialogOpen.set(false);
    this.otpFitment.set(null);
  }

  onOtpSuccess(): void {
    this.closeOtpDialog();
    this.refresh();
    this.fetchStatusCount();
  }

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.searchTerm.set('');
      this.statusFilter.set(undefined);
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      this.fetchStatusCount();
      if (this.tableReady) this.load({ pageNumber: 1, pageSize: 10 });
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event, {
      searchTerm: this.searchTerm(),
      status: this.statusFilter(),
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

  toggleStatusFilter(status: string): void {
    const next = this.statusFilter() === status ? undefined : status;
    this.statusFilter.set(next);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, status: next }));
    this.load({ pageNumber: 1, status: next });
  }

  clearStatusFilter(): void {
    if (!this.statusFilter()) return;
    this.statusFilter.set(undefined);
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1, status: undefined }));
    this.load({ pageNumber: 1, status: undefined });
  }

  refresh(): void {
    this.load();
    this.fetchStatusCount();
  }

  exportExcel(): void {
    if (this.exporting() || this.totalRecords() === 0) return;

    this.exporting.set(true);
    this.error.set('');
    this.fetchAllFitmentsForExport().subscribe({
      next: (rows) => {
        this.exporting.set(false);
        if (!rows.length) return;
        downloadExcel(this.fitmentsToExportRows(rows), 'fitments.xlsx', 'Fitments');
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('fitment.errors.exportFailed')));
      },
    });
  }

  private fetchAllFitmentsForExport() {
    const pageSize = this.tableQuery().pageSize ?? 10;
    const baseQuery: TableQueryParams = {
      pageNumber: 1,
      pageSize,
      searchTerm: this.searchTerm(),
      status: this.statusFilter(),
    };

    return this.fitment.getFitments(baseQuery).pipe(
      switchMap((firstRes) => {
        const firstRows = firstRes.data ?? [];
        const totalPages = firstRes.metadata?.pagination?.totalPages ?? 1;

        if (totalPages <= 1) {
          return of(firstRows);
        }

        const pageRequests = Array.from({ length: totalPages - 1 }, (_, i) =>
          this.fitment.getFitments({ ...baseQuery, pageNumber: i + 2 }),
        );

        return forkJoin(pageRequests).pipe(
          map((responses) => [...firstRows, ...responses.flatMap((r) => r.data ?? [])]),
        );
      }),
    );
  }

  private fitmentsToExportRows(rows: Fitment[]): Record<string, unknown>[] {
    const t = (key: string) => this.i18n.instant(key);
    return rows.map((f) => ({
      [t('fitment.list.colVehicleFitment')]: f.fitmentNo,
      [t('fitment.list.registration')]: f.vehicleRegistrationNo,
      [t('fitment.list.entityName')]: f.entity?.name ?? '',
      [t('fitment.list.entityType')]: f.entity?.entityType?.name ?? '',
      [t('fitment.list.chassis')]: f.chassisNo,
      [t('fitment.list.engine')]: f.engineNo,
      [t('fitment.list.imei')]: f.imei ?? '',
      [t('fitment.list.serialNo')]: f.serialNo?.trim() ?? '',
      [t('fitment.list.mfgYear')]: f.mafYear,
      [t('fitment.list.category')]: f.vehicleCategory?.name ?? '',
      [t('fitment.list.name')]: f.customerName,
      [t('fitment.list.mobile')]: f.mobileNo,
      [t('fitment.list.address')]: f.address,
      [t('fitment.list.state')]: f.rto?.district?.state?.stateName ?? '',
      [t('fitment.list.rtoCode')]: f.rto?.rtoCode ?? '',
      [t('fitment.list.rtoName')]: f.rto?.rtoName ?? '',
      [t('fitment.list.colFitmentDate')]: this.formatExportDate(f.fitmentDate),
      [t('fitment.list.colValidTill')]: this.formatExportDate(f.fitmentValidTill),
      [t('fitment.list.colStatus')]: f.status ? t(`fitment.status.${f.status}`) : '',
      [t('fitment.list.created')]: this.formatExportDate(f.createdAt),
    }));
  }

  private formatExportDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private load(query?: TableQueryParams): void {
    const q = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.fitment.getFitments(q).subscribe({
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
        this.error.set(extractApiError(err, this.i18n.instant('fitment.errors.loadFailed')));
      },
    });
  }
}
