import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimService } from '../../core/services/sim.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import {
  SimInventoryItem,
  formatValidTill,
} from '../../shared/models/sim-inventory.model';

@Component({
  selector: 'app-sim-inventory-edit-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './activate-dialog.component.html',
})
export class ActivateDialogComponent {
  private readonly sim = inject(SimService);
  private readonly i18n = inject(TranslationService);

  readonly targets = input.required<SimInventoryItem[]>();
  readonly closed = output<boolean>();

  readonly isSingle = computed(() => this.targets().length === 1);

  readonly validTill = signal('');
  readonly customerName = signal('');
  readonly iotId = signal('');
  readonly remarks = signal('');
  readonly isSaving = signal(false);
  readonly errorMsg = signal('');

  readonly minDate = formatValidTill(new Date());

  constructor() {
    queueMicrotask(() => {
      const list = this.targets();
      if (list.length === 1) {
        const t = list[0];
        this.customerName.set(t.customerName ?? '');
        this.iotId.set(t.iotId ?? '');
        this.remarks.set(t.remarks ?? '');
        if (t.validTill) {
          const d = new Date(t.validTill);
          if (!Number.isNaN(d.getTime())) {
            this.validTill.set(formatValidTill(d));
            return;
          }
        }
      }
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      this.validTill.set(formatValidTill(oneYearFromNow));
    });
  }

  close(refresh: boolean): void {
    if (this.isSaving()) return;
    this.closed.emit(refresh);
  }

  submit(): void {
    if (this.isSaving()) return;
    const validTill = this.validTill().trim();
    if (!validTill) {
      this.errorMsg.set(this.i18n.instant('simInventory.edit.errors.validTill'));
      return;
    }
    const list = this.targets();
    if (list.length === 0) return;
    const single = list.length === 1;
    const remarks = this.remarks().trim();
    const customerName = this.customerName().trim();
    const iotId = this.iotId().trim();

    const payload = list.map((it) => ({
      itemId: it.itemId,
      customerName: single ? customerName : it.customerName ?? '',
      remarks: single ? remarks : remarks || (it.remarks ?? ''),
      iotId: single ? iotId : it.iotId ?? '',
      validTill,
    }));

    this.errorMsg.set('');
    this.isSaving.set(true);
    this.sim.updateSimInventory(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closed.emit(true);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMsg.set(
          extractApiError(err, this.i18n.instant('simInventory.edit.errors.generic')),
        );
      },
    });
  }
}
