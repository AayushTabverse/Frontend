import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { TableSessionService } from '../../services/table-session.service';
import { OrderResponse } from '../../models/api.models';

@Component({
  selector: 'app-table-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-orders.component.html',
  styleUrl: './table-orders.component.scss'
})
export class TableOrdersComponent implements OnInit {
  orders: OrderResponse[] = [];
  loading = true;
  tableId = '';
  tenantId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private sessionService: TableSessionService
  ) {}

  ngOnInit(): void {
    this.tableId = this.route.snapshot.paramMap.get('tableId') || '';
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';

    if (this.tableId) {
      const sessionOrderIds = this.sessionService.getOrderIds();
      if (sessionOrderIds.length === 0) {
        this.orders = [];
        this.loading = false;
        return;
      }
      this.orderService.getOrdersByTable(this.tableId).subscribe({
        next: (orders) => {
          // Only show orders belonging to the current customer session
          this.orders = orders
            .filter(o => sessionOrderIds.includes(o.id))
            .sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          this.loading = false;
        },
        error: () => this.loading = false
      });
    }
  }

  goBackToMenu(): void {
    if (this.tenantId && this.tableId) {
      this.router.navigate(['/menu', this.tenantId, this.tableId]);
    }
  }

  trackOrder(order: OrderResponse): void {
    this.router.navigate(['/order-tracking', order.id], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'completed';
      case 'Preparing': return 'preparing';
      case 'Ready': return 'ready';
      case 'Served': return 'served';
      case 'Accepted': return 'accepted';
      case 'Cancelled': return 'cancelled';
      default: return 'pending';
    }
  }

  get activeOrders(): OrderResponse[] {
    return this.orders.filter(o => !['Completed', 'Cancelled'].includes(o.status));
  }


}
