import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MenuService } from '../../services/menu.service';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { TableService } from '../../services/table.service';
import { ThemeService } from '../../services/theme.service';
import { TableSessionService } from '../../services/table-session.service';
import { SignalRService } from '../../services/signalr.service';
import { FullMenuResponse, MenuCategory, MenuItem, CartItem, OrderResponse } from '../../models/api.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit, OnDestroy {
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
  sessionExpired = false;
  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private cartService: CartService,
    private orderService: OrderService,
    private tableService: TableService,
    public themeService: ThemeService,
    private sessionService: TableSessionService,
    private signalR: SignalRService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.paramMap.get('tableId') || '';

    // Initialize customer session for this table
    if (this.tableId) {
      this.sessionService.initSession(this.tableId);
    }

    this.subs.push(
      this.cartService.cart$.subscribe(items => {
        this.cartItems = items;
        this.cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
        this.cartTotal = this.cartService.getTotal();
      })
    );

    // Listen for session cleared (table cleared by admin)
    this.subs.push(
      this.sessionService.sessionCleared$.subscribe(cleared => {
        if (cleared) {
          this.sessionExpired = true;
          this.activeOrders = [];
          this.cartService.clearCart();
        }
      })
    );

    if (this.tableId) {
      this.loadTableOrders();
      this.listenForTableCleared();
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
    const sessionOrderIds = this.sessionService.getOrderIds();
    if (sessionOrderIds.length === 0) {
      this.activeOrders = [];
      return;
    }
    this.orderService.getOrdersByTable(this.tableId).subscribe({
      next: (orders) => {
        // Only show orders that belong to the current customer session
        this.activeOrders = orders.filter(o =>
          sessionOrderIds.includes(o.id) &&
          !['Completed', 'Cancelled'].includes(o.status)
        );
      },
      error: () => {}
    });
  }

  private async listenForTableCleared(): Promise<void> {
    if (!this.tenantId) return;
    await this.signalR.startConnection(this.tenantId);
    this.subs.push(
      this.signalR.tableCleared$.subscribe(data => {
        if (data.tableId === this.tableId) {
          this.sessionService.clearSession();
        }
      })
    );
  }

  startNewSession(): void {
    this.sessionExpired = false;
    this.sessionService.initSession(this.tableId);
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

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.signalR.stopConnection();
  }
}
