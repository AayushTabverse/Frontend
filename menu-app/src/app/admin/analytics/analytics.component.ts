import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import {
  DashboardSummary, TopItem, SalesData, PeakHour, OrderResponse
} from '../../models/api.models';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  userName = '';
  loading = true;

  // Data
  dashboard?: DashboardSummary;
  salesData: SalesData[] = [];
  topItems: TopItem[] = [];
  peakHours: PeakHour[] = [];
  recentOrders: OrderResponse[] = [];

  // Filters
  salesRange = '7'; // days
  topItemsDays = '30';
  topItemsCount = 10;
  peakHoursDays = '7';

  // Computed chart data
  maxSales = 0;
  maxSalesCount = 0;
  maxTopItemQty = 0;
  maxPeakOrders = 0;

  // KPI comparisons (mock previous period)
  kpiChanges = { sales: 12.5, orders: 8.3, avgValue: -2.1, live: 0 };

  // Order status distribution
  statusDistribution: { status: string; count: number; color: string; }[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {
    this.authService.currentUser$.subscribe(u => this.userName = u?.fullName || '');
  }

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.loadDashboard();
    this.loadSales();
    this.loadTopItems();
    this.loadPeakHours();
    this.loadRecentOrders();
  }

  loadDashboard(): void {
    this.analyticsService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  loadSales(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - parseInt(this.salesRange));
    this.analyticsService.getSales(
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0]
    ).subscribe({
      next: (data) => {
        this.salesData = data;
        this.maxSales = Math.max(...data.map(d => d.totalSales), 1);
        this.maxSalesCount = Math.max(...data.map(d => d.orderCount), 1);
      }
    });
  }

  loadTopItems(): void {
    this.analyticsService.getTopItems(this.topItemsCount, parseInt(this.topItemsDays)).subscribe({
      next: (data) => {
        this.topItems = data;
        this.maxTopItemQty = Math.max(...data.map(d => d.totalQuantity), 1);
      }
    });
  }

  loadPeakHours(): void {
    this.analyticsService.getPeakHours(parseInt(this.peakHoursDays)).subscribe({
      next: (data) => {
        this.peakHours = data;
        this.maxPeakOrders = Math.max(...data.map(d => d.orderCount), 1);
      }
    });
  }

  loadRecentOrders(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    this.orderService.getOrderHistory(
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0]
    ).subscribe({
      next: (orders) => {
        this.recentOrders = orders.slice(0, 20);
        this.computeStatusDistribution(orders);
      }
    });
  }

  computeStatusDistribution(orders: OrderResponse[]): void {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    const colorMap: Record<string, string> = {
      'Completed': '#27ae60',
      'Served': '#3498db',
      'Ready': '#2ecc71',
      'Preparing': '#f39c12',
      'Accepted': '#9b59b6',
      'Pending': '#e67e22',
      'Cancelled': '#e74c3c'
    };
    this.statusDistribution = Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      color: colorMap[status] || '#95a5a6'
    }));
  }

  // Chart helpers
  getSalesBarHeight(value: number): number {
    return this.maxSales > 0 ? (value / this.maxSales) * 100 : 0;
  }

  getOrderBarHeight(value: number): number {
    return this.maxSalesCount > 0 ? (value / this.maxSalesCount) * 100 : 0;
  }

  getTopItemWidth(qty: number): number {
    return this.maxTopItemQty > 0 ? (qty / this.maxTopItemQty) * 100 : 0;
  }

  getPeakBarHeight(count: number): number {
    return this.maxPeakOrders > 0 ? (count / this.maxPeakOrders) * 100 : 0;
  }

  formatHour(h: number): string {
    if (h === 0) return '12am';
    if (h < 12) return h + 'am';
    if (h === 12) return '12pm';
    return (h - 12) + 'pm';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatCurrency(val: number): string {
    if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
    if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
    return '₹' + val.toFixed(0);
  }

  getStatusTotal(): number {
    return this.statusDistribution.reduce((sum, s) => sum + s.count, 0);
  }

  getStatusPercent(count: number): number {
    const total = this.getStatusTotal();
    return total > 0 ? (count / total) * 100 : 0;
  }

  // Donut chart SVG path helper
  getDonutSegments(): { path: string; color: string; status: string; percent: number }[] {
    const segments: { path: string; color: string; status: string; percent: number }[] = [];
    const total = this.getStatusTotal();
    if (total === 0) return segments;

    let cumulative = 0;
    const cx = 50, cy = 50, r = 40;

    this.statusDistribution.forEach(s => {
      const percent = s.count / total;
      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      cumulative += percent;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

      const largeArc = percent > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      segments.push({ path, color: s.color, status: s.status, percent: percent * 100 });
    });

    return segments;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  getItemsPreview(items: any[]): string {
    const names = items.slice(0, 2).map(i => i.itemName);
    return names.join(', ') + (items.length > 2 ? '...' : '');
  }
}
