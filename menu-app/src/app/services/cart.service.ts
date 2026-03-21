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

  getItemCount(): number {
    return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  private persist(): void {
    sessionStorage.setItem('cart', JSON.stringify(this.cartItems));
    this.cartSubject.next([...this.cartItems]);
  }
}
