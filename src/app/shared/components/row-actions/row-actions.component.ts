import { Component, DestroyRef, ElementRef, HostListener, inject, input, signal } from '@angular/core';

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
  readonly menuPos = signal<{ top?: number; bottom?: number; left?: number; right?: number } | null>(
    null,
  );

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private static readonly MENU_MIN_WIDTH = 200;
  private static readonly MENU_MAX_HEIGHT = 360;
  private static readonly VIEWPORT_PAD = 8;
  private scrollCleanup?: () => void;

  constructor() {
    this.destroyRef.onDestroy(() => this.detachScrollClose());
  }

  toggle(ev?: Event): void {
    ev?.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    this.positionMenu();
    this.attachScrollClose();
    this.open.set(true);
  }

  close(): void {
    this.detachScrollClose();
    this.open.set(false);
    this.menuPos.set(null);
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

  @HostListener('window:resize')
  onResize(): void {
    if (this.open()) this.close();
  }

  private positionMenu(): void {
    const btn = this.host.nativeElement.querySelector('.row-actions__btn') as HTMLElement | null;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const itemCount = this.items().length;
    const estHeight = Math.min(
      RowActionsComponent.MENU_MAX_HEIGHT,
      itemCount * 38 + 12,
    );
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < estHeight + 16;
    this.dropUp.set(dropUp);

    const pos: { top?: number; bottom?: number; left?: number; right?: number } = {};
    const menuLeft = rect.right - RowActionsComponent.MENU_MIN_WIDTH;
    const menuRight = rect.right;

    if (menuLeft < RowActionsComponent.VIEWPORT_PAD) {
      pos.left = RowActionsComponent.VIEWPORT_PAD;
    } else if (menuRight > window.innerWidth - RowActionsComponent.VIEWPORT_PAD) {
      pos.right = RowActionsComponent.VIEWPORT_PAD;
    } else {
      pos.right = window.innerWidth - rect.right;
    }

    if (dropUp) {
      pos.bottom = window.innerHeight - rect.top + gap;
    } else {
      pos.top = rect.bottom + gap;
    }

    this.menuPos.set(pos);
  }

  private attachScrollClose(): void {
    this.detachScrollClose();
    const handler = () => {
      if (this.open()) this.close();
    };
    document.addEventListener('scroll', handler, true);
    this.scrollCleanup = () => document.removeEventListener('scroll', handler, true);
  }

  private detachScrollClose(): void {
    this.scrollCleanup?.();
    this.scrollCleanup = undefined;
  }
}
