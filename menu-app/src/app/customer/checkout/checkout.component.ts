import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Router, ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { SettingsService } from '../../services/settings.service';
import { TableSessionService } from '../../services/table-session.service';
import { HotelService } from '../../services/hotel.service';
import { CreateOrderRequest } from '../../models/api.models';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

import { LocalDishPipe } from '../../shared/local-dish.pipe';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective, LanguageSwitcherComponent, LocalDishPipe],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  tenantId = '';
  tableId = '';
  specialInstructions = '';
  loading = false;
  error = '';
  totalTaxPercent = 5;
  takeawayPackingFee = 0;
  /** Takeaway: who to call when it's ready. */
  customerName = '';
  customerMobile = '';
  /** The restaurant only accepts QR orders from phones inside (distance check). */
  locationRequired = false;
  locating = false;
  /** Room service: PIN from check-in, and whether it goes on the room bill. */
  roomPin = '';
  roomPinRequired = false;
  chargeToRoom = true;

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private settingsService: SettingsService,
    private sessionService: TableSessionService,
    private hotelService: HotelService,
    private router: Router,
    private route: ActivatedRoute,
    private transloco: TranslocoService
  ) {
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.queryParamMap.get('tableId') || '';
  }

  ngOnInit(): void {
    if (this.isRoom) {
      this.hotelService.getPublicRoom(this.roomId).subscribe(r => this.roomPinRequired = r.pinRequired);
    }
    this.settingsService.getPublicSettings(this.tenantId).subscribe({
      next: (s) => {
        this.totalTaxPercent = (s.cgstPercent ?? 2.5) + (s.sgstPercent ?? 2.5) + (s.serviceChargePercent ?? 0);
        this.takeawayPackingFee = s.takeawayPackingFee ?? 0;
        this.locationRequired = (s.geofenceRadiusMeters ?? 0) > 0 && s.latitude != null && s.longitude != null;
      }
    });
  }

  get items() {
    return this.cartService.getItems();
  }

  get isRoom(): boolean {
    return this.tableId.startsWith('room-');
  }

  get roomId(): string {
    return this.tableId.slice('room-'.length);
  }

  get isTakeaway(): boolean {
    return this.tableId === 'takeaway';
  }

  get packaging(): number {
    return this.cartService.getPackagingTotal(this.isTakeaway, this.takeawayPackingFee);
  }

  get total() {
    const taxable = this.cartService.getTotal() + this.packaging;
    // Same as the server: tax to the paisa on food + packing
    return Math.round((taxable + taxable * this.totalTaxPercent / 100) * 100) / 100;
  }

  get contactValid(): boolean {
    if (this.isRoom) return !this.roomPinRequired || /^\d{4}$/.test(this.roomPin);
    return !this.isTakeaway || (!!this.customerName.trim() && /^\d{10}$/.test(this.customerMobile));
  }

  placeOrder(): void {
    if (this.items.length === 0) return;
    if (!this.contactValid) {
      this.error = this.transloco.translate(this.isRoom ? 'checkout.errors.roomPinRequired' : 'checkout.errors.contactRequired');
      return;
    }

    this.loading = true;
    this.error = '';

    // Room service is secured by check-in and the room PIN instead of location
    if (this.locationRequired && !this.isRoom) {
      this.locating = true;
      this.getLocation()
        .then(pos => this.submitOrder(pos))
        .catch(() => {
          this.loading = false;
          this.error = this.transloco.translate('checkout.errors.locationRequired');
        })
        .finally(() => this.locating = false);
      return;
    }
    this.submitOrder();
  }

  private getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
    });
  }

  private submitOrder(position?: GeolocationPosition): void {
    const request: CreateOrderRequest = {
      latitude: position?.coords.latitude,
      longitude: position?.coords.longitude,
      locationAccuracy: position?.coords.accuracy,
      tableId: this.isTakeaway || this.isRoom ? undefined : this.tableId,
      type: this.isRoom ? 'RoomService' : this.isTakeaway ? 'Takeaway' : 'DineIn',
      roomId: this.isRoom ? this.roomId : undefined,
      roomPin: this.isRoom && this.roomPin ? this.roomPin : undefined,
      chargeToRoom: this.isRoom ? this.chargeToRoom : undefined,
      customerName: this.isTakeaway ? this.customerName.trim() : undefined,
      customerMobile: this.isTakeaway ? this.customerMobile : undefined,
      specialInstructions: this.specialInstructions || undefined,
      items: this.items.map(item => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        modifiers: item.modifiers,
        notes: item.notes,
        isParcel: this.isTakeaway || !!item.isParcel
      }))
    };

    // Ordering again after the table was cleared starts a fresh session, so the order stays visible
    if (!this.sessionService.hasSession() && this.tableId) this.sessionService.initSession(this.tableId);

    this.orderService.createOrder(request, this.tenantId).subscribe({
      next: (order) => {
        // Track this order in the current customer session
        this.sessionService.addOrderId(order.id);
        this.cartService.clearCart();
        this.router.navigate(['/order-tracking', order.id], {
          queryParams: { tenantId: this.tenantId, tableId: this.tableId }
        });
      },
      error: (err) => {
        this.error = this.serverMessage(err.error?.message) ?? err.error?.message ?? this.transloco.translate('checkout.errors.placeOrderFailed');
        this.loading = false;
      }
    });
  }

  /** The server answers in English; show the common refusals in the customer's language. */
  private serverMessage(message?: string): string | null {
    if (!message) return null;
    const known: [RegExp, string][] = [
      [/^You seem to be away/, 'checkout.errors.tooFar'],
      [/^Please allow location/, 'checkout.errors.locationRequired'],
      [/^We're closed for orders/, 'checkout.errors.closed'],
      [/^That room PIN/, 'checkout.errors.wrongPin'],
      [/^Too many wrong PINs/, 'checkout.errors.pinLocked'],
      [/isn't checked in/, 'checkout.errors.roomNotCheckedIn']
    ];
    const key = known.find(([re]) => re.test(message))?.[1];
    return key ? this.transloco.translate(key) : null;
  }

  goBack(): void {
    this.router.navigate(['/cart'], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }
}
