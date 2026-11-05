import { Pipe, PipeTransform } from '@angular/core';
import { DishNameService } from '../services/dish-name.service';

/**
 * Dish name in the current language: `{{ item.itemName | dishName: item.menuItemId }}`.
 * For a category: `{{ cat.name | dishName: cat.id : 'category' }}`.
 * Impure so it follows language switches and the translations arriving after load.
 */
@Pipe({ name: 'dishName', standalone: true, pure: false })
export class DishNamePipe implements PipeTransform {
  constructor(private names: DishNameService) {}

  transform(english: string, id?: string, kind: 'dish' | 'category' = 'dish'): string {
    return kind === 'category' ? this.names.category(id, english) : this.names.dish(id, english);
  }
}
