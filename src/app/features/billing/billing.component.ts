import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { BillingService } from '../../core/services/billing.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PaginationMeta } from '../../shared/models/rbac.model';
import { TableQueryParams } from '../../shared/models/table-query.model';
import { tableQueryFromLazyEvent } from '../../shared/utils/table-query.util';
import {
  BillingTransaction,
  isCredit,
  transactionNet,
} from '../../shared/models/billing.model';

interface Summary {
  totalDebited: number;
  totalCredited: number;
  totalTax: number;
  avgActivatedSims: number;
  latestRate: number;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, TableModule, TranslatePipe],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent {
  private readonly billing = inject(BillingService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);

  readonly items = signal<BillingTransaction[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly tableQuery = signal<TableQueryParams>({ pageNumber: 1, pageSize: 10 });
  readonly tableFirst = signal(0);

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  readonly summary = computed<Summary>(() => this.buildSummary(this.items()));

  private fetchGen = 0;
  private tableReady = false;
  private lastQuerySig = '';

  readonly isCredit = isCredit;
  readonly net = transactionNet;

  constructor() {
    effect(() => {
      this.auth.entityId();
      this.lastQuerySig = '';
      this.tableFirst.set(0);
      this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
      // Don't fetch here — PrimeNG re-emits onLazyLoad when [first] resets.
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    const query = tableQueryFromLazyEvent(event);
    this.tableQuery.set(query);
    this.tableFirst.set(event.first ?? 0);
    this.fetch(query);
  }

  fetch(query?: TableQueryParams): void {
    const q: TableQueryParams = { ...this.tableQuery(), ...query };
    const sig = `${q.pageNumber}|${q.pageSize}|${q.sortBy ?? ''}|${q.sortOrder ?? ''}|${q.searchTerm ?? ''}`;
    if (sig === this.lastQuerySig && this.loading()) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.billing.fetchTransactions(q).subscribe({
      next: (res) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.items.set(res.items);
        this.pagination.set(res.pagination);
      },
      error: (err) => {
        if (gen !== this.fetchGen) return;
        this.loading.set(false);
        this.items.set([]);
        this.pagination.set(null);
        this.error.set(extractApiError(err, this.i18n.instant('billing.errors.load')));
      },
    });
  }

  private buildSummary(items: BillingTransaction[]): Summary {
    if (!items.length) {
      return {
        totalDebited: 0,
        totalCredited: 0,
        totalTax: 0,
        avgActivatedSims: 0,
        latestRate: 0,
      };
    }
    let debited = 0;
    let credited = 0;
    let tax = 0;
    let activated = 0;
    for (const t of items) {
      debited += t.debitedAmount;
      credited += t.creditedAmount;
      tax += t.taxAmount;
      activated += t.totalActivatedSims;
    }
    return {
      totalDebited: debited,
      totalCredited: credited,
      totalTax: tax,
      avgActivatedSims: Math.round(activated / items.length),
      latestRate: items[0].dailyRate,
    };
  }
}
