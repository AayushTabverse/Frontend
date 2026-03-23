import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TableService } from '../services/table.service';
import { MenuService } from '../services/menu.service';
import { OrderService } from '../services/order.service';
import { AuthService } from '../services/auth.service';
import { SignalRService } from '../services/signalr.service';
import { ThemeService } from '../services/theme.service';
import { SettingsService } from '../services/settings.service';
import {
  TableResponse, MenuCategory, MenuItem,
  CreateOrderRequest, CreateOrderItemRequest,
  OrderResponse, OrderItemResponse, LiveOrdersResponse, TableSessionSummary
} from '../models/api.models';
import { Subscription } from 'rxjs';

interface WaiterCartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface MergedBillItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Component({
  selector: 'app-waiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './waiter-dashboard.component.html',
  styleUrl: './waiter-dashboard.component.scss'
})
export class WaiterDashboardComponent implements OnInit, OnDestroy {
  // ── State ──
  activeTab: 'tables' | 'orders' = 'tables';

  // Tables
  tables: TableResponse[] = [];
  selectedTable: TableResponse | null = null;

  // Table Session (existing orders for selected table)
  tableSession: TableSessionSummary | null = null;
  sessionLoading = false;

  // Menu
  categories: MenuCategory[] = [];
  activeCategory: string | null = null;
  showMenu = false;

  // Cart (new items to add)
  cart: WaiterCartItem[] = [];
  specialInstructions = '';

  // Orders
  liveOrders?: LiveOrdersResponse;
  ordersLoading = true;

  // Bill / Clear
  showBillSummary = false;
  billSummary: TableSessionSummary | null = null;
  mergedBillItems: MergedBillItem[] = [];
  clearing = false;
  restaurantName = '';

  // General
  loading = false;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  userName = '';
  isAdmin = false;
  sidebarCollapsed = false;

  statusOptions = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served', 'Completed'];
  confirmCancelItemId: string | null = null;
  cancellingItemId: string | null = null;
  private subs: Subscription[] = [];

