import { Component, forwardRef, input, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [FormsModule, SelectModule],
  template: `
    <p-select
      [options]="options()"
      [optionLabel]="optionLabel()"
      [optionValue]="optionValue()"
      [filter]="filter()"
      [filterBy]="filterBy() || optionLabel()"
      [showClear]="showClear()"
      [placeholder]="placeholder()"
      [disabled]="disabled"
      [ngModel]="value"
      (ngModelChange)="handleChange($event)"
      (onBlur)="onTouched()"
      [styleClass]="'filter-select ' + styleClass()"
      [appendTo]="appendTo()"
    />
  `,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  readonly options = input<unknown[]>([]);
  readonly optionLabel = input<string>('label');
  readonly optionValue = input<string | undefined>(undefined);
  readonly filter = input<boolean>(true);
  readonly filterBy = input<string | undefined>(undefined);
  readonly showClear = input<boolean>(false);
  readonly placeholder = input<string>('');
  readonly styleClass = input<string>('');
  readonly appendTo = input<string | undefined>('body'); // avoid overflow clipping in table toolbars
  readonly valueChange = output<unknown>();

  value: unknown = null;
  disabled = false;
  onChange: (v: unknown) => void = () => {};
  onTouched: () => void = () => {};

  handleChange(v: unknown): void {
    this.value = v;
    this.onChange(v);
    this.valueChange.emit(v);
  }

  writeValue(v: unknown): void { this.value = v; }
  registerOnChange(fn: (v: unknown) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
}
