import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  readonly perm = inject(PermissionService);
  readonly canDeviceMapping = this.perm.canAny(PERMS.AIS_DEVICE_EDIT, PERMS.FITMENT_DEVICE_MAPPING);

  readonly open = input(false);
  readonly device = input<AisDevice | null>(null);

  readonly close = output<void>();
  readonly openRc = output<AisDevice>();

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
    this.close.emit();
  }

  onOpenRc(): void {
    const d = this.device();
    if (!d) return;
    this.openRc.emit(d);
  }
}
