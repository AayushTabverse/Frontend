import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { SignalRService } from '../../services/signalr.service';
import { AuthService } from '../../services/auth.service';
import { OrderResponse, OrderItemResponse, LiveOrdersResponse } from '../../models/api.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  liveOrders?: LiveOrdersResponse;
  loading = true;
  cancellingItemId: string | null = null;
  confirmCancelItemId: string | null = null;
  private subs: Subscription[] = [];

  statusOptions = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served', 'Completed'];

  constructor(
    private orderService: OrderService,
    private signalR: SignalRService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.setupRealTime();
  }

  loadOrders(): void {
    this.orderService.getLiveOrders().subscribe({
      next: (data) => { this.liveOrders = data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      await this.signalR.startConnection(tenantId);

      this.subs.push(
        this.signalR.newOrder$.subscribe(() => this.loadOrders()),
        this.signalR.statusUpdate$.subscribe(() => this.loadOrders())
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

  getNextStatus(currentStatus: string): string | null {
    const idx = this.statusOptions.indexOf(currentStatus);
    return idx < this.statusOptions.length - 1 ? this.statusOptions[idx + 1] : null;
  }

  promptCancelItem(itemId: string): void {
    this.confirmCancelItemId = itemId;
  }

  dismissCancel(): void {
    this.confirmCancelItemId = null;
  }

  cancelItem(order: OrderResponse, item: OrderItemResponse): void {
    this.cancellingItemId = item.id;
    this.orderService.cancelOrderItem(order.id, item.id).subscribe({
      next: () => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
        this.loadOrders();
      },
      error: () => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
