import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  BillingConfig,
  BillingProductType,
  BILLING_PRODUCT_TYPES,
  billingProductTypeIcon,
  billingProductTypeLabelKey,
  availableCredit,
  creditUtilisationPct,
  findBillingConfig,
} from '../../models/billing.model';

@Component({
  selector: 'app-billing-config-drawer',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './billing-config-drawer.component.html',
  styleUrl: './billing-config-drawer.component.scss',
})
export class BillingConfigDrawerComponent {
  private readonly billing = inject(BillingService);
  private readonly i18n = inject(TranslationService);

  readonly entityId = input.required<string>();
  readonly entityName = input<string>('');

  readonly closed = output<boolean>();

  readonly configs = signal<BillingConfig[]>([]);
  readonly selectedProductType = signal<BillingProductType>(BillingProductType.Sim);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  readonly productTypes = BILLING_PRODUCT_TYPES;
  readonly BillingProductType = BillingProductType;
  readonly findBillingConfig = findBillingConfig;
  readonly productTypeLabelKey = billingProductTypeLabelKey;
  readonly productTypeIcon = billingProductTypeIcon;

  yearlyAmount = 0;
  yearInDays = 365;
  taxRate = 18;
  creditLimit = 0;

  readonly config = computed(() =>
    findBillingConfig(this.configs(), this.selectedProductType()),
  );

  readonly utilisation = computed(() => {
    const c = this.config();
    return c ? creditUtilisationPct(c) : 0;
  });

  readonly available = computed(() => {
    const c = this.config();
    return c ? availableCredit(c) : 0;
  });

  readonly derivedDailyRate = computed(() => {
    if (this.yearInDays <= 0) return 0;
    return this.yearlyAmount / this.yearInDays;
  });

  constructor() {
    effect(() => {
      const eid = this.entityId();
      if (eid) this.fetch(eid);
    });
  }

  fetch(entityId?: string): void {
    const eid = entityId ?? this.entityId();
    if (!eid) return;
    this.loading.set(true);
    this.loadError.set('');
    this.billing.fetchConfig(eid).subscribe({
      next: (items) => {
        this.loading.set(false);
        this.configs.set(items);
        if (!findBillingConfig(items, this.selectedProductType()) && items.length) {
          this.selectedProductType.set(items[0].productType);
        }
        this.loadFormFromConfig(this.config());
      },
      error: (err) => {
        this.loading.set(false);
        this.configs.set([]);
        this.loadError.set(extractApiError(err, this.i18n.instant('billing.errors.loadConfig')));
      },
    });
  }

  selectProductType(type: BillingProductType): void {
    this.selectedProductType.set(type);
    const cfg = findBillingConfig(this.configs(), type);
    if (cfg) {
      this.loadFormFromConfig(cfg);
    } else {
      this.yearlyAmount = 0;
      this.yearInDays = 365;
      this.taxRate = 18;
      this.creditLimit = 0;
    }
    this.saveError.set('');
  }

  private loadFormFromConfig(cfg: BillingConfig | null): void {
    if (!cfg) return;
    this.yearlyAmount = cfg.yearlyAmount;
    this.yearInDays = cfg.yearInDays || 365;
    this.taxRate = cfg.taxRate;
    this.creditLimit = cfg.creditLimit;
  }

  close(refresh: boolean): void {
    if (this.saving()) return;
    this.closed.emit(refresh);
  }

  save(): void {
    if (this.saving()) return;
    if (this.yearInDays <= 0) {
      this.saveError.set(this.i18n.instant('billing.config.errors.days'));
      return;
    }
    if (this.yearlyAmount < 0 || this.taxRate < 0 || this.creditLimit < 0) {
      this.saveError.set(this.i18n.instant('billing.config.errors.negative'));
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    this.billing
      .updateConfig(this.entityId(), {
        productType: this.selectedProductType(),
        yearlyAmount: Number(this.yearlyAmount),
        yearInDays: Number(this.yearInDays),
        taxRate: Number(this.taxRate),
        creditLimit: Number(this.creditLimit),
      })
      .subscribe({
        next: (cfg) => {
          this.saving.set(false);
          this.configs.update((items) => {
            const idx = items.findIndex((item) => item.productType === cfg.productType);
            return idx >= 0
              ? items.map((item, i) => (i === idx ? cfg : item))
              : [...items, cfg];
          });
          this.loadFormFromConfig(cfg);
          this.closed.emit(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractApiError(err, this.i18n.instant('billing.config.errors.save')));
        },
      });
  }
}
