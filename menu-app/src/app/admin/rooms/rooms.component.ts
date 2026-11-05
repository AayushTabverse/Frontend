import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, debounceTime, merge } from 'rxjs';
import {
  BusinessSettings, CheckInRequest, FolioResponse, PaymentAccount, PaymentSplit, RoomRequest, RoomResponse, StayResponse,
  TableSessionSummary
} from '../../models/api.models';
import { AccountingService } from '../../services/accounting.service';
import { HotelService } from '../../services/hotel.service';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { SignalRService } from '../../services/signalr.service';

/** Front desk: rooms, check-in (with the room-service PIN), the room bill and checkout. */
@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss'
})
export class RoomsComponent implements OnInit, OnDestroy {
  rooms: RoomResponse[] = [];
  loading = true;
  busy = false;
  successMessage = '';
  errorMessage = '';
  canManageRooms = false;
  settings: BusinessSettings | null = null;

  // Add / edit room
  roomForm: RoomRequest | null = null;
  editingRoomId: string | null = null;

  // Check-in
  checkInRoom: RoomResponse | null = null;
  checkInForm: CheckInRequest = { guestName: '', requirePin: true };
  /** Shown once after check-in so the desk can tell the guest. */
  newStay: StayResponse | null = null;

  // Room bill / checkout
  folio: FolioResponse | null = null;
  discount = 0;
  paymentMode: 'full' | 'partial' = 'full';
  paidAmount = 0;
  checkoutNotes = '';
  /** How the paid part was paid: one account, or split across several (cash/UPI/card…). */
  paymentAccounts: PaymentAccount[] = [];
  payAccount = '';
  paySplit = false;
  splitAmounts: Record<string, number | null> = {};

  private sub?: Subscription;

  constructor(
    private hotel: HotelService,
    private auth: AuthService,
    private settingsService: SettingsService,
    private signalR: SignalRService,
    private accounting: AccountingService
  ) {}

