import { Component, computed, inject, signal } from '@angular/core';
import { AppLang, SUPPORTED_LANGS, TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="lang-dropdown">
      <button
        type="button"
        class="lang-dropdown-btn"
        [attr.aria-label]="'common.language' | translate"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
      >
        <span class="material-icons lang-dropdown-icon">language</span>
        <span class="lang-dropdown-label">{{ currentLabel() }}</span>
        <span class="material-icons lang-dropdown-arrow">expand_more</span>
      </button>

      @if (open()) {
        <div class="lang-dropdown-backdrop" (click)="open.set(false)"></div>
        <div class="lang-dropdown-menu" role="listbox">
          @for (lang of supportedLangs; track lang.code) {
            <button
              type="button"
              role="option"
              class="lang-dropdown-option"
              [class.active]="i18n.lang() === lang.code"
              [attr.aria-selected]="i18n.lang() === lang.code"
              (click)="setLang(lang.code)"
            >
              <span class="lang-dropdown-option-label">{{ lang.label }}</span>
              @if (i18n.lang() === lang.code) {
                <span class="material-icons lang-dropdown-check">check</span>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class LangSwitcherComponent {
  readonly i18n = inject(TranslationService);
  readonly supportedLangs = SUPPORTED_LANGS;
  readonly open = signal(false);

  readonly currentLabel = computed(
    () => this.supportedLangs.find((l) => l.code === this.i18n.lang())?.label ?? this.i18n.lang(),
  );

  toggle(): void {
    this.open.update((v) => !v);
  }

  setLang(code: AppLang): void {
    this.i18n.setLang(code);
    this.open.set(false);
  }
}
