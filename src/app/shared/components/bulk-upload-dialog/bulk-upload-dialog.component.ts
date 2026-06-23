import { Component, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../../core/services/device.service';
import { RbacService } from '../../../core/services/rbac.service';
import { extractApiError } from '../../../core/utils/api-error.util';
import { AisDeviceModel, SimCardProvider } from '../../models/rbac.model';

type ToastKind = 'success' | 'error' | 'info';

@Component({
  selector: 'app-bulk-upload-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.scss',
})
export class BulkUploadDialogComponent {
  private readonly devices = inject(DeviceService);
  private readonly rbac = inject(RbacService);

  readonly open = model(false);
  readonly uploaded = output<void>();

  readonly uploadFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly toast = signal<{ kind: ToastKind; message: string } | null>(null);

  readonly simProviders = signal<SimCardProvider[]>([]);
  readonly deviceModels = signal<AisDeviceModel[]>([]);
  readonly optionsLoading = signal(false);
  readonly optionsError = signal('');
  readonly simProviderId = signal('');
  readonly aisDeviceModelId = signal('');

  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadOptions();
      }
    });
  }

  close(): void {
    if (this.uploading()) return;
    this.open.set(false);
    this.resetForm();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile.set(input.files?.[0] ?? null);
    this.uploadError.set('');
  }

  canSubmit(): boolean {
    return !!(
      this.uploadFile()
      && this.simProviderId()
      && this.aisDeviceModelId()
      && !this.uploading()
      && !this.optionsLoading()
    );
  }

  submit(): void {
    const file = this.uploadFile();
    const simCardProviderId = this.simProviderId();
    const aisDeviceModelId = this.aisDeviceModelId();
    if (!file || !simCardProviderId || !aisDeviceModelId || this.uploading()) return;

    this.uploading.set(true);
    this.uploadError.set('');
    this.devices.uploadDevicesTxt(file, { simCardProviderId, aisDeviceModelId }).subscribe({
      next: () => {
        this.uploading.set(false);
        this.open.set(false);
        this.resetForm();
        this.showToast('success', 'Upload queued. Track progress under Jobs.');
        this.uploaded.emit();
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(extractApiError(err, 'Upload failed'));
      },
    });
  }

  dismissToast(): void {
    this.toast.set(null);
    clearTimeout(this.toastTimer);
  }

  private loadOptions(): void {
    this.optionsLoading.set(true);
    this.optionsError.set('');

    let providersDone = false;
    let modelsDone = false;
    const finish = () => {
      if (!providersDone || !modelsDone) return;
      this.optionsLoading.set(false);
    };

    this.rbac.getSimCardProviders({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        this.simProviders.set((res.data ?? []).filter((p) => p.isActive !== false));
        providersDone = true;
        finish();
      },
      error: () => {
        this.simProviders.set([]);
        providersDone = true;
        this.optionsError.set('Failed to load SIM providers');
        finish();
      },
    });

    this.rbac.getAisDeviceModels({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        this.deviceModels.set(res.data ?? []);
        modelsDone = true;
        finish();
      },
      error: () => {
        this.deviceModels.set([]);
        modelsDone = true;
        this.optionsError.set('Failed to load device models');
        finish();
      },
    });
  }

  private resetForm(): void {
    this.uploadFile.set(null);
    this.uploadError.set('');
    this.simProviderId.set('');
    this.aisDeviceModelId.set('');
  }

  private showToast(kind: ToastKind, message: string): void {
    this.toast.set({ kind, message });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }
}