  ngOnInit(): void {
    this.canManageRooms = this.auth.can('tables');
    this.load();
    this.settingsService.getSettings().subscribe(s => this.settings = s);
    this.accounting.paymentAccounts().subscribe({
      next: accounts => { this.paymentAccounts = accounts; this.payAccount ||= this.defaultPayAccount; },
      error: () => {}
    });
    this.setupRealTime();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private async setupRealTime(): Promise<void> {
    const tenantId = this.auth.getTenantId();
    if (!tenantId) return;
    await this.signalR.startConnection(tenantId);
    this.sub = merge(this.signalR.roomsChanged$, this.signalR.newOrder$, this.signalR.statusUpdate$, this.signalR.reconnected$)
      .pipe(debounceTime(800))
      .subscribe(() => {
        this.load();
        if (this.folio) this.refreshFolio();
      });
  }

  load(): void {
    this.hotel.getRooms().subscribe({
      next: (rooms) => { this.rooms = rooms; this.loading = false; },
      error: () => { this.loading = false; this.showError('Could not load rooms.'); }
    });
  }

  get occupiedCount(): number {
    return this.rooms.filter(r => r.stay).length;
  }

  // ── Rooms ──

  openAddRoom(): void {
    this.editingRoomId = null;
    this.roomForm = { roomNumber: '', floor: '', roomType: '', isActive: true };
  }

  openEditRoom(room: RoomResponse): void {
    this.editingRoomId = room.id;
    this.roomForm = { roomNumber: room.roomNumber, floor: room.floor, roomType: room.roomType, isActive: room.isActive };
  }

  saveRoom(): void {
    if (!this.roomForm?.roomNumber.trim()) return;
    this.busy = true;
    const req$ = this.editingRoomId
      ? this.hotel.updateRoom(this.editingRoomId, this.roomForm)
      : this.hotel.createRoom(this.roomForm);
    req$.subscribe({
      next: () => { this.busy = false; this.roomForm = null; this.load(); },
      error: (err) => { this.busy = false; this.showError(err.error?.message || 'Could not save the room.'); }
    });
  }

  deleteRoom(room: RoomResponse): void {
    if (!confirm(`Remove room ${room.roomNumber}?`)) return;
    this.hotel.deleteRoom(room.id).subscribe({
      next: () => this.load(),
      error: (err) => this.showError(err.error?.message || 'Could not remove the room.')
    });
  }

  printQr(room: RoomResponse): void {
    this.hotel.getRoomQrBlob(room.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<html><head><title>Room ${esc(room.roomNumber)} QR</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{width:300px}</style></head>
        <body><h1>🛎️ In-room dining</h1><p>Room ${esc(room.roomNumber)}: scan to order. Use the PIN from your check-in.</p>
        <img src="${url}" onload="window.print()" /></body></html>`);
      w.document.close();
    });
  }

  // ── Check-in ──

  openCheckIn(room: RoomResponse): void {
    this.checkInRoom = room;
    this.checkInForm = { guestName: '', guestMobile: '', requirePin: true };
    this.newStay = null;
  }

  confirmCheckIn(): void {
    if (!this.checkInRoom || !this.checkInForm.guestName.trim()) return;
    if (this.checkInForm.guestMobile && !/^\d{10}$/.test(this.checkInForm.guestMobile)) {
      this.showError('Mobile number must be 10 digits.');
      return;
    }
    this.busy = true;
    this.hotel.checkIn(this.checkInRoom.id, this.checkInForm).subscribe({
      next: (stay) => { this.busy = false; this.newStay = stay; this.load(); },
      error: (err) => { this.busy = false; this.showError(err.error?.message || 'Could not check in.'); }
    });
  }

  closeCheckIn(): void {
    this.checkInRoom = null;
    this.newStay = null;
  }

  // ── Room bill & checkout ──

  openFolio(room: RoomResponse): void {
    if (!room.stay) return;
    this.discount = 0;
    this.paymentMode = 'full';
    this.paidAmount = 0;
    this.checkoutNotes = '';
    this.payAccount = this.defaultPayAccount;
    this.paySplit = false;
    this.splitAmounts = {};
    this.hotel.getFolio(room.stay.id).subscribe({
      next: (f) => this.folio = f,
      error: () => this.showError('Could not load the room bill.')
    });
  }

  private refreshFolio(): void {
    if (!this.folio) return;
    this.hotel.getFolio(this.folio.stay.id).subscribe(f => this.folio = f);
  }

  get unbilledOrders() {
    return this.folio?.orders.filter(o => !o.billNumber) ?? [];
  }

  get undeliveredCount(): number {
    return this.unbilledOrders.filter(o => !o.deliveredAt).length;
  }

  get amountDue(): number {
    return Math.max(0, (this.folio?.openBalance ?? 0) - (this.discount || 0));
  }

  private get defaultPayAccount(): string {
    return (this.paymentAccounts.find(a => a.kind === 'Cash') ?? this.paymentAccounts[0])?.key ?? '';
  }

  get splitSum(): number {
    return this.paymentAccounts.reduce((sum, a) => sum + (Number(this.splitAmounts[a.key]) || 0), 0);
  }

  /** Amount paid now: the whole bill, the part amount, or the split total (part paid + split). */
  get amountPaidNow(): number {
    if (this.paymentMode === 'full') return this.amountDue;
    return this.paySplit ? this.splitSum : (this.paidAmount || 0);
  }

  /** Full payment split must cover the bill; a part payment can't be more than it. */
  get splitInvalid(): boolean {
    if (!this.paySplit || !this.paymentAccounts.length) return false;
    return this.paymentMode === 'full' ? Math.abs(this.amountDue - this.splitSum) >= 1 : this.splitSum > this.amountDue + 1;
  }

  private buildPayments(): PaymentSplit[] | undefined {
    if (!this.paymentAccounts.length) return undefined;
    if (!this.paySplit) {
      const amount = Math.min(this.amountPaidNow, this.amountDue);
      return amount > 0 && this.payAccount ? [{ accountKey: this.payAccount, amount }] : undefined;
    }
    const splits = this.paymentAccounts
      .map(a => ({ accountKey: a.key, amount: Number(this.splitAmounts[a.key]) || 0 }))
      .filter(p => p.amount > 0);
    // Rupees typed against a bill with paise: put the rounding difference on the largest share
    if (this.paymentMode === 'full' && splits.length) {
      const largest = splits.reduce((a, b) => (b.amount > a.amount ? b : a));
      largest.amount = Math.round((largest.amount + this.amountDue - this.splitSum) * 100) / 100;
    }
    return splits.length ? splits : undefined;
  }

  checkOut(): void {
    if (!this.folio) return;
    if (this.undeliveredCount > 0
      && !confirm(`${this.undeliveredCount} order(s) not delivered yet will go on this bill. Check out anyway?`)) return;
    this.busy = true;
    this.hotel.checkOut(this.folio.stay.id, {
      discountAmount: this.discount || 0,
      paidAmount: this.amountPaidNow,
      notes: this.checkoutNotes || undefined,
      payments: this.buildPayments()
    }).subscribe({
      next: (res) => {
        this.busy = false;
        const room = this.folio!.stay.roomNumber;
        if (res.bill) this.printBill(res.bill, res.stay);
        this.folio = null;
        this.showSuccess(`Room ${room} checked out${res.bill ? `: bill ₹${res.bill.grandTotal}` : ''}.`);
        this.load();
      },
      error: (err) => { this.busy = false; this.showError(err.error?.message || 'Could not check out.'); }
    });
  }

  private printBill(bill: TableSessionSummary, stay: StayResponse): void {
    const s = this.settings;
        const items = new Map<string, { qty: number; total: number }>();
    for (const o of bill.orders) for (const i of o.items) {
      const e = items.get(i.itemName) ?? { qty: 0, total: 0 };
      items.set(i.itemName, { qty: e.qty + i.quantity, total: e.total + i.totalPrice });
    }
    const rows = [...items.entries()].map(([name, v]) =>
      `<tr><td>${esc(name)}</td><td style="text-align:center">${v.qty}</td><td style="text-align:right">₹${v.total.toFixed(2)}</td></tr>`).join('');
    // Split the tax actually charged on the bill (not today's settings) by the rates
    const rates = (s?.cgstPercent ?? 0) + (s?.sgstPercent ?? 0) + (s?.serviceChargePercent ?? 0);
    const tax = (label: string, pct?: number) => pct && rates
      ? `<div class="r"><span>${label} (${pct}%)</span><span>₹${(bill.grandTax * pct / rates).toFixed(2)}</span></div>` : '';
    const billNumber = bill.orders[0]?.billNumber ?? '';

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Room ${esc(stay.roomNumber)} bill</title><style>
      body { font-family: sans-serif; max-width: 380px; margin: 0 auto; padding: 16px; font-size: 13px; color: #111; }
      h1 { font-size: 18px; text-align: center; margin: 0; } .c { text-align: center; color: #555; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; } td, th { padding: 3px 0; border-bottom: 1px dashed #ccc; }
      .r { display: flex; justify-content: space-between; padding: 2px 0; } .g { font-weight: 800; font-size: 16px; border-top: 2px solid #111; margin-top: 4px; padding-top: 4px; }
    </style></head><body>
      <h1>${esc(s?.name ?? '')}</h1>
      <p class="c">Room ${esc(stay.roomNumber)} · ${esc(stay.guestName)}<br/>${esc(billNumber)} · ${new Date().toLocaleString()}</p>
      <table><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr>${rows}</table>
      <div class="r"><span>Subtotal</span><span>₹${bill.grandSubTotal.toFixed(2)}</span></div>
      ${bill.grandPackaging ? `<div class="r"><span>Packing charges</span><span>₹${bill.grandPackaging.toFixed(2)}</span></div>` : ''}
      ${tax('CGST', s?.cgstPercent)}${tax('SGST', s?.sgstPercent)}${tax('Service Charge', s?.serviceChargePercent)}
      ${bill.grandDiscount ? `<div class="r"><span>Discount</span><span>- ₹${bill.grandDiscount.toFixed(2)}</span></div>` : ''}
      <div class="r g"><span>Total</span><span>₹${bill.grandTotal.toFixed(2)}</span></div>
      ${bill.dueAmount > 0 ? `<div class="r"><span>Paid</span><span>₹${bill.paidAmount.toFixed(2)}</span></div><div class="r"><span>Due</span><span>₹${bill.dueAmount.toFixed(2)}</span></div>` : ''}
      <p class="c">Thank you for staying with us!</p>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 5000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage = '', 5000);
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
