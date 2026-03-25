import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { TableService } from '../../services/table.service';
import { ThemeService } from '../../services/theme.service';
import { FullMenuResponse, MenuCategory, MenuItem, CartItem, OrderResponse } from '../../models/api.models';

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
  cartTotal = 0;
  cartItems: CartItem[] = [];
  loading = true;
  tenantId = '';
  tableId = '';
  callingWaiter = false;
  waiterCalled = false;
  activeOrders: OrderResponse[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private cartService: CartService,
    private orderService: OrderService,
    private tableService: TableService,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.paramMap.get('tableId') || '';

    this.cartService.cart$.subscribe(items => {
      this.cartItems = items;
      this.cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
      this.cartTotal = this.cartService.getTotal();
    });

    if (this.tableId) {
      this.loadTableOrders();
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

  loadTableOrders(): void {
    if (!this.tableId) return;
    this.orderService.getOrdersByTable(this.tableId).subscribe({
      next: (orders) => {
        this.activeOrders = orders.filter(o =>
          !['Completed', 'Cancelled'].includes(o.status)
        );
      },
      error: () => {}
    });
  }

  selectCategory(category: MenuCategory): void {
    this.selectedCategory = category;
  }

  getItemQuantity(item: MenuItem): number {
    const cartItem = this.cartItems.find(c => c.menuItem.id === item.id);
    return cartItem ? cartItem.quantity : 0;
  }

  addToCart(item: MenuItem): void {
    this.cartService.addItem(item);
  }

  incrementItem(item: MenuItem): void {
    this.cartService.addItem(item);
  }

  decrementItem(item: MenuItem): void {
    const qty = this.getItemQuantity(item);
    if (qty > 0) {
      this.cartService.updateQuantity(item.id, qty - 1);
    }
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

  viewOrders(): void {
    this.router.navigate(['/table-orders', this.tableId], {
      queryParams: { tenantId: this.tenantId }
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
