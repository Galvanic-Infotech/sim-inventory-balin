import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChildren,
  QueryList,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-otp-boxes',
  standalone: true,
  templateUrl: './otp-boxes.component.html',
  styleUrl: './otp-boxes.component.scss',
})
export class OtpBoxesComponent implements AfterViewInit {
  readonly length = input(6);
  readonly disabled = input(false);
  readonly autofocus = input(true);
  readonly value = model<string>('');
  readonly complete = output<string>();

  @ViewChildren('box') boxes!: QueryList<ElementRef<HTMLInputElement>>;

  readonly digits = signal<string[]>([]);

  constructor() {
    effect(() => {
      const len = this.length();
      const v = this.value() ?? '';
      const next = Array.from({ length: len }, (_, i) => v[i] ?? '');
      this.digits.set(next);
    });
  }

  ngAfterViewInit(): void {
    if (this.autofocus()) {
      queueMicrotask(() => this.focusBox(0));
    }
  }

  readonly indices = (): number[] =>
    Array.from({ length: this.length() }, (_, i) => i);

  onInput(i: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');

    if (raw.length > 1) {
      this.fillFrom(i, raw);
      return;
    }

    const next = [...this.digits()];
    next[i] = raw;
    this.digits.set(next);
    this.emitValue();

    if (raw && i < this.length() - 1) {
      this.focusBox(i + 1);
    }
  }

  onKeyDown(i: number, e: KeyboardEvent): void {
    const current = this.digits()[i] ?? '';
    if (e.key === 'Backspace') {
      if (!current && i > 0) {
        e.preventDefault();
        const next = [...this.digits()];
        next[i - 1] = '';
        this.digits.set(next);
        this.emitValue();
        this.focusBox(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      this.focusBox(i - 1);
    } else if (e.key === 'ArrowRight' && i < this.length() - 1) {
      e.preventDefault();
      this.focusBox(i + 1);
    }
  }

  onPaste(i: number, e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '');
    if (!digits) return;
    this.fillFrom(i, digits);
  }

  private fillFrom(start: number, digits: string): void {
    const next = [...this.digits()];
    let cursor = start;
    for (const d of digits) {
      if (cursor >= this.length()) break;
      next[cursor++] = d;
    }
    this.digits.set(next);
    this.emitValue();
    const focusIdx = Math.min(cursor, this.length() - 1);
    this.focusBox(focusIdx);
  }

  private focusBox(i: number): void {
    const el = this.boxes?.toArray()[i]?.nativeElement;
    el?.focus();
    el?.select();
  }

  private emitValue(): void {
    const joined = this.digits().join('');
    this.value.set(joined);
    if (joined.length === this.length() && !joined.includes('')) {
      this.complete.emit(joined);
    }
  }
}
