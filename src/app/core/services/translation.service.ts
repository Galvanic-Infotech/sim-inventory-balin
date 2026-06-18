import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { STORAGE_KEYS } from '../constants/api.constants';

export type AppLang = 'en' | 'hi';

export const SUPPORTED_LANGS: { code: AppLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
];

type Dict = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);

  readonly lang = signal<AppLang>(this.readSavedLang());
  /** Bumps when dictionary content changes — keeps translate pipe in sync. */
  readonly revision = signal(0);

  private dict: Dict = {};
  private loadGen = 0;

  async init(): Promise<void> {
    await this.load(this.lang());
  }

  setLang(code: AppLang): void {
    if (code === this.lang()) return;
    localStorage.setItem(STORAGE_KEYS.LANG, code);
    this.lang.set(code);
    void this.load(code);
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const raw = this.lookup(key);
    if (raw === undefined) return key;
    return this.interpolate(raw, params);
  }

  instant(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
  }

  private async load(code: AppLang): Promise<void> {
    const gen = ++this.loadGen;
    try {
      const data = await firstValueFrom(this.http.get<Dict>(`/assets/i18n/${code}.json`));
      if (gen !== this.loadGen) return;
      this.dict = data;
    } catch {
      if (gen !== this.loadGen) return;
      if (code !== 'en') {
        try {
          const fallback = await firstValueFrom(this.http.get<Dict>('/assets/i18n/en.json'));
          if (gen !== this.loadGen) return;
          this.dict = fallback;
        } catch {
          return;
        }
      }
    } finally {
      if (gen === this.loadGen) {
        this.revision.update((v) => v + 1);
      }
    }
  }

  private lookup(key: string): string | undefined {
    const parts = key.split('.');
    let node: unknown = this.dict;
    for (const part of parts) {
      if (!node || typeof node !== 'object') return undefined;
      node = (node as Dict)[part];
    }
    return typeof node === 'string' ? node : undefined;
  }

  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
  }

  private readSavedLang(): AppLang {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    return saved === 'hi' ? 'hi' : 'en';
  }
}
