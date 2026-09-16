import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DeviceService } from '../../../core/services/device.service';
import { extractApiError, getApiResponseError } from '../../../core/utils/api-error.util';
import { PermissionService, PERMS } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { translatedItemStatusMeta } from '../../../core/utils/item-status-i18n.util';
import { AisDevice } from '../../../shared/models/device.model';

@Component({
  selector: 'app-device-details-drawer',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './device-details-drawer.component.html',
  styleUrl: './device-details-drawer.component.scss',
})
export class DeviceDetailsDrawerComponent {
  private readonly i18n = inject(TranslationService);
  private readonly devices = inject(DeviceService);
  readonly perm = inject(PermissionService);
  readonly canDeviceMapping = this.perm.canAny(PERMS.AIS_DEVICE_EDIT, PERMS.FITMENT_DEVICE_MAPPING);

  readonly open = input(false);
  readonly device = input<AisDevice | null>(null);

  readonly close = output<void>();
  readonly openRc = output<AisDevice>();
  readonly updated = output<void>();

  readonly confirmValidity = signal(false);
  readonly validityLoading = signal(false);
  readonly validityError = signal('');
  readonly validitySuccess = signal('');
  private successHandle: ReturnType<typeof setTimeout> | null = null;

  readonly statusMeta = computed(() => {
    this.i18n.lang();
    this.i18n.revision();
    const d = this.device();
    if (!d) return null;
    return translatedItemStatusMeta(String(d.status), (k) => this.i18n.instant(k));
  });

  readonly canShowRcButton = computed(() => {
    const d = this.device();
    return this.canDeviceMapping() && !!d?.serialNumber;
  });

  onClose(): void {
    this.resetValidityUi();
    this.close.emit();
  }

  onValidityUpdate(): void {
    this.validityError.set('');
    this.validitySuccess.set('');
    if (!this.device()?.serialNumber) {
      this.validityError.set(this.i18n.instant('devices.details.validityNoSerial'));
      return;
    }
    this.confirmValidity.set(true);
  }

  cancelValidityUpdate(): void {
    if (this.validityLoading()) return;
    this.confirmValidity.set(false);
    this.validityError.set('');
  }

  confirmValidityUpdate(): void {
    const sno = this.device()?.serialNumber?.trim();
    if (!sno || this.validityLoading()) return;

    this.validityLoading.set(true);
    this.validityError.set('');
    this.devices.updateValidity(sno).subscribe({
      next: (res) => {
        this.validityLoading.set(false);
        const fail = getApiResponseError(res, this.i18n.instant('devices.details.validityFailed'));
        if (fail) {
          this.validityError.set(fail);
          return;
        }
        this.confirmValidity.set(false);
        this.validitySuccess.set(
          res.message || this.i18n.instant('devices.details.validitySuccess'),
        );
        this.updated.emit();
        if (this.successHandle != null) clearTimeout(this.successHandle);
        this.successHandle = setTimeout(() => this.validitySuccess.set(''), 4000);
      },
      error: (err) => {
        this.validityLoading.set(false);
        this.validityError.set(
          extractApiError(err, this.i18n.instant('devices.details.validityFailed')),
        );
      },
    });
  }

  private resetValidityUi(): void {
    this.confirmValidity.set(false);
    this.validityLoading.set(false);
    this.validityError.set('');
    this.validitySuccess.set('');
    if (this.successHandle != null) {
      clearTimeout(this.successHandle);
      this.successHandle = null;
    }
  }

  onOpenRc(): void {
    const d = this.device();
    if (!d) return;
    this.openRc.emit(d);
  }
}
