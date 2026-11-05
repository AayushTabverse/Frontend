import { Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MenuItem } from '../models/api.models';

/**
 * A dish's name in the current language, whatever language it was added to the cart in:
 * `{{ item.menuItem | localDish }}`. Impure so it follows language switches.
 */
@Pipe({ name: 'localDish', standalone: true, pure: false })
export class LocalDishPipe implements PipeTransform {
  constructor(private transloco: TranslocoService) {}

  transform(item: MenuItem): string {
    const lang = this.transloco.getActiveLang() as 'en' | 'hi' | 'gu';
    const english = item.baseName ?? item.name;
    if (lang === 'en') return english;
    return item.translations?.[lang]?.name || english;
  }
}
