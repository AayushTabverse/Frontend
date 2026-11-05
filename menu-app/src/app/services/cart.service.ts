import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, MenuItem } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  constructor() {
    const stored = sessionStorage.getItem('cart');
    if (stored) {
      this.cartItems = JSON.parse(stored);
      this.cartSubject.next(this.cartItems);
    }
  }

  addItem(menuItem: MenuItem, quantity: number = 1, modifiers?: string, notes?: string): void {
    const existing = this.cartItems.find(c => c.menuItem.id === menuItem.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.cartItems.push({ menuItem, quantity, modifiers, notes });
    }
    this.persist();
  }

  removeItem(menuItemId: string): void {
    this.cartItems = this.cartItems.filter(c => c.menuItem.id !== menuItemId);
    this.persist();
  }

  updateQuantity(menuItemId: string, quantity: number): void {
    const item = this.cartItems.find(c => c.menuItem.id === menuItemId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(menuItemId);
      } else {
        item.quantity = quantity;
        this.persist();
      }
    }
  }

  /** Dine-in: pack this item to take home. */
  toggleParcel(menuItemId: string): void {
    const item = this.cartItems.find(c => c.menuItem.id === menuItemId);
    if (item) {
      item.isParcel = !item.isParcel;
      this.persist();
    }
  }

  clearCart(): void {
    this.cartItems = [];
    this.persist();
  }

  getItems(): CartItem[] {
    return [...this.cartItems];
  }

  getTotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }

  /**
   * Packing for parcel items (all items for takeaway) plus the flat takeaway fee.
   * Matches the server's calculation; it is taxed like the food.
   */
  getPackagingTotal(takeaway: boolean, takeawayFee = 0): number {
    if (this.cartItems.length === 0) return 0;
    const perItem = this.cartItems
      .filter(c => takeaway || c.isParcel)
      .reduce((sum, c) => sum + (c.menuItem.packagingCharge ?? 0) * c.quantity, 0);
    return perItem + (takeaway ? takeawayFee : 0);
  }

  getItemCount(): number {
    return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  private persist(): void {
    sessionStorage.setItem('cart', JSON.stringify(this.cartItems));
    this.cartSubject.next([...this.cartItems]);
  }
}
