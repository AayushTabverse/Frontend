import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { SignalRService } from '../../services/signalr.service';
import { OrderResponse } from '../../models/api.models';
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
  tenantId = '';
  private sub?: Subscription;

  statusSteps = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served', 'Completed'];

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private signalR: SignalRService
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId') || '';
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';

    this.orderService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
        this.setupRealTime(orderId);
      },
      error: () => this.loading = false
    });
  }

  private async setupRealTime(orderId: string): Promise<void> {
    if (this.tenantId) {
      await this.signalR.startConnection(this.tenantId);
      await this.signalR.trackOrder(orderId);

      this.sub = this.signalR.statusUpdate$.subscribe(updated => {
        if (updated.id === this.order?.id) {
          this.order = updated;
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.signalR.stopConnection();
  }
}
