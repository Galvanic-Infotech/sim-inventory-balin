import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BillingProductType, BILLING_PRODUCT_TYPES, billingProductTypeLabelKey } from '../../models/billing.model';

@Component({
  selector: 'app-billing-generate-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './billing-generate-dialog.component.html',
})
export class BillingGenerateDialogComponent {
  private readonly billing = inject(BillingService);
  private readonly i18n = inject(TranslationService);

  /** Sent via per-request X-Entity-ID; current app entity is not changed. */
  readonly entityId = input.required<string>();
  readonly entityName = input<string>('');

  readonly closed = output<boolean>();

  readonly productTypes = BILLING_PRODUCT_TYPES;
  readonly BillingProductType = BillingProductType;
  readonly productTypeLabelKey = billingProductTypeLabelKey;
  productType: BillingProductType = BillingProductType.Sim;

  date = this.defaultDate();
  readonly maxDate = this.defaultDate();
  readonly saving = signal(false);
  readonly error = signal('');
  readonly successMsg = signal('');

  close(saved: boolean): void {
    if (this.saving()) return;
    this.closed.emit(saved);
  }

  submit(): void {
    if (this.saving()) return;
    const date = this.date?.trim();
    if (!date) {
      this.error.set(this.i18n.instant('billing.generate.errors.date'));
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.successMsg.set('');
    this.billing.generateBill(date, this.entityId(), this.productType).subscribe({
      next: (msg) => {
        this.saving.set(false);
        this.successMsg.set(msg);
        setTimeout(() => this.closed.emit(true), 700);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(extractApiError(err, this.i18n.instant('billing.generate.errors.save')));
      },
    });
  }

  private defaultDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = String(d.getFullYear()).padStart(4, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
