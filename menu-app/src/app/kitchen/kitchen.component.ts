import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../services/order.service';
import { SignalRService } from '../services/signalr.service';
import { AuthService } from '../services/auth.service';
import { OrderResponse, LiveOrdersResponse } from '../models/api.models';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';

import { DishNamePipe } from '../shared/dish-name.pipe';
import { WalkieComponent } from '../shared/components/walkie/walkie.component';

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule, TranslocoDirective, LanguageSwitcherComponent, DishNamePipe, WalkieComponent],
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
    private router: Router,
    private transloco: TranslocoService
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
        this.signalR.tablesChanged$.subscribe(() => this.loadOrders()),
        this.signalR.kitchenAlert$.subscribe(() => this.playAlert()),
        // Orders placed while the connection was down never arrived as events
        this.signalR.reconnected$.subscribe(() => this.loadOrders())
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

  /** Order ids whose KOT was just sent to the Print Station (button shows ✓ briefly). */
  reprinted = new Set<string>();

  reprintKot(order: OrderResponse): void {
    this.orderService.reprintKot(order.id).subscribe(() => {
      this.reprinted.add(order.id);
      setTimeout(() => this.reprinted.delete(order.id), 3000);
    });
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
    return mins < 1
      ? this.transloco.translate('kitchen.justNow')
      : this.transloco.translate('kitchen.minAgo', { mins });
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
