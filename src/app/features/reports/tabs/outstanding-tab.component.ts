import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ReportsService } from '../../../core/services/reports.service';
import { TranslationService } from '../../../core/services/translation.service';
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

@Component({
  selector: 'app-outstanding-tab',
  standalone: true,
  imports: [CurrencyPipe, TableModule, TranslatePipe],
  templateUrl: './outstanding-tab.component.html',
  styleUrl: './outstanding-tab.component.scss',
})
export class OutstandingTabComponent {
  private readonly reports = inject(ReportsService);
  private readonly i18n = inject(TranslationService);

  readonly rows = signal<OutstandingReportRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  private fetchGen = 0;
  private lastQuerySig = '';

  onLazyLoad(event: TableLazyLoadEvent): void {
    const query = tableQueryFromLazyEvent(event);
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  refresh(): void {
    this.lastQuerySig = '';
    this.fetch();
  }

  fetch(query?: TableQueryParams): void {
    const q: TableQueryParams = { ...this.tableQuery(), ...query };
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
}
