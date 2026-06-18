import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  BillingConfig,
  availableCredit,
  creditUtilisationPct,
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

  readonly config = signal<BillingConfig | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  yearlyAmount = 0;
  yearInDays = 365;
  taxRate = 18;
  creditLimit = 0;

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
      next: (cfg) => {
        this.loading.set(false);
        this.config.set(cfg);
        this.yearlyAmount = cfg.yearlyAmount;
        this.yearInDays = cfg.yearInDays || 365;
        this.taxRate = cfg.taxRate;
        this.creditLimit = cfg.creditLimit;
      },
      error: (err) => {
        this.loading.set(false);
        this.config.set(null);
        this.loadError.set(extractApiError(err, this.i18n.instant('billing.errors.loadConfig')));
      },
    });
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
        yearlyAmount: Number(this.yearlyAmount),
        yearInDays: Number(this.yearInDays),
        taxRate: Number(this.taxRate),
        creditLimit: Number(this.creditLimit),
      })
      .subscribe({
        next: (cfg) => {
          this.saving.set(false);
          this.config.set(cfg);
          this.closed.emit(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractApiError(err, this.i18n.instant('billing.config.errors.save')));
        },
      });
  }
}