  constructor(
    private tableService: TableService,
    private menuService: MenuService,
    private orderService: OrderService,
    private authService: AuthService,
    private signalR: SignalRService,
    private settingsService: SettingsService,
    public themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.userName = user?.fullName || 'Staff';
    });
    this.isAdmin = this.authService.isAdmin();
    this.loadTables();
    this.loadOrders();
    this.loadRestaurantName();
    this.setupRealTime();
  }

  // ── Tables ──

  loadTables(): void {
    this.loading = true;
    this.tableService.getTables().subscribe({
      next: (tables) => { this.tables = tables; this.loading = false; },
      error: () => this.loading = false
    });
  }

  selectTable(table: TableResponse): void {
    this.selectedTable = table;
    this.cart = [];
    this.specialInstructions = '';
    this.showBillSummary = false;
    this.billSummary = null;
    this.loadTableSession(table.id);
    this.loadMenu();
  }

  deselectTable(): void {
    this.selectedTable = null;
    this.showMenu = false;
    this.cart = [];
    this.categories = [];
    this.specialInstructions = '';
    this.tableSession = null;
    this.showBillSummary = false;
    this.billSummary = null;
    this.loadTables(); // Refresh table statuses
  }

  // ── Table Session ──

  loadTableSession(tableId: string): void {
    this.sessionLoading = true;
    this.orderService.getTableSession(tableId).subscribe({
      next: (session) => { this.tableSession = session; this.sessionLoading = false; },
      error: () => this.sessionLoading = false
    });
  }

  // ── Menu ──

  loadMenu(): void {
    this.showMenu = true;
    const tenantId = this.authService.getTenantId();
    if (!tenantId) return;

    this.menuService.getMenuByTenant(tenantId).subscribe({
      next: (menu) => {
        this.categories = menu.categories.filter(c => c.items?.length > 0);
        if (this.categories.length > 0) {
          this.activeCategory = this.categories[0].id;
        }
      }
    });
  }

  setCategory(catId: string): void {
    this.activeCategory = catId;
  }

  getActiveItems(): MenuItem[] {
    const cat = this.categories.find(c => c.id === this.activeCategory);
    return cat?.items?.filter(i => i.isAvailable) ?? [];
  }

  // ── Cart ──

  addToCart(item: MenuItem): void {
    const existing = this.cart.find(c => c.menuItem.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ menuItem: item, quantity: 1 });
    }
  }

  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
  }

  updateQty(index: number, delta: number): void {
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
    }
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, c) => sum + (c.menuItem.price * c.quantity), 0);
  }

  getCartItemCount(): number {
    return this.cart.reduce((sum, c) => sum + c.quantity, 0);
  }

  getCartInItem(itemId: string): number {
    return this.cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0;
  }

  getCartEntry(itemId: string): WaiterCartItem | undefined {
    return this.cart.find(c => c.menuItem.id === itemId);
  }

  // ── Place Order (adds new order to table) ──

  placeOrder(): void {
    if (!this.selectedTable || this.cart.length === 0) return;

    this.submitting = true;
    this.errorMessage = '';

    const tenantId = this.authService.getTenantId()!;
    const request: CreateOrderRequest = {
      tableId: this.selectedTable.id,
      specialInstructions: this.specialInstructions || undefined,
      items: this.cart.map(c => ({
        menuItemId: c.menuItem.id,
        quantity: c.quantity,
        notes: c.notes
      } as CreateOrderItemRequest))
    };

    this.orderService.createOrder(request, tenantId).subscribe({
      next: (order) => {
        this.submitting = false;
        this.successMessage = `Order #${order.orderNumber} added to Table ${this.selectedTable!.tableNumber}!`;
        this.cart = [];
        this.specialInstructions = '';
        // Reload session to show new order in the existing orders list
        this.loadTableSession(this.selectedTable!.id);
        this.loadOrders();
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Failed to place order.';
      }
    });
  }

  // ── Clear Table / Bill Paid ──

  loadRestaurantName(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => this.restaurantName = s.name || 'Restaurant',
      error: () => this.restaurantName = 'Restaurant'
    });
  }

  /** Step 1: Show bill preview BEFORE calling the API */
  previewBill(): void {
    if (!this.selectedTable || !this.tableSession) return;
    this.billSummary = this.tableSession;
    this.mergedBillItems = this.computeMergedItems(this.tableSession);
    this.showBillSummary = true;
  }

  /** Merge all order items into a flat list, combining duplicates */
  private computeMergedItems(session: TableSessionSummary): MergedBillItem[] {
    const map = new Map<string, MergedBillItem>();
    for (const order of session.orders) {
      for (const item of order.items) {
        const existing = map.get(item.itemName);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalPrice += item.totalPrice;
        } else {
          map.set(item.itemName, {
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
        }
      }
    }
    return Array.from(map.values());
  }

  /** Step 2: Confirm — calls API to clear table, then prints/downloads bill */
  confirmClearTable(): void {
    if (!this.selectedTable) return;
    this.clearing = true;

    this.orderService.clearTable(this.selectedTable.id).subscribe({
      next: (summary) => {
        this.clearing = false;
        this.billSummary = summary;
        this.mergedBillItems = this.computeMergedItems(summary);
        this.tableSession = null;
        this.successMessage = `Table ${this.selectedTable!.tableNumber} cleared! Total bill: ₹${summary.grandTotal}`;
        this.loadOrders();
        this.loadTables();
        setTimeout(() => this.successMessage = '', 5000);

        // Auto-print / download
        this.printBill();
      },
      error: (err) => {
        this.clearing = false;
        this.errorMessage = err.error?.message || 'Failed to clear table.';
      }
    });
  }

  /** Cancel preview without clearing */
  cancelBillPreview(): void {
    this.showBillSummary = false;
    this.billSummary = null;
    this.mergedBillItems = [];
  }

  closeBillSummary(): void {
    this.showBillSummary = false;
    this.billSummary = null;
    this.mergedBillItems = [];
    this.deselectTable();
  }

  /** Generate a print-friendly bill and trigger print/download */
  printBill(): void {
    if (!this.billSummary) return;

    const items = this.mergedBillItems;
    const s = this.billSummary;
    const now = new Date().toLocaleString();

    const itemRows = items.map(i =>
      `<tr><td>${i.itemName}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${i.unitPrice.toFixed(0)}</td><td style="text-align:right">₹${i.totalPrice.toFixed(0)}</td></tr>`
    ).join('');

    const html = `
      <html><head><title>Bill - Table ${s.tableNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; max-width: 400px; margin: 0 auto; color: #222; }
        .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px dashed #ccc; }
        .restaurant { font-size: 22px; font-weight: 800; color: #1a1a2e; }
        .brand { font-size: 10px; color: #aaa; margin-top: 2px; letter-spacing: 1px; }
        .info { text-align: center; font-size: 13px; color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 6px 4px; }
        td { padding: 5px 4px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        .totals { border-top: 2px dashed #ccc; padding-top: 10px; margin-top: 4px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
        .total-row.grand { font-size: 20px; font-weight: 800; color: #e94560; padding-top: 8px; border-top: 2px solid #1a1a2e; margin-top: 6px; }
        .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 12px; color: #999; }
        .footer .brand-name { font-weight: 700; background: linear-gradient(90deg, #e94560, #0f3460); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @media print { body { padding: 8px; } }
      </style></head><body>
        <div class="header">
          <div class="restaurant">${this.restaurantName}</div>
          <div class="brand">Powered by TabVerse</div>
        </div>
        <div class="info">
          Table: <strong>${s.tableNumber}</strong>${s.tableLabel ? ' — ' + s.tableLabel : ''}<br/>
          ${now}
        </div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><span>₹${s.grandSubTotal.toFixed(0)}</span></div>
          <div class="total-row"><span>Tax</span><span>₹${s.grandTax.toFixed(0)}</span></div>
          <div class="total-row grand"><span>Total</span><span>₹${s.grandTotal.toFixed(0)}</span></div>
        </div>
        <div class="footer">
          Thank you for dining with us!<br/>
          Powered by <span class="brand-name">TabVerse</span>
        </div>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  // ── AR ──

  viewAR(item: MenuItem): void {
    window.open(item.arModelUrl, '_blank');
  }

  // ── Live Orders ──

  loadOrders(): void {
    this.ordersLoading = true;
    this.orderService.getLiveOrders().subscribe({
      next: (data) => { this.liveOrders = data; this.ordersLoading = false; },
      error: () => this.ordersLoading = false
    });
  }

  dismissCall(table: TableResponse, event: Event): void {
    event.stopPropagation();
    this.tableService.dismissCall(table.id).subscribe({
      next: () => {
        table.isCallingWaiter = false;
        this.successMessage = `Dismissed call from Table ${table.tableNumber}`;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => {
        this.errorMessage = 'Failed to dismiss call.';
      }
    });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      await this.signalR.startConnection(tenantId);
      this.subs.push(
        this.signalR.newOrder$.subscribe(() => {
          this.loadOrders();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
        }),
        this.signalR.statusUpdate$.subscribe(() => {
          this.loadOrders();
          if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
        }),
        this.signalR.waiterCalled$.subscribe(() => {
          this.loadTables();
          this.successMessage = '🔔 A customer is calling for a waiter!';
          setTimeout(() => this.successMessage = '', 5000);
        }),
        this.signalR.waiterCallDismissed$.subscribe(() => {
          this.loadTables();
        })
      );
    }
  }

  updateStatus(order: OrderResponse, newStatus: string): void {
    this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
      next: () => this.loadOrders()
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return '#f39c12';
      case 'Accepted': return '#3498db';
      case 'Preparing': return '#e67e22';
      case 'Ready': return '#27ae60';
      case 'Served': return '#2980b9';
      case 'Completed': return '#7f8c8d';
      default: return '#666';
    }
  }

  getNextStatus(current: string): string | null {
    const idx = this.statusOptions.indexOf(current);
    return idx < this.statusOptions.length - 1 ? this.statusOptions[idx + 1] : null;
  }

  // ── Cancel Order Item ──

  promptCancelItem(itemId: string): void {
    this.confirmCancelItemId = itemId;
  }

  dismissCancel(): void {
    this.confirmCancelItemId = null;
  }

  cancelOrderItem(order: OrderResponse, item: OrderItemResponse): void {
    this.cancellingItemId = item.id;
    this.orderService.cancelOrderItem(order.id, item.id).subscribe({
      next: () => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
        this.successMessage = `Cancelled "${item.itemName}" from order #${order.orderNumber}`;
        setTimeout(() => this.successMessage = '', 3000);
        this.loadOrders();
        if (this.selectedTable) this.loadTableSession(this.selectedTable.id);
      },
      error: (err) => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
        this.errorMessage = err.error?.message || 'Failed to cancel item.';
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  // ── Nav ──

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
