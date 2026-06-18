import { ChangeDetectorRef, Pipe, PipeTransform, effect, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.i18n.revision();
      this.cdr.markForCheck();
    });
  }

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
