import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { OutstandingReportRow } from '../../../shared/models/reports.model';
import { PaginationMeta } from '../../../shared/models/rbac.model';
import { TableQueryParams } from '../../../shared/models/table-query.model';
import {
  tableQueryFromLazyEvent,
  tableQuerySignature,
  isDuplicateTableFetch,
} from '../../../shared/utils/table-query.util';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions/row-actions.component';
import { BillingConfigDrawerComponent } from '../../../shared/components/billing-config-drawer/billing-config-drawer.component';
import { BillingCreditDialogComponent } from '../../../shared/components/billing-credit-dialog/billing-credit-dialog.component';
import { BillingGenerateDialogComponent } from '../../../shared/components/billing-generate-dialog/billing-generate-dialog.component';

@Component({
  selector: 'app-outstanding-tab',
  standalone: true,
  imports: [
    CurrencyPipe,
    TableModule,
    TranslatePipe,
    SearchBarComponent,
    RowActionsComponent,
    BillingConfigDrawerComponent,
    BillingCreditDialogComponent,
    BillingGenerateDialogComponent,
  ],
  templateUrl: './outstanding-tab.component.html',
  styleUrl: './outstanding-tab.component.scss',
})
export class OutstandingTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);
  readonly perm = inject(PermissionService);

  readonly canEditBilling = this.perm.can(PERMS.BILLING_CONFIG_UPDATE);
  readonly canAddCredit = this.perm.can(PERMS.BILLING_AMOUNT_CREDIT);
  readonly canGenerateBill = this.perm.can(PERMS.BILLING_GENERATE);

  readonly rows = signal<OutstandingReportRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);
  readonly searchTerm = signal('');

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly billingEntity = signal<{ id: string; name: string } | null>(null);
  readonly creditEntity = signal<{ id: string; name: string } | null>(null);
  readonly generateEntity = signal<{ id: string; name: string } | null>(null);

  private fetchGen = 0;
  private lastQuerySig = '';

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

  fetch(query?: TableQueryParams): void {
    const q: TableQueryParams = { ...this.tableQuery(), searchTerm: this.searchTerm(), ...query };
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.reports.getOutstanding(q).subscribe({
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
        this.error.set(extractApiError(err, this.i18n.instant('reports.outstanding.errors.load')));
      },
    });
  }

  rowActions(r: OutstandingReportRow): RowAction[] {
    const t = (key: string) => this.i18n.instant(key);
    return [
      {
        label: t('master.entities.editBilling'),
        icon: 'receipt_long',
        iconColor: 'var(--color-primary)',
        disabled: !this.canEditBilling(),
        onClick: () => this.billingEntity.set({ id: r.entityId, name: r.entityName }),
      },
      {
        label: t('master.entities.addCredit'),
        icon: 'savings',
        iconColor: 'var(--color-success)',
        disabled: !this.canAddCredit(),
        onClick: () => this.creditEntity.set({ id: r.entityId, name: r.entityName }),
      },
      {
        label: t('master.entities.generateBill'),
        icon: 'play_circle',
        iconColor: 'var(--color-warning)',
        disabled: !this.canGenerateBill(),
        onClick: () => this.generateEntity.set({ id: r.entityId, name: r.entityName }),
      },
    ];
  }

  closeBillingDrawer(saved: boolean): void {
    this.billingEntity.set(null);
    if (saved) this.fetch();
  }

  closeCreditDialog(saved: boolean): void {
    this.creditEntity.set(null);
    if (saved) this.fetch();
  }

  closeGenerateDialog(saved: boolean): void {
    this.generateEntity.set(null);
    if (saved) this.fetch();
  }
}
