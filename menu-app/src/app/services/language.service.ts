import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export interface AppLanguage {
  code: 'en' | 'hi' | 'gu';
  /** Name in its own script, for the switcher. */
  label: string;
  short: string;
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिन्दी', short: 'हिं' },
  { code: 'gu', label: 'ગુજરાતી', short: 'ગુ' }
];

const STORAGE_KEY = 'tabverse.lang';

/**
 * The app's language: the one the user picked (remembered on this device), else the browser's if
 * we have it, else English. Each device chooses its own (a kitchen tablet can be in Hindi while
 * customers read Gujarati).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  constructor(private transloco: TranslocoService) {}

  init(): void {
    this.apply(this.saved() ?? this.fromBrowser() ?? 'en');
  }

  get current(): AppLanguage['code'] {
    return this.transloco.getActiveLang() as AppLanguage['code'];
  }

  set(code: AppLanguage['code']): void {
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
    this.apply(code);
  }

  private apply(code: string): void {
    this.transloco.setActiveLang(code);
    document.documentElement.lang = code;
  }

  private saved(): AppLanguage['code'] | null {
    try {
      const code = localStorage.getItem(STORAGE_KEY);
      return LANGUAGES.some(l => l.code === code) ? code as AppLanguage['code'] : null;
    } catch {
      return null;
    }
  }

  private fromBrowser(): AppLanguage['code'] | null {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const code = tag?.slice(0, 2).toLowerCase();
      const match = LANGUAGES.find(l => l.code === code);
      if (match) return match.code;
    }
    return null;
  }
}
