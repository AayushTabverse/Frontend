import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CreateOrderRequest } from '../../models/api.models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent {
  tenantId = '';
  tableId = '';
  specialInstructions = '';
  loading = false;
  error = '';

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId') || '';
    this.tableId = this.route.snapshot.queryParamMap.get('tableId') || '';
  }

  get items() {
    return this.cartService.getItems();
  }

  get total() {
    const sub = this.cartService.getTotal();
    return sub + Math.round(sub * 0.05);
  }

  placeOrder(): void {
    if (this.items.length === 0) return;

    this.loading = true;
    this.error = '';

    const request: CreateOrderRequest = {
      tableId: this.tableId,
      specialInstructions: this.specialInstructions || undefined,
      items: this.items.map(item => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        modifiers: item.modifiers,
        notes: item.notes
      }))
    };

    this.orderService.createOrder(request, this.tenantId).subscribe({
      next: (order) => {
        this.cartService.clearCart();
        this.router.navigate(['/order-tracking', order.id], {
          queryParams: { tenantId: this.tenantId, tableId: this.tableId }
        });
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to place order. Please try again.';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/cart'], {
      queryParams: { tenantId: this.tenantId, tableId: this.tableId }
    });
  }
}
