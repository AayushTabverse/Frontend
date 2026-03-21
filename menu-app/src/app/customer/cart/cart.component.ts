import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/api.models';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  items: CartItem[] = [];
  tenantId = '';
  tableId = '';

  constructor(
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.queryParamMap.get('tableId') || '';

    this.cartService.cart$.subscribe(items => {
      this.items = items;
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

  getTax(): number {
    return Math.round(this.getSubtotal() * 0.05);
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
