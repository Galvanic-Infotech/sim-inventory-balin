import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  templateUrl: './alert-dialog.component.html',
  styleUrl: './alert-dialog.component.scss',
})
export class AlertDialogComponent {
  readonly dialogTitleId = `alert-dialog-${Math.random().toString(36).slice(2, 9)}`;

  readonly open = input(false);
  readonly title = input('Alert');
  readonly message = input('');
  readonly confirmLabel = input('OK');
  readonly icon = input('info');

  readonly confirm = output<void>();
}
