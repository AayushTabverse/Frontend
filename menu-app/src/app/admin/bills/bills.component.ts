import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SettingsService } from '../../services/settings.service';
import { BillResponse } from '../../models/api.models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './bills.component.html',
  styleUrl: './bills.component.scss'
})
export class BillsComponent implements OnInit {
  bills: BillResponse[] = [];
  loading = false;
  userName = '';
  sidebarCollapsed = false;
  mobileSidebarOpen = false;

  // Date filters (default: today)
  fromDate = '';
  toDate = '';

  totalRevenue = 0;
  totalBills = 0;

  // Pagination
  currentPage = 1;
  pageSize = 15;
  totalPages = 1;

  // Expanded bill
  expandedBill: string | null = null;
  simpleView = false;

  // Restaurant settings for invoice
  restaurantName = '';
  cgstPercent = 2.5;
  sgstPercent = 2.5;
  serviceChargePercent = 0;

  getMergedItems(bill: BillResponse): { name: string; quantity: number; total: number }[] {
    const map = new Map<string, { name: string; quantity: number; total: number }>();
    for (const order of bill.orders) {
      for (const item of order.items) {
        const existing = map.get(item.itemName);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.totalPrice;
        } else {
          map.set(item.itemName, { name: item.itemName, quantity: item.quantity, total: item.totalPrice });
        }
      }
    }
    return Array.from(map.values());
  }

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    const today = new Date();
    this.fromDate = this.formatDate(today);
    this.toDate = this.formatDate(today);
    this.loadBills();
    this.loadSettings();
  }

  loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.restaurantName = s.name || 'Restaurant';
        this.cgstPercent = s.cgstPercent ?? 2.5;
        this.sgstPercent = s.sgstPercent ?? 2.5;
        this.serviceChargePercent = s.serviceChargePercent ?? 0;
      }
    });
  }

  loadBills(): void {
    if (!this.fromDate || !this.toDate) return;
    this.loading = true;

    this.orderService.getBills(this.fromDate, this.toDate, this.currentPage, this.pageSize).subscribe({
      next: (data) => {
        this.bills = data.bills;
        this.totalBills = data.totalCount;
        this.totalPages = data.totalPages;
        this.totalRevenue = data.totalRevenue;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.expandedBill = null;
    this.loadBills();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.expandedBill = null;
    this.loadBills();
  }

  toggleBill(billNumber: string): void {
    this.expandedBill = this.expandedBill === billNumber ? null : billNumber;
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  downloadCSV(): void {
    if (!this.fromDate || !this.toDate) return;

    const url = this.orderService.getOrderHistoryDownloadUrl(this.fromDate, this.toDate);
    const token = this.authService.getToken();

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bills_${this.fromDate}_to_${this.toDate}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  downloadInvoice(bill: BillResponse): void {
    const items = this.getMergedItems(bill);
    const billDate = new Date(bill.completedAt).toLocaleString();

    const itemRows = items.map(i => {
      const unitPrice = i.quantity > 0 ? Math.round(i.total / i.quantity) : 0;
      return `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${unitPrice}</td><td style="text-align:right">₹${Math.round(i.total)}</td></tr>`;
    }).join('');

    const html = `
      <html><head><title>Invoice - ${bill.billNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; max-width: 400px; margin: 0 auto; color: #222; font-size: 13px; }
        .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px dashed #ccc; }
        .restaurant { font-size: 22px; font-weight: 800; color: #1a1a2e; }
        .brand { font-size: 10px; color: #aaa; margin-top: 2px; letter-spacing: 1px; }
        .info { text-align: center; font-size: 13px; color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 6px 4px; }
        td { padding: 5px 4px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
        .totals { border-top: 2px dashed #ccc; padding-top: 10px; margin-top: 4px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .total-row.grand { font-size: 20px; font-weight: 800; color: #e94560; padding-top: 8px; border-top: 2px solid #1a1a2e; margin-top: 6px; }
        .footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 12px; color: #999; }
        .footer .brand-name { font-weight: 700; background: linear-gradient(90deg, #e94560, #0f3460); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @page { margin: 10mm; }
      </style></head><body>
        <div class="header">
          <div class="restaurant">${this.restaurantName}</div>
          <div class="brand">Powered by TabVerse</div>
        </div>
        <div class="info">
          Table: <strong>${bill.tableNumber}</strong>${bill.tableLabel ? ' — ' + bill.tableLabel : ''}<br/>
          Bill: <strong>${bill.billNumber}</strong><br/>
          ${billDate}
          ${bill.customerName ? '<br/>Name: <strong>' + bill.customerName + '</strong>' : ''}
          ${bill.customerMobile ? '<br/>Mobile: <strong>' + bill.customerMobile + '</strong>' : ''}
        </div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><span>₹${Math.round(bill.subTotal)}</span></div>
          ${this.cgstPercent > 0 ? `<div class="total-row"><span>CGST (${this.cgstPercent}%)</span><span>₹${Math.round(bill.subTotal * this.cgstPercent / 100)}</span></div>` : ''}
          ${this.sgstPercent > 0 ? `<div class="total-row"><span>SGST (${this.sgstPercent}%)</span><span>₹${Math.round(bill.subTotal * this.sgstPercent / 100)}</span></div>` : ''}
          ${this.serviceChargePercent > 0 ? `<div class="total-row"><span>Service Charge (${this.serviceChargePercent}%)</span><span>₹${Math.round(bill.subTotal * this.serviceChargePercent / 100)}</span></div>` : ''}
          ${bill.discountAmount > 0 ? `<div class="total-row" style="color:#e94560"><span>Discount</span><span>- ₹${Math.round(bill.discountAmount)}</span></div>` : ''}
          <div class="total-row grand"><span>Grand Total</span><span>₹${Math.round(bill.totalAmount)}</span></div>
          ${bill.dueAmount > 0 ? `<div class="total-row" style="color:#e94560;font-weight:700;margin-top:4px"><span>Due (Udhaar)</span><span>₹${Math.round(bill.dueAmount)}</span></div>` : ''}
          ${bill.paidAmount > 0 && bill.dueAmount > 0 ? `<div class="total-row" style="color:#4caf50;font-weight:700"><span>Paid</span><span>₹${Math.round(bill.paidAmount)}</span></div>` : ''}
        </div>
        <div class="footer">
          Thank you for dining with us!<br/>
          Powered by <span class="brand-name">TabVerse</span>
        </div>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }
}
