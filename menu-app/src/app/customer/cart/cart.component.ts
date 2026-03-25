import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { SettingsService } from '../../services/settings.service';
import { CartItem } from '../../models/api.models';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  tenantId = '';
  tableId = '';
  cgstPercent = 2.5;
  sgstPercent = 2.5;
  serviceChargePercent = 0;

  constructor(
    private cartService: CartService,
    private settingsService: SettingsService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.queryParamMap.get('tableId') || '';

    this.cartService.cart$.subscribe(items => {
      this.items = items;
    });
  }

  ngOnInit(): void {
    this.settingsService.getPublicSettings(this.tenantId).subscribe({
      next: (s) => {
        this.cgstPercent = s.cgstPercent ?? 2.5;
        this.sgstPercent = s.sgstPercent ?? 2.5;
        this.serviceChargePercent = s.serviceChargePercent ?? 0;
      }
    });
  }

  increment(item: CartItem): void {
    this.cartService.updateQuantity(item.menuItem.id, item.quantity + 1);
  }

  decrement(item: CartItem): void {
    this.cartService.updateQuantity(item.menuItem.id, item.quantity - 1);
  }

  remove(item: CartItem): void {
    this.cartService.removeItem(item.menuItem.id);
  }

  getSubtotal(): number {
    return this.cartService.getTotal();
  }

  getCgst(): number {
    return Math.round(this.getSubtotal() * this.cgstPercent / 100);
  }

  getSgst(): number {
    return Math.round(this.getSubtotal() * this.sgstPercent / 100);
  }

  getServiceCharge(): number {
    return Math.round(this.getSubtotal() * this.serviceChargePercent / 100);
  }

  getTax(): number {
    return this.getCgst() + this.getSgst() + this.getServiceCharge();
  }

  getGrandTotal(): number {
    return this.getSubtotal() + this.getTax();
  }

  goBack(): void {
    this.router.navigate(['/menu', this.tenantId, this.tableId]);
  }

  checkout(): void {
    this.router.navigate(['/checkout'], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }
}
