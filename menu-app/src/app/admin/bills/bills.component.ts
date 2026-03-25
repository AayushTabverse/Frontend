import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
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
}
