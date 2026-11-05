import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MenuTranslations } from '../models/api.models';
import { AuthService } from './auth.service';
import { MenuService } from './menu.service';

/**
 * Dish and category names in the staff member's language (kitchen, waiter, room service).
 * Orders store the English name; this looks up the restaurant's saved translation by id and
 * falls back to English when there is none.
 */
@Injectable({ providedIn: 'root' })
export class DishNameService {
  private static readonly REFRESH_MS = 5 * 60_000;

  private dishes = new Map<string, MenuTranslations>();
  private categories = new Map<string, MenuTranslations>();
  private loadedAt = 0;
  private loading = false;

  constructor(private menuService: MenuService, private auth: AuthService, private transloco: TranslocoService) {}

  dish(menuItemId: string | undefined, english: string): string {
    return this.pick(menuItemId ? this.dishes.get(menuItemId) : undefined, english);
  }

  category(categoryId: string | undefined, english: string): string {
    return this.pick(categoryId ? this.categories.get(categoryId) : undefined, english);
  }

  private pick(translations: MenuTranslations | undefined, english: string): string {
    const lang = this.transloco.getActiveLang();
    if (lang === 'en') return english;
    this.ensureLoaded();
    return translations?.[lang as 'hi' | 'gu']?.name || english;
  }

  /** Loads the menu's translations once, then refreshes every few minutes (dishes get added/edited). */
  private ensureLoaded(): void {
    const tenantId = this.auth.getTenantId();
    if (!tenantId || this.loading || Date.now() - this.loadedAt < DishNameService.REFRESH_MS) return;
    this.loading = true;
    this.menuService.getMenuByTenant(tenantId).subscribe({
      next: (menu) => {
        this.dishes.clear();
        this.categories.clear();
        for (const c of menu.categories) {
          if (c.translations) this.categories.set(c.id, c.translations);
          for (const i of c.items) if (i.translations) this.dishes.set(i.id, i.translations);
        }
        this.loadedAt = Date.now();
        this.loading = false;
      },
      error: () => { this.loading = false; this.loadedAt = Date.now() - DishNameService.REFRESH_MS + 30_000; }
    });
  }
}
