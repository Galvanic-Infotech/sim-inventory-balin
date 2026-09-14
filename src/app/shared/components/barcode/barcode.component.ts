import { Component, ElementRef, effect, input, viewChild } from '@angular/core';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-barcode',
  standalone: true,
  template: `
    <figure class="barcode">
      @if (label()) {
        <figcaption class="barcode__label">{{ label() }}</figcaption>
      }
      <svg #svg class="barcode__svg"></svg>
    </figure>
  `,
  styles: `
    .barcode {
      margin: 0;
      padding: var(--space-sm);
      // ponytail: white bg + black bars are scanner contrast requirements, not theme colors
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .barcode__label {
      font-size: var(--font-xs);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-xs);
    }
    .barcode__svg {
      display: block;
      width: 100%;
      height: auto;
    }
  `,
})
export class BarcodeComponent {
  readonly value = input.required<string>();
  readonly label = input('');

  private readonly svg = viewChild.required<ElementRef<SVGElement>>('svg');

  constructor() {
    effect(() => {
      const value = this.value()?.trim();
      const el = this.svg().nativeElement;
      if (!value || value === '—') {
        el.innerHTML = '';
        return;
      }
      JsBarcode(el, value, {
        format: 'CODE128',
        lineColor: '#000',
        background: '#fff',
        width: 2,
        height: 48,
        margin: 0,
        fontSize: 14,
        font: 'monospace',
        textMargin: 4,
      });
    });
  }
}
