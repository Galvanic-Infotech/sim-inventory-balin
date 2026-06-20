import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BillingProductType, BILLING_PRODUCT_TYPES } from '../../models/billing.model';

@Component({
  selector: 'app-billing-credit-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './billing-credit-dialog.component.html',
})
export class BillingCreditDialogComponent {
  private readonly billing = inject(BillingService);
  private readonly i18n = inject(TranslationService);

  readonly entityId = input.required<string>();
  readonly entityName = input<string>('');

  readonly closed = output<boolean>();

  readonly productTypes = BILLING_PRODUCT_TYPES;
  readonly BillingProductType = BillingProductType;
  productType: BillingProductType = BillingProductType.Sim;

  amount: number | null = null;
  notes = '';
  readonly saving = signal(false);
  readonly error = signal('');

  close(saved: boolean): void {
    if (this.saving()) return;
    this.closed.emit(saved);
  }

  submit(): void {
    if (this.saving()) return;
    const amount = Number(this.amount);
    if (!amount || amount <= 0) {
      this.error.set(this.i18n.instant('billing.credit.errors.amount'));
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.billing
      .addCredit(this.entityId(), { amount, notes: this.notes.trim() }, this.productType)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closed.emit(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(extractApiError(err, this.i18n.instant('billing.credit.errors.save')));
        },
      });
  }
}
