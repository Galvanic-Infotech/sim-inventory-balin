import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';

export interface RowAction {
  /** Visible label */
  label: string;
  /** Material icon name */
  icon?: string;
  /** Optional CSS color override for the icon (e.g., 'var(--color-success)') */
  iconColor?: string;
  /** Renders a divider line above this item */
  dividerBefore?: boolean;
  /** Disable click + dim row */
  disabled?: boolean;
  /** Style as destructive (red) */
  danger?: boolean;
  /** Click handler */
  onClick: () => void;
}

@Component({
  selector: 'app-row-actions',
  standalone: true,
  templateUrl: './row-actions.component.html',
})
export class RowActionsComponent {
  /** Menu items in display order */
  readonly items = input.required<RowAction[]>();
  /** Optional aria label for the trigger button */
  readonly ariaLabel = input<string>('Row actions');

  readonly open = signal(false);
  readonly dropUp = signal(false);

  private readonly host = inject(ElementRef<HTMLElement>);
  private static readonly MENU_HEIGHT_ESTIMATE = 220;

  toggle(ev?: Event): void {
    ev?.stopPropagation();
    const next = !this.open();
    if (next) {
      const btn = this.host.nativeElement.querySelector('.row-actions__btn') as HTMLElement | null;
      const rect = btn?.getBoundingClientRect();
      const itemCount = this.items().length;
      const estHeight = Math.min(
        RowActionsComponent.MENU_HEIGHT_ESTIMATE,
        itemCount * 38 + 12,
      );
      const spaceBelow = rect ? window.innerHeight - rect.bottom : Infinity;
      this.dropUp.set(rect ? spaceBelow < estHeight + 16 : false);
    }
    this.open.set(next);
  }

  close(): void {
    this.open.set(false);
  }

  invoke(item: RowAction, ev: Event): void {
    ev.stopPropagation();
    if (item.disabled) return;
    this.close();
    item.onClick();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) this.close();
  }
}
