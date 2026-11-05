import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLanguage, LANGUAGES, LanguageService } from '../../../services/language.service';

/** Compact language picker (EN · हिं · ગુ). */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-switch" role="group" aria-label="Language">
      <button *ngFor="let l of languages" type="button"
              [class.active]="l.code === languageService.current"
              [attr.aria-pressed]="l.code === languageService.current"
              [attr.lang]="l.code"
              [title]="l.label"
              (click)="languageService.set(l.code)">{{ compact ? l.short : l.label }}</button>
    </div>
  `,
  styles: [`
    .lang-switch {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      border-radius: 999px;
      background: var(--ui-surface-muted, rgba(0, 0, 0, 0.05));
    }
    button {
      min-width: 34px;
      padding: 4px 9px;
      border: none;
      border-radius: 999px;
      background: none;
      color: var(--ui-text-2, #4b5563);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    button.active {
      background: var(--ui-surface-solid, #fff);
      color: var(--ui-text, #1f2937);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    }
  `]
})
export class LanguageSwitcherComponent {
  /** Short labels (EN · हिं · ગુ) for tight headers. */
  @Input() compact = true;

  readonly languages: AppLanguage[] = LANGUAGES;

  constructor(public languageService: LanguageService) {}
}
