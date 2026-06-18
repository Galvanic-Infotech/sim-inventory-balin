import {
  Component,
  OnDestroy,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule, InputTextModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
})
export class SearchBarComponent implements OnDestroy {
  readonly placeholder = input<string>('Search...');
  readonly initialValue = input<string>('');
  readonly debounceMs = input<number>(300);
  readonly minLength = input<number>(0);
  readonly clearable = input<boolean>(true);
  readonly minWidth = input<string>('220px');

  readonly searchChange = output<string>();

  readonly raw = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  private lastEmitted = '';

  constructor() {
    effect(() => {
      const v = this.initialValue();
      this.raw.set(v);
      this.lastEmitted = v;
    });
  }

  onInput(value: string): void {
    this.raw.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emit(value), this.debounceMs());
  }

  clear(): void {
    if (!this.raw()) return;
    this.raw.set('');
    clearTimeout(this.timer);
    this.emit('');
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private emit(value: string): void {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < this.minLength()) return;
    if (trimmed === this.lastEmitted) return;
    this.lastEmitted = trimmed;
    this.searchChange.emit(trimmed);
  }
}
