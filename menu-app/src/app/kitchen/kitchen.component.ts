import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../services/order.service';
import { SignalRService } from '../services/signalr.service';
import { AuthService } from '../services/auth.service';
import { OrderResponse, LiveOrdersResponse } from '../models/api.models';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kitchen.component.html',
  styleUrl: './kitchen.component.scss'
})
export class KitchenComponent implements OnInit, OnDestroy {
  liveOrders?: LiveOrdersResponse;
  loading = true;
  private subs: Subscription[] = [];
  private alertSound?: HTMLAudioElement;

  constructor(
    private orderService: OrderService,
    private signalR: SignalRService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.loadOrders();
    this.setupRealTime();
  }

  loadOrders(): void {
    this.orderService.getKitchenOrders().subscribe({
      next: (data) => { this.liveOrders = data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      await this.signalR.startConnection(tenantId);

      this.subs.push(
        this.signalR.newOrder$.subscribe(() => {
          this.playAlert();
          this.loadOrders();
        }),
        this.signalR.statusUpdate$.subscribe(() => this.loadOrders()),
        this.signalR.kitchenAlert$.subscribe(() => this.playAlert())
      );
    }
  }

  acceptOrder(order: OrderResponse): void {
    this.orderService.updateOrderStatus(order.id, 'Accepted').subscribe(() => this.loadOrders());
  }

  startPreparing(order: OrderResponse): void {
    this.orderService.updateOrderStatus(order.id, 'Preparing').subscribe(() => this.loadOrders());
  }

  markReady(order: OrderResponse): void {
    this.orderService.updateOrderStatus(order.id, 'Ready').subscribe(() => this.loadOrders());
  }

  private playAlert(): void {
    try {
      // Simple beep using Web Audio API
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not available
    }
  }

  getTimeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    return mins < 1 ? 'Just now' : `${mins}m ago`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.signalR.stopConnection();
  }
}
