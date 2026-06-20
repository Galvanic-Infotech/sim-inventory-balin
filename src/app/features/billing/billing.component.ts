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
import { tableQueryFromLazyEvent, tableQuerySignature, isDuplicateTableFetch, trackEntityIdChange } from '../../shared/utils/table-query.util';
import {
  BillingConfig,
  BillingProductType,
  BillingTransaction,
  BILLING_PRODUCT_TYPES,
  availableCredit,
  creditUtilisationPct,
  findBillingConfig,
  isCredit,
  transactionNet,
} from '../../shared/models/billing.model';

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

  readonly configs = signal<BillingConfig[]>([]);
  readonly configLoading = signal(false);
  readonly configError = signal('');
  readonly selectedProductType = signal<BillingProductType>(BillingProductType.Sim);

  readonly productTypes = BILLING_PRODUCT_TYPES;
  readonly BillingProductType = BillingProductType;

  readonly config = computed(() =>
    findBillingConfig(this.configs(), this.selectedProductType()),
  );

  readonly availableCredit = computed(() => {
    const c = this.config();
    return c ? availableCredit(c) : 0;
  });
  readonly utilisationPct = computed(() => {
    const c = this.config();
    return c ? creditUtilisationPct(c) : 0;
  });

  readonly rateLabelKey = computed(() =>
    this.selectedProductType() === BillingProductType.License
      ? 'billing.summary.rateLicense'
      : 'billing.summary.rateSim',
  );

  readonly totalRecords = computed(() => this.pagination()?.totalCount ?? 0);

  private fetchGen = 0;
  private configGen = 0;
  private tableReady = false;
  private lastQuerySig = '';
  private prevEntityId: string | undefined;

  readonly isCredit = isCredit;
  readonly net = transactionNet;
  readonly findBillingConfig = findBillingConfig;

  constructor() {
    effect(() => {
      const eid = this.auth.entityId();
      const { changed, next } = trackEntityIdChange(this.prevEntityId, eid);
      this.prevEntityId = next;

      if (changed) {
        this.lastQuerySig = '';
        this.tableFirst.set(0);
        this.tableQuery.set({ pageNumber: 1, pageSize: 10 });
        // PrimeNG only re-emits onLazyLoad when [first] *changes* — if user was
        // already on page 1, switching entity wouldn't trigger anything.
        if (this.tableReady) {
          this.fetch();
        }
      }

      if (eid) {
        this.fetchConfig(eid);
      } else {
        this.configs.set([]);
      }
    });
  }

  fetchConfig(entityId?: string): void {
    const eid = entityId ?? this.auth.entityId();
    if (!eid) return;
    const gen = ++this.configGen;
    this.configLoading.set(true);
    this.configError.set('');
    this.billing.fetchConfig(eid).subscribe({
      next: (items) => {
        if (gen !== this.configGen) return;
        this.configLoading.set(false);
        this.configs.set(items);
        if (!findBillingConfig(items, this.selectedProductType()) && items.length) {
          this.selectedProductType.set(items[0].productType);
        }
      },
      error: (err) => {
        if (gen !== this.configGen) return;
        this.configLoading.set(false);
        this.configs.set([]);
        this.configError.set(extractApiError(err, this.i18n.instant('billing.errors.loadConfig')));
      },
    });
  }

  selectProductType(type: BillingProductType): void {
    if (this.selectedProductType() === type) return;
    this.selectedProductType.set(type);
    this.lastQuerySig = '';
    this.tableFirst.set(0);
    this.tableQuery.update((q) => ({ ...q, pageNumber: 1 }));
    if (this.tableReady) {
      this.fetch({ pageNumber: 1 });
    }
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
    const sig = tableQuerySignature(q);
    if (isDuplicateTableFetch(sig, this.lastQuerySig, this.loading())) return;
    this.lastQuerySig = sig;
    const gen = ++this.fetchGen;
    this.loading.set(true);
    this.error.set('');
    this.billing.fetchTransactions(q, this.selectedProductType()).subscribe({
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

}
