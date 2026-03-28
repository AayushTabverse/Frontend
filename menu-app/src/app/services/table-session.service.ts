import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TableSessionService {
  private readonly SESSION_KEY = 'tabverse_session';
  private readonly ORDERS_KEY = 'tabverse_session_orders';

  private sessionCleared = new BehaviorSubject<boolean>(false);
  sessionCleared$ = this.sessionCleared.asObservable();

  /**
   * Initialize or retrieve the session for a given table.
   * If the stored session belongs to a different table, it resets.
   */
  initSession(tableId: string): string {
    const existing = this.getSession();
    if (existing && existing.tableId === tableId) {
      return existing.sessionId;
    }
    // New table or first visit — create fresh session
    const sessionId = this.generateId();
    const session = { sessionId, tableId, createdAt: new Date().toISOString() };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(this.ORDERS_KEY, JSON.stringify([]));
    return sessionId;
  }

  getSessionId(): string | null {
    return this.getSession()?.sessionId ?? null;
  }

  getTableId(): string | null {
    return this.getSession()?.tableId ?? null;
  }

  /** Record an order ID as belonging to this session */
  addOrderId(orderId: string): void {
    const orderIds = this.getOrderIds();
    if (!orderIds.includes(orderId)) {
      orderIds.push(orderId);
      sessionStorage.setItem(this.ORDERS_KEY, JSON.stringify(orderIds));
    }
  }

  /** Get all order IDs created in this session */
  getOrderIds(): string[] {
    const stored = sessionStorage.getItem(this.ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /** Check if an order belongs to the current session */
  isSessionOrder(orderId: string): boolean {
    return this.getOrderIds().includes(orderId);
  }

  /** Clear the entire session (called when table is cleared) */
  clearSession(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.ORDERS_KEY);
    sessionStorage.removeItem('cart');
    this.sessionCleared.next(true);
  }

  /** Check if a session currently exists */
  hasSession(): boolean {
    return !!this.getSession();
  }

  private getSession(): { sessionId: string; tableId: string; createdAt: string } | null {
    const stored = sessionStorage.getItem(this.SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  private generateId(): string {
    return crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
