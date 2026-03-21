import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { TableService } from '../../services/table.service';
import { ThemeService } from '../../services/theme.service';
import { FullMenuResponse, MenuCategory, MenuItem } from '../../models/api.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit {
  menu?: FullMenuResponse;
  selectedCategory?: MenuCategory;
  cartCount = 0;
  loading = true;
  tenantId = '';
  tableId = '';
  callingWaiter = false;
  waiterCalled = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private cartService: CartService,
    private tableService: TableService,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.paramMap.get('tableId') || '';

    this.cartService.cart$.subscribe(items => {
      this.cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
    });

    if (this.tableId) {
      this.menuService.getMenuByTable(this.tableId).subscribe({
        next: (menu) => {
          this.menu = menu;
          this.tenantId = menu.tenantId;
          if (menu.categories.length > 0) {
            this.selectedCategory = menu.categories[0];
          }
          this.loading = false;
        },
        error: () => this.loading = false
      });
    } else if (this.tenantId) {
      this.menuService.getMenuByTenant(this.tenantId).subscribe({
        next: (menu) => {
          this.menu = menu;
          if (menu.categories.length > 0) {
            this.selectedCategory = menu.categories[0];
          }
          this.loading = false;
        },
        error: () => this.loading = false
      });
    }
  }

  selectCategory(category: MenuCategory): void {
    this.selectedCategory = category;
  }

  addToCart(item: MenuItem): void {
    this.cartService.addItem(item);
  }

  viewAR(item: MenuItem): void {
    this.router.navigate(['/ar', item.id], {
      queryParams: { model: item.arModelUrl, name: item.name }
    });
  }

  goToCart(): void {
    this.router.navigate(['/cart'], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }

  callWaiter(): void {
    if (!this.tableId || this.callingWaiter) return;
    this.callingWaiter = true;
    this.tableService.callWaiter(this.tableId).subscribe({
      next: () => {
        this.waiterCalled = true;
        this.callingWaiter = false;
        setTimeout(() => this.waiterCalled = false, 5000);
      },
      error: () => this.callingWaiter = false
    });
  }
}
