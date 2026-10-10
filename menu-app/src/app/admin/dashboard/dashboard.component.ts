import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { TodayDashboard } from '../../models/api.models';
import { parseDateKey } from '../../shared/date-utils';
import { LineChartComponent, LineSeries } from '../../shared/charts/line-chart.component';
import { StatTileComponent } from '../../shared/charts/stat-tile.component';
import { ColumnChartComponent } from '../../shared/charts/column-chart.component';
import { BarListComponent, BarRow } from '../../shared/charts/bar-list.component';
import { ChartCardComponent, ChartTable } from '../../shared/charts/chart-card.component';
import { hourLabel, inr, inrCompact, num } from '../../shared/charts/format';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LineChartComponent, StatTileComponent, ColumnChartComponent, BarListComponent, ChartCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private static readonly REFRESH_MS = 60_000;

  data: TodayDashboard | null = null;
  loading = true;
  refreshing = false;
  error = '';
  greeting = '';
  userName = '';
  compareName = '';
  compareLabel = '';

  hourLabels: string[] = [];
  hourTooltips: string[] = [];
  cumulativeSeries: LineSeries[] = [];
  last7Labels: string[] = [];
  last7Tooltips: string[] = [];
  last7Values: number[] = [];
  topItemRows: BarRow[] = [];
  tables: Record<string, ChartTable> = {};
  occupancyPct = 0;

  readonly inr = inr;
  readonly inrCompact = inrCompact;
  readonly num = num;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private analytics: AnalyticsService, private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(u => this.userName = (u?.fullName || '').split(' ')[0]);
    this.load();
    // Keep the numbers fresh while the page is open (skip when the tab is hidden)
    this.timer = setInterval(() => { if (!document.hidden) this.load(true); }, DashboardComponent.REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(background = false): void {
    if (background) this.refreshing = true; else this.loading = !this.data;
    this.analytics.getToday().subscribe({
      next: (d) => {
        this.data = d;
        this.build(d);
        this.loading = false;
        this.refreshing = false;
        this.error = '';
      },
      error: () => {
        this.loading = false;
        this.refreshing = false;
        if (!this.data) this.error = 'Could not load today\'s numbers.';
      }
    });
  }

  private build(d: TodayDashboard): void {
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const compare = parseDateKey(d.compareDate);
    this.compareName = compare.toLocaleDateString('en-IN', { weekday: 'long' });
    this.compareLabel = `vs last ${this.compareName} by ${new Date(d.now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;

    // Trading hours only: from the hour before the first sale (today or last week, at the latest 10am) to 11pm
    const firstSale = d.cumulative.findIndex(c => (c.today ?? 0) > 0 || c.lastWeek > 0);
    const startHour = firstSale < 0 ? 10 : Math.min(10, Math.max(0, firstSale - 1));
    const hours = d.cumulative.filter(c => c.hour >= startHour);
    this.hourLabels = hours.map(c => hourLabel(c.hour + 1));
    this.hourTooltips = hours.map(c => `By ${hourLabel(c.hour + 1)}`);
    this.cumulativeSeries = [
      { name: 'Today', values: hours.map(c => c.today ?? null), role: 'primary' },
      { name: `Last ${this.compareName} (${compare.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`, values: hours.map(c => c.lastWeek), role: 'compare' }
    ];

    this.last7Labels = d.last7Days.map(p => parseDateKey(p.date).toLocaleDateString('en-IN', { weekday: 'short' }));
    this.last7Tooltips = d.last7Days.map((p, i) => parseDateKey(p.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) + (i === 6 ? ' · so far' : ''));
    this.last7Values = d.last7Days.map(p => p.revenue);

    this.topItemRows = d.topItems.map(i => ({ label: i.name, value: i.revenue, display: inr(i.revenue), sub: `${i.quantity} sold · ${i.sharePct}%` }));
    this.occupancyPct = d.live.totalTables ? Math.round(d.live.occupiedTables / d.live.totalTables * 100) : 0;

    this.tables = {
      cumulative: { columns: ['By', 'Today', this.cumulativeSeries[1].name],
        rows: d.cumulative.map(c => [hourLabel(c.hour + 1), c.today === null || c.today === undefined ? '—' : inr(c.today), inr(c.lastWeek)]) },
      last7: { columns: ['Day', 'Revenue', 'Orders'], rows: d.last7Days.map((p, i) => [this.last7Tooltips[i], inr(p.revenue), p.orders]) }
    };
  }

  get todayLabel(): string {
    return this.data ? parseDateKey(this.data.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  }

  statusClass(status: string): string {
    return 'st-' + status.toLowerCase();
  }
}
