import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { OrderResponse } from '../../models/api.models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './bills.component.html',
  styleUrl: './bills.component.scss'
})
export class BillsComponent implements OnInit {
  orders: OrderResponse[] = [];
  loading = false;
  userName = '';
  sidebarCollapsed = false;

  // Date filters (default: today)
  fromDate = '';
  toDate = '';

  totalRevenue = 0;
  totalOrders = 0;

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    // Default to today
    const today = new Date();
    this.fromDate = this.formatDate(today);
    this.toDate = this.formatDate(today);
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.fromDate || !this.toDate) return;
    this.loading = true;

    this.orderService.getOrderHistory(this.fromDate, this.toDate).subscribe({
      next: (data) => {
        this.orders = data;
        this.totalOrders = data.length;
        this.totalRevenue = data.reduce((sum, o) => sum + o.totalAmount, 0);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  downloadCSV(): void {
    if (!this.fromDate || !this.toDate) return;

    const url = this.orderService.getOrderHistoryDownloadUrl(this.fromDate, this.toDate);
    const token = this.authService.getToken();

    // Fetch with auth header then trigger download
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
