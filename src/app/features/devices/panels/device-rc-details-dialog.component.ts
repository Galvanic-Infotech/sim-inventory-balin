import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FitmentService } from '../../../core/services/fitment.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { RcDetailsRequest } from '../../../shared/models/fitment.model';

const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'LPG'] as const;

const EMPTY_FORM: RcDetailsRequest = {
  rcNumber: '',
  registrationDate: '',
  vehiclesChasiNumber: '',
  vehicleEngineNumber: '',
  makerDescription: '',
  makerModel: '',
  manufacturingDateFormatted: '',
  fuelType: 'PETROL',
  ownerName: '',
  presentAddress: '',
  permanentAddress: '',
};

@Component({
  selector: 'app-device-rc-details-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './device-rc-details-dialog.component.html',
})
export class DeviceRcDetailsDialogComponent {
  private readonly fitment = inject(FitmentService);
  private readonly i18n = inject(TranslationService);

  readonly open = input(false);
  readonly serialNumber = input<string | null>(null);

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly fuelTypes = FUEL_TYPES;
  readonly form = signal<RcDetailsRequest>({ ...EMPTY_FORM });
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly showDeleteConfirm = signal(false);

  readonly canSubmit = computed(() => {
    const f = this.form();
    return (
      !!f.rcNumber.trim() &&
      !!f.registrationDate &&
      !!f.vehiclesChasiNumber.trim() &&
      !!f.vehicleEngineNumber.trim() &&
      !!f.makerDescription.trim() &&
      !!f.makerModel.trim() &&
      !!f.manufacturingDateFormatted &&
      !!f.fuelType &&
      !!f.ownerName.trim() &&
      !!f.presentAddress.trim() &&
      !!f.permanentAddress.trim() &&
      !this.saving() &&
      !this.deleting()
    );
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.set({ ...EMPTY_FORM });
        this.error.set('');
        this.showDeleteConfirm.set(false);
      }
    });
  }

  setField<K extends keyof RcDetailsRequest>(key: K, value: RcDetailsRequest[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  onClose(): void {
    if (this.saving() || this.deleting()) return;
    this.close.emit();
  }

  submit(): void {
    const serial = this.serialNumber();
    if (!serial || !this.canSubmit()) return;
    this.saving.set(true);
    this.error.set('');
    this.fitment.fillRcDetails(serial, this.form()).subscribe({
      next: (res) => {
        this.saving.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('devices.rcDetails.errors.saveFailed'));
        if (msg) {
          this.error.set(msg);
          return;
        }
        this.saved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(
          extractApiError(err, this.i18n.instant('devices.rcDetails.errors.saveFailed')),
        );
      },
    });
  }

  openDelete(): void {
    if (this.saving() || this.deleting()) return;
    this.error.set('');
    this.showDeleteConfirm.set(true);
  }

  closeDelete(): void {
    if (this.deleting()) return;
    this.showDeleteConfirm.set(false);
  }

  confirmDelete(): void {
    const serial = this.serialNumber();
    if (!serial) return;
    this.deleting.set(true);
    this.error.set('');
    this.fitment.deleteRcDetails(serial).subscribe({
      next: (res) => {
        this.deleting.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('devices.rcDetails.errors.deleteFailed'));
        if (msg) {
          this.error.set(msg);
          this.showDeleteConfirm.set(false);
          return;
        }
        this.showDeleteConfirm.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
        this.error.set(
          extractApiError(err, this.i18n.instant('devices.rcDetails.errors.deleteFailed')),
        );
      },
    });
  }
}
