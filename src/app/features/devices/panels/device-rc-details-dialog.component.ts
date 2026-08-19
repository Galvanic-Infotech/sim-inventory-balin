import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FitmentService } from '../../../core/services/fitment.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { RcDetailsRequest } from '../../../shared/models/fitment.model';

const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG ONLY', 'ELECTRIC', 'HYBRID', 'LPG'] as const;

function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  const idx = v.indexOf('T');
  return idx > 0 ? v.slice(0, idx) : v;
}

function toMonthFirstDay(v: string | null | undefined): string {
  if (!v) return '';
  const idx = v.indexOf('T');
  const datePart = idx > 0 ? v.slice(0, idx) : v;
  const m = /^(\d{4}-\d{2})/.exec(datePart);
  return m ? `${m[1]}-01` : datePart;
}

function toMonthInput(v: string | null | undefined): string {
  if (!v) return '';
  return v.slice(0, 7);
}

const EMPTY_FORM: RcDetailsRequest = {
  rcNumber: '',
  registrationDate: '',
  vehiclesChasiNumber: '',
  vehicleEngineNumber: '',
  makerDescription: '',
  makerModel: '',
  mobileNumber: '',
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
  styles: [`
    .rc-field-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      margin-bottom: var(--space-xs);
    }
    .rc-fetch-btn {
      padding: var(--space-xs) var(--space-sm);
      font-size: var(--font-xs);
      gap: var(--space-xs);
    }
    .rc-fetch-btn .material-icons { font-size: 16px; }
  `],
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
  readonly loading = signal(false);
  readonly vahanLoading = signal(false);
  readonly hasExisting = signal(false);
  readonly error = signal('');
  readonly showDeleteConfirm = signal(false);

  readonly canFetchVahan = computed(() => {
    const rc = this.form().rcNumber.trim();
    return rc.length >= 6 && !this.vahanLoading() && !this.saving() && !this.deleting() && !this.loading();
  });

  readonly canSubmit = computed(() => {
    const f = this.form();
    return (
      !!f.rcNumber.trim() &&
      !!f.registrationDate &&
      !!f.vehiclesChasiNumber.trim() &&
      !!f.vehicleEngineNumber.trim() &&
      !!f.makerDescription.trim() &&
      !!f.makerModel.trim() &&
      /^\d{10}$/.test(f.mobileNumber.trim()) &&
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
      const open = this.open();
      const serial = this.serialNumber();
      if (open) {
        this.form.set({ ...EMPTY_FORM });
        this.error.set('');
        this.showDeleteConfirm.set(false);
        this.hasExisting.set(false);
        if (serial) this.fetchExisting(serial);
      }
    });
  }

  private fetchExisting(serial: string): void {
    this.loading.set(true);
    this.fitment.getVehicleDetails(serial).subscribe({
      next: (res) => {
        this.loading.set(false);
        const vd = res.data?.vehicleDetails;
        if (!vd || !vd.rcNumber) return;
        this.hasExisting.set(true);
        this.form.set({
          rcNumber: vd.rcNumber ?? '',
          registrationDate: toDateInput(vd.registrationDate),
          vehiclesChasiNumber: vd.vehiclesChasiNumber ?? '',
          vehicleEngineNumber: vd.vehicleEngineNumber ?? '',
          makerDescription: vd.makerDescription ?? '',
          makerModel: vd.makerModel ?? '',
          mobileNumber: vd.mobileNumber ?? '',
          manufacturingDateFormatted: toMonthFirstDay(vd.manufacturingDateFormatted),
          fuelType: vd.fuelType ?? 'PETROL',
          ownerName: vd.ownerName ?? '',
          presentAddress: vd.presentAddress ?? '',
          permanentAddress: vd.permanentAddress ?? '',
        });
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setField<K extends keyof RcDetailsRequest>(key: K, value: RcDetailsRequest[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  setRcNumber(value: string): void {
    const sanitized = (value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    this.form.update((f) => ({ ...f, rcNumber: sanitized }));
  }

  onRcKeyPress(e: KeyboardEvent): void {
    if (e.key.length === 1 && !/^[A-Za-z0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  }

  onRcPaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData('text') ?? '';
    e.preventDefault();
    const sanitized = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (sanitized) {
      this.form.update((f) => ({ ...f, rcNumber: (f.rcNumber + sanitized).slice(0, 20) }));
    }
  }

  fetchFromVahan(): void {
    const rc = this.form().rcNumber.trim().toUpperCase();
    if (!rc || !this.canFetchVahan()) return;
    this.vahanLoading.set(true);
    this.error.set('');
    this.fitment.fetchRcFromVahan(rc).subscribe({
      next: (res) => {
        this.vahanLoading.set(false);
        const msg = getApiResponseError(res, this.i18n.instant('devices.rcDetails.errors.fetchVahanFailed'));
        if (msg) {
          this.error.set(msg);
          return;
        }
        const d = res.data;
        if (!d) {
          this.error.set(this.i18n.instant('devices.rcDetails.errors.fetchVahanFailed'));
          return;
        }
        this.form.update((f) => ({
          ...f,
          rcNumber: d.rcNumber ?? f.rcNumber,
          registrationDate: toDateInput(d.registrationDate),
          vehiclesChasiNumber: d.vehiclesChasiNumber ?? '',
          vehicleEngineNumber: d.vehicleEngineNumber ?? '',
          makerDescription: d.makerDescription ?? '',
          makerModel: d.makerModel ?? '',
          mobileNumber: d.mobileNumber || f.mobileNumber,
          manufacturingDateFormatted: toMonthFirstDay(d.manufacturingDateFormatted),
          fuelType: d.fuelType || 'PETROL',
          ownerName: d.ownerName ?? '',
          presentAddress: d.presentAddress ?? '',
          permanentAddress: d.permanentAddress ?? '',
        }));
      },
      error: (err) => {
        this.vahanLoading.set(false);
        this.error.set(
          extractApiError(err, this.i18n.instant('devices.rcDetails.errors.fetchVahanFailed')),
        );
      },
    });
  }

  setMonth(key: 'manufacturingDateFormatted', value: string): void {
    const next = value ? `${value}-01` : '';
    this.form.update((f) => ({ ...f, [key]: next }));
  }

  monthValue(key: 'manufacturingDateFormatted'): string {
    return toMonthInput(this.form()[key]);
  }

  dateValue(key: 'registrationDate'): string {
    return toDateInput(this.form()[key]);
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
