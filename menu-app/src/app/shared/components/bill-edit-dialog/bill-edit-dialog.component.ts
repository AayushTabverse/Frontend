import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';
import { OrderResponse, RemoveBillItemsResponse } from '../../../models/api.models';

/** One row in the dialog: the same item (name + price) across all orders on the bill. */
interface EditLine {
  itemName: string;
  unitPrice: number;
  quantity: number;
  /** Underlying order items, newest first (removals are taken from the latest order first). */
  sources: { orderItemId: string; quantity: number; lineUnit: number }[];
  remove: number;
}

export interface BillEditResult {
  response: RemoveBillItemsResponse;
  print: boolean;
}

/**
 * Remove items from a bill that was already printed (the customer says an item never came).
 * Offers "Update" and "Update & Print"; the parent does the printing.
 */
@Component({
  selector: 'app-bill-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bill-edit-dialog.component.html',
  styleUrl: './bill-edit-dialog.component.scss'
})
export class BillEditDialogComponent implements OnChanges {
  @Input({ required: true }) billNumber = '';
  @Input({ required: true }) orders: OrderResponse[] = [];
  @Input() tableNumber = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<BillEditResult>();

  lines: EditLine[] = [];
  reason = '';
  readonly reasons = ['Item not served', 'Wrong item', 'Charged twice', 'Customer complaint'];
  saving: 'update' | 'print' | null = null;
  errorMessage = '';

  ngOnChanges(): void {
    const groups = new Map<string, EditLine>();
    const newestFirst = [...this.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const order of newestFirst) {
      for (const item of order.items) {
        const key = `${item.itemName}|${item.unitPrice}`;
        const line = groups.get(key) ?? { itemName: item.itemName, unitPrice: item.unitPrice, quantity: 0, sources: [], remove: 0 };
        line.quantity += item.quantity;
        line.sources.push({
          orderItemId: item.id,
          quantity: item.quantity,
          lineUnit: item.quantity > 0 ? item.totalPrice / item.quantity : item.unitPrice
        });
        groups.set(key, line);
      }
    }
    this.lines = [...groups.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
    this.reason = '';
    this.errorMessage = '';
  }

  // ── Totals (estimate; the server recalculates at the bill's own tax rate) ──

  private get taxRate(): number {
    const sub = this.orders.reduce((n, o) => n + o.subTotal, 0);
    const tax = this.orders.reduce((n, o) => n + o.tax, 0);
    return sub > 0 ? tax / sub : 0;
  }

  get currentTotal(): number {
    return this.orders.reduce((n, o) => n + o.totalAmount, 0);
  }

  get removedAmount(): number {
    const removedSub = this.lines.reduce((n, l) => n + this.removedValue(l), 0);
    return Math.round(removedSub * (1 + this.taxRate) * 100) / 100;
  }

  get newTotal(): number {
    return Math.max(0, this.currentTotal - this.removedAmount);
  }

  get removingCount(): number {
    return this.lines.reduce((n, l) => n + l.remove, 0);
  }

  get removesEverything(): boolean {
    return this.lines.every(l => l.remove >= l.quantity);
  }

  private removedValue(line: EditLine): number {
    let left = line.remove, value = 0;
    for (const s of line.sources) {
      if (left <= 0) break;
      const take = Math.min(left, s.quantity);
      value += take * s.lineUnit;
      left -= take;
    }
    return value;
  }

  // ── Editing ──

  /** Quantity that stays on the bill (what the stepper shows). */
  kept(line: EditLine): number { return line.quantity - line.remove; }

  /** − : take one off the bill. */
  decrease(line: EditLine): void { line.remove = Math.min(line.quantity, line.remove + 1); }
  /** + : put one back (up to what was billed). */
  increase(line: EditLine): void { line.remove = Math.max(0, line.remove - 1); }
  toggleAll(line: EditLine): void { line.remove = line.remove >= line.quantity ? 0 : line.quantity; }

  submit(print: boolean): void {
    if (this.removingCount === 0 || this.removesEverything || this.saving) return;

    // Spread each row's removal over its order items, newest order first
    const items: { orderItemId: string; quantity: number }[] = [];
    for (const line of this.lines) {
      let left = line.remove;
      for (const s of line.sources) {
        if (left <= 0) break;
        const take = Math.min(left, s.quantity);
        items.push({ orderItemId: s.orderItemId, quantity: take });
        left -= take;
      }
    }

    this.saving = print ? 'print' : 'update';
    this.errorMessage = '';
    this.orderService.removeBillItems(this.billNumber, items, this.reason.trim() || undefined).subscribe({
      next: (response) => {
        this.saving = null;
        this.saved.emit({ response, print });
      },
      error: (err) => {
        this.saving = null;
        this.errorMessage = err.error?.message || 'Could not update the bill. Please try again.';
      }
    });
  }

  constructor(private orderService: OrderService) {}
}
