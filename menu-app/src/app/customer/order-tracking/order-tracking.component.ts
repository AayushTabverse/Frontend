import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { SignalRService } from '../../services/signalr.service';
import { TableSessionService } from '../../services/table-session.service';
import { OrderResponse, OrderItemResponse } from '../../models/api.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.scss'
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  order?: OrderResponse;
  loading = true;
  unauthorized = false;
  tenantId = '';
  tableId = '';
  confirmCancelItemId: string | null = null;
  cancellingItemId: string | null = null;
  private sub?: Subscription;

  statusSteps = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private signalR: SignalRService,
    private sessionService: TableSessionService
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId') || '';
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.queryParamMap.get('tableId') || '';

    // Only allow tracking orders from the current session
    if (!this.sessionService.isSessionOrder(orderId)) {
      this.loading = false;
      this.unauthorized = true;
      return;
    }

    this.orderService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order = order;
        if (!this.tableId) this.tableId = order.tableId;
        this.loading = false;
        this.checkServedRedirect();
        this.setupRealTime(orderId);
      },
      error: () => this.loading = false
    });
  }

  showServedMessage = false;
  private servedTimer?: any;

  private checkServedRedirect(): void {
    if (this.order?.status === 'Served' || this.order?.status === 'Completed') {
      this.showServedMessage = true;
      this.servedTimer = setTimeout(() => this.goBackToMenu(), 5000);
    }
  }

  goBackToMenu(): void {
    if (this.tenantId && this.tableId) {
      this.router.navigate(['/menu', this.tenantId, this.tableId]);
    }
  }

  viewAllOrders(): void {
    if (this.tableId) {
      this.router.navigate(['/table-orders', this.tableId], {
        queryParams: { tenantId: this.tenantId }
      });
    }
  }

  private async setupRealTime(orderId: string): Promise<void> {
    if (this.tenantId) {
      await this.signalR.startConnection(this.tenantId);
      await this.signalR.trackOrder(orderId);

      this.sub = this.signalR.statusUpdate$.subscribe(updated => {
        if (updated.id === this.order?.id) {
          this.order = updated;
          this.checkServedRedirect();
        }
      });
    }
  }

  getStepIndex(): number {
    if (!this.order) return 0;
    return this.statusSteps.indexOf(this.order.status);
  }

  isStepCompleted(step: string): boolean {
    return this.statusSteps.indexOf(step) <= this.getStepIndex();
  }

  /** Whether the order is in a state that allows item cancellation */
  get canCancelItems(): boolean {
    if (!this.order) return false;
    return ['Pending', 'Accepted', 'Preparing'].includes(this.order.status);
  }

  promptCancelItem(itemId: string): void {
    this.confirmCancelItemId = itemId;
  }

  dismissCancel(): void {
    this.confirmCancelItemId = null;
  }

  cancelItem(item: OrderItemResponse): void {
    if (!this.order) return;
    this.cancellingItemId = item.id;
    this.orderService.cancelOrderItem(this.order.id, item.id).subscribe({
      next: (updated) => {
        this.order = updated;
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
      },
      error: () => {
        this.cancellingItemId = null;
        this.confirmCancelItemId = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.signalR.stopConnection();
    if (this.servedTimer) clearTimeout(this.servedTimer);
  }
}
