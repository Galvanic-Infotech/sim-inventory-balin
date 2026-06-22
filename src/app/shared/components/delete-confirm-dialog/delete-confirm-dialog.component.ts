import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delete-confirm-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './delete-confirm-dialog.component.html',
  styleUrl: './delete-confirm-dialog.component.scss',
})
export class DeleteConfirmDialogComponent {
  readonly dialogTitleId = `delete-confirm-${Math.random().toString(36).slice(2, 9)}`;

  readonly open = input(false);
  readonly title = input('Confirm deletion');
  readonly message = input('This action cannot be undone.');
  readonly targetName = input<string | null>(null);
  readonly confirmLabel = input('Delete');
  readonly loading = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly typed = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.typed.set('');
      }
    });
  }

  onCancel(): void {
    this.typed.set('');
    this.cancel.emit();
  }

  onConfirm(): void {
    if (this.typed() !== 'DELETE' || this.loading()) return;
    this.confirm.emit();
  }
}
