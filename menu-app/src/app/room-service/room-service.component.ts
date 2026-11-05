import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable, Subscription, merge } from 'rxjs';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { OrderResponse, PaymentAccount } from '../models/api.models';
import { AccountingService } from '../services/accounting.service';
import { AuthService } from '../services/auth.service';
import { HotelService } from '../services/hotel.service';
import { SignalRService } from '../services/signalr.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';

/**
 * Room service attendant's queue: orders being cooked, ready to carry up, on the way, and
 * delivered orders still waiting for payment (pay-on-delivery).
 */
import { DishNamePipe } from '../shared/dish-name.pipe';
import { WalkieComponent } from '../shared/components/walkie/walkie.component';

@Component({
  selector: 'app-room-service',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoDirective, LanguageSwitcherComponent, DishNamePipe, WalkieComponent],
  templateUrl: './room-service.component.html',
  styleUrl: './room-service.component.scss'
})
export class RoomServiceComponent implements OnInit, OnDestroy {
  orders: OrderResponse[] = [];
  loading = true;
  busyId: string | null = null;
  errorMessage = '';
  isPanelUser = false;
  paymentAccounts: PaymentAccount[] = [];

  private sub?: Subscription;
  private seen = new Set<string>();

  constructor(
    private hotel: HotelService,
    private auth: AuthService,
    private signalR: SignalRService,
    private router: Router,
    private transloco: TranslocoService,
    private accounting: AccountingService
  ) {}

  async ngOnInit(): Promise<void> {
    this.isPanelUser = this.auth.isPanelUser();
    this.load();
    this.accounting.paymentAccounts().subscribe({ next: accounts => this.paymentAccounts = accounts, error: () => {} });
    const tenantId = this.auth.getTenantId();
    if (!tenantId) return;
    await this.signalR.startConnection(tenantId);
    this.sub = merge(this.signalR.newOrder$, this.signalR.statusUpdate$, this.signalR.reconnected$)
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  load(): void {
    this.hotel.getServiceQueue().subscribe({
      next: (orders) => {
        const fresh = orders.some(o => o.status === 'Ready' && !o.dispatchedAt && !this.seen.has(o.id));
        if (!this.loading && fresh) this.chime();
        orders.filter(o => o.status === 'Ready').forEach(o => this.seen.add(o.id));
        this.orders = orders;
        this.loading = false;
      },
      error: () => { this.loading = false; this.errorMessage = this.transloco.translate('roomService.loadError'); }
    });
  }

  get inKitchen(): OrderResponse[] {
    return this.orders.filter(o => !o.dispatchedAt && o.status !== 'Ready');
  }

  get readyToCarry(): OrderResponse[] {
    return this.orders.filter(o => !o.dispatchedAt && o.status === 'Ready');
  }

  get onTheWay(): OrderResponse[] {
    return this.orders.filter(o => o.dispatchedAt && !o.deliveredAt);
  }

  /** Delivered, pay on delivery, payment not recorded yet. */
  get collectPayment(): OrderResponse[] {
    return this.orders.filter(o => o.deliveredAt && !o.chargeToRoom && !o.billNumber);
  }

  dispatch(o: OrderResponse): void {
    this.act(o, this.hotel.dispatch(o.id));
  }

  deliver(o: OrderResponse): void {
    this.act(o, this.hotel.deliver(o.id));
  }

  /** accountKey: cash / upi / card…; empty when payment accounts couldn't load (counted as cash). */
  markPaid(o: OrderResponse, accountKey = ''): void {
    this.act(o, this.hotel.settleOnDelivery(o.id, o.totalAmount, accountKey));
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }

  private act(o: OrderResponse, request: Observable<unknown>): void {
    this.busyId = o.id;
    request.subscribe({
      next: () => { this.busyId = null; this.load(); },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = err.error?.message || this.transloco.translate('roomService.updateError');
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  private chime(): void {
    try {
      const ctx = new AudioContext();
      [0, 0.2].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 988;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.12);
      });
    } catch { /* autoplay blocked */ }
  }
}
