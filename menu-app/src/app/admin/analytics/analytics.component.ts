import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsOverview } from '../../models/api.models';
import { parseDateKey, toDateKey } from '../../shared/date-utils';
import { LineChartComponent, LineSeries } from '../../shared/charts/line-chart.component';
import { StatTileComponent } from '../../shared/charts/stat-tile.component';
import { ColumnChartComponent } from '../../shared/charts/column-chart.component';
import { HeatmapComponent } from '../../shared/charts/heatmap.component';
import { BarListComponent, BarRow } from '../../shared/charts/bar-list.component';
import { ChartCardComponent, ChartTable } from '../../shared/charts/chart-card.component';
import { hourLabel, inr, inrCompact, num } from '../../shared/charts/format';

type Preset = '7d' | '30d' | '90d' | 'month' | 'lastMonth' | 'custom';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LineChartComponent, StatTileComponent, ColumnChartComponent,
    HeatmapComponent, BarListComponent, ChartCardComponent],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  readonly presets: { id: Preset; label: string }[] = [
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: '90d', label: 'Last 90 days' },
    { id: 'month', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' }
  ];
  preset: Preset = '30d';
  from = '';
  to = '';
  readonly today = toDateKey(new Date());

  data: AnalyticsOverview | null = null;
  loading = false;
  error = '';

  // View models (recomputed when data arrives)
  compareLabel = '';
  lineLabels: string[] = [];
  lineTooltipLabels: string[] = [];
  lineSeries: LineSeries[] = [];
  revenueSpark: number[] = [];
  ordersSpark: number[] = [];
  aovSpark: number[] = [];
  heatRows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  heatCols: string[] = [];
  heatColNames: string[] = [];
  heatValues: number[][] = [];
  hourValues: number[] = [];
  categoryRows: BarRow[] = [];
  tableRows: BarRow[] = [];
  dueRows: BarRow[] = [];
  qrPct = 0;

  tables: Record<string, ChartTable> = {};

  readonly weekdays = WEEKDAYS;
  readonly inr = inr;
  readonly inrCompact = inrCompact;
  readonly num = num;
  readonly hourLabel = hourLabel;
  readonly fmtOrders = (v: number) => num(v);

  constructor(private analytics: AnalyticsService) {}

  ngOnInit(): void {
    this.applyPreset('30d');
  }

  applyPreset(p: Preset): void {
    this.preset = p;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const daysBack = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - (n - 1)); return d; };
    switch (p) {
      case '7d': this.from = toDateKey(daysBack(7)); this.to = this.today; break;
      case '30d': this.from = toDateKey(daysBack(30)); this.to = this.today; break;
      case '90d': this.from = toDateKey(daysBack(90)); this.to = this.today; break;
      case 'month': this.from = toDateKey(new Date(y, m, 1)); this.to = this.today; break;
      case 'lastMonth': this.from = toDateKey(new Date(y, m - 1, 1)); this.to = toDateKey(new Date(y, m, 0)); break;
      case 'custom': return;
    }
    this.load();
  }

  onCustomChange(): void {
    this.preset = 'custom';
    if (this.from && this.to && this.from <= this.to) this.load();
  }

  load(): void {
    this.loading = true; // keep the previous render visible (dimmed) while refetching
    this.error = '';
    this.analytics.getOverview(this.from, this.to).subscribe({
      next: (d) => {
        this.data = d;
        this.build(d);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Could not load analytics.';
      }
    });
  }

  private build(d: AnalyticsOverview): void {
    const short = (s: string) => parseDateKey(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const long = (s: string) => parseDateKey(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    this.compareLabel = `vs ${short(d.previousFrom)} – ${short(d.previousTo)}`;

    this.lineLabels = d.daily.map(p => short(p.date));
    this.lineTooltipLabels = d.daily.map(p => `${long(p.date)}${p.date === this.today ? ' · so far' : ''} (vs ${short(p.prevDate!)})`);
    this.lineSeries = [
      { name: `${short(d.from)} – ${short(d.to)}`, values: d.daily.map(p => p.revenue), role: 'primary' },
      { name: 'Previous period', values: d.daily.map(p => p.prevRevenue ?? 0), role: 'compare' }
    ];
    this.revenueSpark = d.daily.map(p => p.revenue);
    this.ordersSpark = d.daily.map(p => p.orders);
    this.aovSpark = d.daily.map(p => (p.orders ? p.revenue / p.orders : 0));

    // Show only the hours the restaurant is actually busy (at least 10am–11pm), not 24 empty columns
    const active = d.hourly.filter(h => h.orders > 0).map(h => h.hour);
    const firstHour = Math.min(10, ...active), lastHour = Math.max(22, ...active);
    const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
    this.heatCols = hours.map(h => hourLabel(h));
    this.heatColNames = hours.map(h => `${hourLabel(h)}–${hourLabel(h + 1)}`);
    this.heatValues = Array.from({ length: 7 }, (_, wd) =>
      hours.map(h => d.heatmap.find(c => c.weekday === wd && c.hour === h)?.orders ?? 0));
    this.hourValues = hours.map(h => d.hourly.find(x => x.hour === h)?.orders ?? 0);

    this.categoryRows = d.categories.map(c => ({ label: c.name, value: c.revenue, display: `${inrCompact(c.revenue)} · ${c.sharePct}%`, sub: `${num(c.quantity)} sold` }));
    this.tableRows = d.tables.map(t => ({ label: t.table, value: t.revenue, display: inrCompact(t.revenue), sub: `${t.orders} orders · avg ${inr(t.avgOrderValue)}` }));
    this.dueRows = d.duesAging.map(b => ({ label: b.label, value: b.amount, display: b.count ? `${inr(b.amount)} · ${b.count}` : '—' }));

    const totalOrders = d.sources.qrOrders + d.sources.staffOrders;
    this.qrPct = totalOrders ? Math.round(d.sources.qrOrders / totalOrders * 100) : 0;

    this.tables = {
      trend: { columns: ['Date', 'Revenue', 'Orders', 'Previous date', 'Previous revenue'],
        rows: d.daily.map(p => [long(p.date), inr(p.revenue), p.orders, short(p.prevDate!), inr(p.prevRevenue)]) },
      heat: { columns: ['Day', ...this.heatCols], rows: this.heatValues.map((r, wd) => [WEEKDAYS[wd], ...r]) },
      hourly: { columns: ['Hour', 'Orders', 'Revenue'], rows: d.hourly.filter(h => h.orders).map(h => [`${hourLabel(h.hour)}–${hourLabel(h.hour + 1)}`, h.orders, inr(h.revenue)]) },
      categories: { columns: ['Category', 'Revenue', 'Share', 'Items sold'], rows: d.categories.map(c => [c.name, inr(c.revenue), `${c.sharePct}%`, c.quantity]) },
      tablesPerf: { columns: ['Table', 'Revenue', 'Orders', 'Avg order'], rows: d.tables.map(t => [t.table, inr(t.revenue), t.orders, inr(t.avgOrderValue)]) },
      dues: { columns: ['Age', 'Bills', 'Amount due'], rows: d.duesAging.map(b => [b.label, b.count, inr(b.amount)]) }
    };
  }

  /** "▲ 0.8%" with good/bad tone; lower is better for times. */
  deltaText(pct: number | null | undefined): string {
    if (pct === null || pct === undefined) return '';
    return `${pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} ${Math.abs(pct)}%`;
  }

  deltaTone(pct: number | null | undefined, upIsGood: boolean): string {
    if (pct === null || pct === undefined || Math.abs(pct) < 0.5) return '';
    return (pct > 0) === upIsGood ? 'good' : 'bad';
  }

  /** Signed change for item rows; null when the item didn't sell before. */
  change(pct: number | null | undefined): string {
    if (pct === null || pct === undefined) return 'New';
    return `${pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} ${Math.abs(pct)}%`;
  }
}
