import { Component, EventEmitter, Output, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
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
  readonly canCreate = this.perm.can(PERMS.FITMENT_CREATE);
  readonly canDelete = this.perm.can(PERMS.FITMENT_DELETE);

  @Output() createClick = new EventEmitter<void>();

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
