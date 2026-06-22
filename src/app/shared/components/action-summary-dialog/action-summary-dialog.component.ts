import { Component, input, output } from '@angular/core';

export interface ActionSummaryRow {
  label: string;
  value: string;
}

export interface ActionSummaryDevice {
  uid: string;
  imei?: string;
  iccid?: string;
  status?: string;
}

@Component({
  selector: 'app-action-summary-dialog',
  standalone: true,
  templateUrl: './action-summary-dialog.component.html',
  styleUrl: './action-summary-dialog.component.scss',
})
export class ActionSummaryDialogComponent {
  readonly dialogTitleId = `action-summary-${Math.random().toString(36).slice(2, 9)}`;

  readonly open = input(false);
  readonly title = input('Confirm action');
  readonly confirmLabel = input('Confirm');
  readonly loading = input(false);
  readonly rows = input<ActionSummaryRow[]>([]);
  readonly devices = input<ActionSummaryDevice[]>([]);
  readonly devicesLabel = input('Selected devices');
  readonly error = input('');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    if (this.loading()) return;
    this.confirm.emit();
  }
}
